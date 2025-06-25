'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import styles from './EventDashboard.module.css';
import { DashboardSecurity, DashboardPermissions } from '@/utils/dashboardSecurity';
import { 
  FaEdit, 
  FaTrash, 
  FaTicketAlt, 
  FaUsers, 
  FaCalendarAlt, 
  FaMapMarkerAlt,
  FaDownload,
  FaEye,
  FaMoneyBillWave,
  FaSearch,
  FaFilter,
  FaQrcode,
  FaSyncAlt,
  FaChartBar,
  FaUserCheck,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaCamera,
  FaToggleOn,
  FaPause,
  FaFileExcel,
  FaFilePdf,
  FaBell,
  FaShare,
  FaCopy,
  FaCog,
  FaExclamationTriangle,
  FaUserPlus
} from 'react-icons/fa';

interface TimeSlot {
  start_time: string;
  end_time: string;
}

interface Attendee {
  id: string;
  name: string;
  email: string;
  phone: string;
  tickets: Record<string, number> | number; // Can be object for events or number for activities
  selectedDate: string;
  selectedTimeSlot: TimeSlot;
  createdAt: string;
  status?: string;
  paymentStatus?: string;
  checkedIn?: boolean;
  checkInTime?: string;
  ticketIds?: string[];
  userId?: string; // The authenticated user ID who made the booking
  eventId?: string; // The event this attendee is registered for
  activityId?: string; // The activity this attendee is registered for
  
  // New properties for individual attendee records
  ticketType?: string; // For events - which ticket type this attendee has
  ticketIndex?: number; // Which ticket number in the booking (1st, 2nd, etc.)
  totalTicketsInBooking?: number; // How many total tickets were in the original booking
  individualAmount?: number; // This attendee's portion of the payment
  originalBookingData?: {
    originalTotalAmount: number;
    originalTickets: Record<string, number> | number;
    bookingReference: string;
  };
  attendeeId?: string;
  canCheckInIndependently?: boolean;
  checkInMethod?: string;
  checkedInBy?: string;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  userName: string;
  userEmail: string;
  ticketType?: string;
  eventId?: string;
  activityId?: string;
  userId: string;
  status: 'active' | 'used' | 'cancelled' | 'expired';
  createdAt: string;
  usedAt?: string;
  qrCode?: string;
  type: 'event' | 'activity';
  title: string;
  venue: string;
  selectedDate: string;
  selectedTimeSlot: {
    start_time: string;
    end_time: string;
  };
  amount: number;
  bookingId: string;
}

interface EventSession {
  id: string;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  venue?: string;
  description?: string;
  tickets: Array<{
    name: string;
    capacity: number;
    price: number;
    available_capacity: number;
  }>;
  available: boolean;
  maxCapacity?: number;
}

interface EventData {
  id: string;
  title: string;
  event_image?: string;
  organizationId: string;
  event_type: string;
  architecture?: 'legacy' | 'session-centric';
  
  // Session-centric fields
  sessions?: EventSession[];
  venue_type?: 'global' | 'per_session';
  total_sessions?: number;
  total_capacity?: number;
  
  // Legacy and compatibility fields
  time_slots: Array<{
    date: string;
    start_time: string;
    end_time: string;
    available: boolean;
    session_id?: string;
  }>;
  tickets: Array<{
    name: string;
    capacity: number;
    price: number;
    available_capacity: number;
  }>;
  event_venue: string;
  about_event: string;
  hosting_club: string;
  organization_username: string;
  event_category: string;
  event_languages: string;
  event_duration: string;
  event_age_limit: string;
}

const EventDashboard = () => {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const auth = getAuth();
  const eventId = params?.id;
  
  // State management
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<DashboardPermissions>({
    canView: false,
    canEdit: false,
    canDelete: false,
    canManageAttendees: false,
    canViewFinancials: false,
    canSendCommunications: false,
    role: 'unauthorized'
      });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'attendees' | 'checkin' | 'settings' | 'manage-tickets'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'confirmed' | 'pending' | 'checked-in' | 'not-checked-in'>('all');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  
  // Real-time data
  const [realTimeStats, setRealTimeStats] = useState({
    totalRevenue: 0,
    soldTickets: 0,
    availableTickets: 0,
    totalCapacity: 0,
    checkedInCount: 0,
    pendingCheckIn: 0,
    lastUpdated: new Date()
  });
  
  // UI state
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  
  // Check-in specific state
  const [scannerActive, setScannerActive] = useState(false);
  const [scanResult, setScanResult] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null);
  const [showManualCheckIn, setShowManualCheckIn] = useState(false);
  const [manualCheckInSearch, setManualCheckInSearch] = useState('');
  const [selectedAttendeeForCheckIn, setSelectedAttendeeForCheckIn] = useState<Attendee | null>(null);
  
  // Ticket management state
  const [showTicketManager, setShowTicketManager] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [newTicket, setNewTicket] = useState({ name: '', capacity: '', price: '' });
  const [ticketUpdating, setTicketUpdating] = useState<string | null>(null);
  const [ticketUpdateResult, setTicketUpdateResult] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null);
  
  // Manual attendee addition state
  const [showManualAttendeeForm, setShowManualAttendeeForm] = useState(false);
  const [manualAttendeeData, setManualAttendeeData] = useState({
    name: '',
    email: '',
    phone: '',
    ticketType: '',
    quantity: 1,
    selectedTimeSlot: null as any
  });
  const [manualAttendeeLoading, setManualAttendeeLoading] = useState(false);
  const [manualAttendeeResult, setManualAttendeeResult] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null);
  
  // Refs for cleanup
  const unsubscribeAttendees = useRef<(() => void) | null>(null);
  const unsubscribeTickets = useRef<(() => void) | null>(null);

  // Update real-time statistics - now works with individual attendee records
  const updateRealTimeStats = useCallback((attendeesList: Attendee[], ticketsList: Ticket[]) => {
    if (!eventData) return;

    const totalCapacity = eventData.tickets.reduce((sum, ticket) => sum + ticket.capacity, 0);
    
    // With individual attendee records, each attendee represents 1 ticket
    const soldTickets = attendeesList.length;
    
    // Calculate revenue - each attendee has their individual amount
    const revenue = attendeesList.reduce((sum, attendee) => {
      // Use individualAmount if available (new system), fallback to calculation for old records
      if (attendee.individualAmount) {
        return sum + attendee.individualAmount;
      } else {
        // Fallback for old group booking records
        return sum + Object.entries(attendee.tickets).reduce((ticketSum, [ticketName, count]) => {
          const ticket = eventData.tickets.find(t => t.name === ticketName);
          return ticketSum + (ticket ? ticket.price * Number(count) : 0);
        }, 0);
      }
    }, 0);

    const checkedInCount = attendeesList.filter(attendee => attendee.checkedIn).length;
    const pendingCheckIn = attendeesList.length - checkedInCount;

    setRealTimeStats({
      totalRevenue: revenue,
      soldTickets,
      availableTickets: totalCapacity - soldTickets,
      totalCapacity,
      checkedInCount,
      pendingCheckIn,
      lastUpdated: new Date()
    });
  }, [eventData]);

  // Real-time attendees fetching
  const setupRealTimeAttendees = useCallback(() => {
    if (!eventId || !permissions.canView) return;

    const attendeesRef = collection(db, 'eventAttendees');
    const attendeesQuery = query(
      attendeesRef,
      where('eventId', '==', eventId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      attendeesQuery,
      (snapshot) => {
        const attendeesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Attendee[];
        
        setAttendees(attendeesList);
        updateRealTimeStats(attendeesList, tickets);
        setLastRefresh(new Date());
      },
      (error) => {
        console.error("Error in real-time attendees listener:", error);
        setError(error.message);
      }
    );

    unsubscribeAttendees.current = unsubscribe;
    return unsubscribe;
  }, [eventId, permissions.canView, updateRealTimeStats, tickets]);

  // Real-time tickets fetching
  const setupRealTimeTickets = useCallback(() => {
    if (!eventId || !permissions.canView) return;

    const ticketsRef = collection(db, 'tickets');
    
    // Create multiple queries to fetch tickets for both events and activities
    const eventTicketsQuery = query(
      ticketsRef,
      where('eventId', '==', eventId)
    );
    
    const activityTicketsQuery = query(
      ticketsRef,
      where('activityId', '==', eventId)
    );

    // Set up listeners for both event and activity tickets
    const unsubscribeEvent = onSnapshot(
      eventTicketsQuery,
      (snapshot) => {
        let eventTickets = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Ticket[];
        
        // Get activity tickets
        const unsubscribeActivity = onSnapshot(
          activityTicketsQuery,
          (activitySnapshot) => {
            let activityTickets = activitySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Ticket[];
            
            // Combine and sort all tickets
            let allTickets = [...eventTickets, ...activityTickets];
            allTickets.sort((a, b) => {
              const dateA = new Date(a.createdAt || 0).getTime();
              const dateB = new Date(b.createdAt || 0).getTime();
              return dateB - dateA;
            });
            
            setTickets(allTickets);
            updateRealTimeStats(attendees, allTickets);
          },
          (error) => {
            console.error("Error in activity tickets listener:", error);
            // If activity query fails, just use event tickets
            setTickets(eventTickets);
            updateRealTimeStats(attendees, eventTickets);
          }
        );
        
        // Store the activity unsubscribe function
        if (unsubscribeTickets.current) {
          unsubscribeTickets.current();
        }
        unsubscribeTickets.current = unsubscribeActivity;
      },
      (error) => {
        console.error("Error in event tickets listener:", error);
        // Fallback: try simple query without any where clause and filter manually
        const allTicketsQuery = query(ticketsRef);
        
        const fallbackUnsubscribe = onSnapshot(allTicketsQuery, (snapshot) => {
          let allTickets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Ticket[];
          
          // Filter for this event/activity
          let filteredTickets = allTickets.filter(ticket => 
            ticket.eventId === eventId || ticket.activityId === eventId
          );
          
          // Sort manually
          filteredTickets.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA;
          });
          
          setTickets(filteredTickets);
          updateRealTimeStats(attendees, filteredTickets);
        });
        
        unsubscribeTickets.current = fallbackUnsubscribe;
      }
    );

    return unsubscribeEvent;
  }, [eventId, permissions.canView, updateRealTimeStats, attendees]);

  useEffect(() => {
    if (!eventId) {
      setError('No event ID provided');
      setLoading(false);
      return;
    }
    
    const initializeDashboard = async () => {
      setLoading(true);
      try {
        await checkAuthorization();
        await fetchEventData();
      } catch (error) {
        console.error('Error initializing dashboard:', error);
        setError('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [eventId]);

  // Set up real-time listeners after authorization
  useEffect(() => {
    if (permissions.canView && eventId && !loading) {
      setupRealTimeAttendees();
      setupRealTimeTickets();
    }

    // Cleanup on unmount
    return () => {
      if (unsubscribeAttendees.current) {
        unsubscribeAttendees.current();
      }
      if (unsubscribeTickets.current) {
        unsubscribeTickets.current();
      }
    };
  }, [permissions.canView, eventId, loading, setupRealTimeAttendees, setupRealTimeTickets]);

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchEventData();
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const checkAuthorization = async () => {
    if (!auth.currentUser || !eventId) {
      setPermissions({
        canView: false,
        canEdit: false,
        canDelete: false,
        canManageAttendees: false,
        canViewFinancials: false,
        canSendCommunications: false,
        role: 'unauthorized'
      });
      setError('Please sign in to access this dashboard');
      return;
    }

    try {
      const dashboardPermissions = await DashboardSecurity.verifyDashboardAccess(eventId, auth.currentUser.uid);
      setPermissions(dashboardPermissions);
      
      if (!dashboardPermissions.canView) {
        setError('You do not have permission to view this event dashboard');
      }
    } catch (err) {
      console.error("Error checking authorization:", err);
      setPermissions({
        canView: false,
        canEdit: false,
        canDelete: false,
        canManageAttendees: false,
        canViewFinancials: false,
        canSendCommunications: false,
        role: 'unauthorized'
      });
      setError('Failed to verify permissions');
    }
  };

  const fetchEventData = async () => {
    if (!eventId) return;
    
    try {
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (eventDoc.exists()) {
        setEventData({
          id: eventDoc.id,
          title: eventDoc.data().title || eventDoc.data().eventTitle,
          event_image: eventDoc.data().event_image,
          organizationId: eventDoc.data().organizationId,
          event_type: eventDoc.data().event_type,
          time_slots: eventDoc.data().time_slots,
          tickets: eventDoc.data().tickets,
          event_venue: eventDoc.data().event_venue,
          about_event: eventDoc.data().about_event,
          hosting_club: eventDoc.data().hosting_club,
          organization_username: eventDoc.data().organization_username,
          event_category: eventDoc.data().event_category,
          event_languages: eventDoc.data().event_languages,
          event_duration: eventDoc.data().event_duration,
          event_age_limit: eventDoc.data().event_age_limit,
        });
      }
    } catch (err) {
      console.error("Error fetching event data:", err);
    }
  };

  // Check-in functionality
  const handleTicketScan = async (ticketData: string) => {
    try {
      // Parse QR code data (assuming it contains ticket ID)
      const ticketId = ticketData;
      
      // Find the ticket
      const ticket = tickets.find(t => t.id === ticketId || t.ticketNumber === ticketData);
      if (!ticket) {
        setScanResult({type: 'error', message: 'Invalid ticket - not found'});
        return;
      }

      // Check if already used
      if (ticket.status === 'used') {
        setScanResult({type: 'error', message: `Ticket already used at ${ticket.usedAt}`});
        return;
      }

      // Check if cancelled or expired
      if (ticket.status === 'cancelled' || ticket.status === 'expired') {
        setScanResult({type: 'error', message: `Ticket is ${ticket.status}`});
        return;
      }

      // Mark ticket as used
      await updateDoc(doc(db, 'tickets', ticket.id), {
        status: 'used',
        usedAt: new Date().toISOString(),
        checkedInBy: auth.currentUser?.uid
      });

      // Mark attendee as checked in
      // Find attendee by userId (the user who made the booking) or fallback to email
      const attendee = attendees.find(a => a.userId === ticket.userId) || 
                       attendees.find(a => a.email === ticket.userEmail);
      
      if (attendee) {
        await updateDoc(doc(db, 'eventAttendees', attendee.id), {
          checkedIn: true,
          checkInTime: new Date().toISOString()
        });
      }

      setScanResult({
        type: 'success', 
        message: `✅ ${ticket.userName} checked in successfully!`
      });

    } catch (error) {
      console.error('Error processing ticket scan:', error);
      setScanResult({type: 'error', message: 'Error processing ticket'});
    }
  };

  // Manual check-in functionality
  const handleManualCheckIn = async (attendee: Attendee) => {
    if (!attendee || attendee.checkedIn) return;

    try {
      // Mark attendee as checked in
      await updateDoc(doc(db, 'eventAttendees', attendee.id), {
        checkedIn: true,
        checkInTime: new Date().toISOString(),
        checkInMethod: 'manual',
        checkedInBy: auth.currentUser?.uid
      });

      // Also mark their tickets as used
      const attendeeTickets = tickets.filter(t => 
        t.userId === attendee.userId || t.userEmail === attendee.email
      );
      
      const ticketUpdatePromises = attendeeTickets
        .filter(t => t.status === 'active')
        .map(ticket => 
          updateDoc(doc(db, 'tickets', ticket.id), {
            status: 'used',
            usedAt: new Date().toISOString(),
            checkInMethod: 'manual',
            checkedInBy: auth.currentUser?.uid
          })
        );
      
      await Promise.all(ticketUpdatePromises);

      setScanResult({
        type: 'success', 
        message: `✅ ${attendee.name} manually checked in successfully!`
      });

      setSelectedAttendeeForCheckIn(null);
      setShowManualCheckIn(false);
      setManualCheckInSearch('');

    } catch (error) {
      console.error('Error processing manual check-in:', error);
      setScanResult({type: 'error', message: 'Error processing manual check-in'});
    }
  };

  // Search attendees for manual check-in
  const searchableAttendees = attendees.filter(attendee => {
    if (attendee.checkedIn) return false; // Only show non-checked-in attendees
    
    const searchTerm = manualCheckInSearch.toLowerCase();
    return searchTerm === '' || 
      attendee.name.toLowerCase().includes(searchTerm) ||
      attendee.email.toLowerCase().includes(searchTerm) ||
      attendee.phone.includes(searchTerm);
  });

  // Manual attendee addition functionality
  const handleManualAttendeeAdd = async () => {
    if (!permissions.canManageAttendees || !auth.currentUser || !eventId) {
      setManualAttendeeResult({type: 'error', message: 'You do not have permission to add attendees'});
      return;
    }

    // Validate form data
    if (!manualAttendeeData.name.trim() || !manualAttendeeData.email.trim() || 
        !manualAttendeeData.phone.trim() || !manualAttendeeData.ticketType || 
        !manualAttendeeData.selectedTimeSlot || !manualAttendeeData.quantity || manualAttendeeData.quantity < 1) {
      setManualAttendeeResult({type: 'error', message: 'Please fill in all fields including time slot and ensure quantity is at least 1'});
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(manualAttendeeData.email)) {
      setManualAttendeeResult({type: 'error', message: 'Please enter a valid email address'});
      return;
    }

    // Basic phone validation
    const phoneRegex = /^[\+]?[1-9][\d]{1,14}$/;
    if (!phoneRegex.test(manualAttendeeData.phone.replace(/[\s\-\(\)]/g, ''))) {
      setManualAttendeeResult({type: 'error', message: 'Please enter a valid phone number'});
      return;
    }

    setManualAttendeeLoading(true);
    setManualAttendeeResult(null);

    try {
              const response = await fetch('/api/manual-attendee-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          name: manualAttendeeData.name.trim(),
          email: manualAttendeeData.email.trim(),
          phone: manualAttendeeData.phone.trim(),
          ticketType: manualAttendeeData.ticketType,
          quantity: manualAttendeeData.quantity,
          hostUserId: auth.currentUser.uid
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setManualAttendeeResult({
          type: 'success', 
          message: result.message || 'Attendee added successfully!'
        });
        
        // Clear the form
        setManualAttendeeData({
          name: '',
          email: '',
          phone: '',
          ticketType: '',
          quantity: 1,
          selectedTimeSlot: null
        });

        // Close the form after a delay
        setTimeout(() => {
          setShowManualAttendeeForm(false);
          setManualAttendeeResult(null);
        }, 3000);

        console.log('Manual attendee added:', result.attendeeData);
      } else {
        setManualAttendeeResult({
          type: 'error', 
          message: result.error || 'Failed to add attendee'
        });
      }
    } catch (error) {
      console.error('Error adding manual attendee:', error);
      setManualAttendeeResult({
        type: 'error', 
        message: 'Network error. Please try again.'
      });
    } finally {
      setManualAttendeeLoading(false);
    }
  };

  const resetManualAttendeeForm = () => {
    setManualAttendeeData({
      name: '',
      email: '',
      phone: '',
      ticketType: '',
      quantity: 1,
      selectedTimeSlot: null
    });
    setManualAttendeeResult(null);
    setShowManualAttendeeForm(false);
  };



  // Secure ticket management functions
  const validateTicketData = (ticket: any) => {
    if (!ticket.name || ticket.name.trim().length < 2) {
      return 'Ticket name must be at least 2 characters long';
    }
    if (!ticket.capacity || parseInt(ticket.capacity) <= 0) {
      return 'Capacity must be a positive number';
    }
    if (!ticket.price || parseFloat(ticket.price) < 0) {
      return 'Price must be 0 or greater';
    }
    if (parseInt(ticket.capacity) > 10000) {
      return 'Capacity cannot exceed 10,000 for safety reasons';
    }
    return null;
  };

  const calculateSoldTickets = (ticketName: string) => {
    return attendees.reduce((count, attendee) => {
      // Handle new individual attendee records
      if (attendee.canCheckInIndependently && attendee.ticketType === ticketName) {
        return count + 1;
      }
      // Handle old group booking records
      if (typeof attendee.tickets === 'object') {
        return count + (attendee.tickets[ticketName] || 0);
      }
      return count;
    }, 0);
  };

  const handleAddNewTicket = async () => {
    if (!permissions.canEdit || !eventData) return;

    const validation = validateTicketData(newTicket);
    if (validation) {
      setTicketUpdateResult({type: 'error', message: validation});
      return;
    }

    // Check for duplicate ticket names
    const exists = eventData.tickets.some(t => 
      t.name.toLowerCase() === newTicket.name.trim().toLowerCase()
    );
    if (exists) {
      setTicketUpdateResult({type: 'error', message: 'Ticket type with this name already exists'});
      return;
    }

    setTicketUpdating('new');
    try {
      const updatedTickets = [...eventData.tickets, {
        name: newTicket.name.trim(),
        capacity: parseInt(newTicket.capacity),
        price: parseFloat(newTicket.price),
        available_capacity: parseInt(newTicket.capacity)
      }];

      await updateDoc(doc(db, 'events', eventId!), {
        tickets: updatedTickets,
        updatedAt: serverTimestamp()
      });

      setTicketUpdateResult({
        type: 'success', 
        message: `✅ New ticket type "${newTicket.name}" added successfully!`
      });
      
      setNewTicket({ name: '', capacity: '', price: '' });
      await fetchEventData(); // Refresh data

    } catch (error) {
      console.error('Error adding new ticket:', error);
      setTicketUpdateResult({type: 'error', message: 'Failed to add new ticket type'});
    } finally {
      setTicketUpdating(null);
    }
  };

  const handleUpdateTicketCapacity = async (ticketIndex: number, newCapacity: number) => {
    if (!permissions.canEdit || !eventData) return;

    const ticket = eventData.tickets[ticketIndex];
    const soldCount = calculateSoldTickets(ticket.name);

    // Validate new capacity
    if (newCapacity < soldCount) {
      setTicketUpdateResult({
        type: 'error', 
        message: `Cannot reduce capacity below ${soldCount} (already sold tickets)`
      });
      return;
    }

    if (newCapacity <= 0 || newCapacity > 10000) {
      setTicketUpdateResult({
        type: 'error', 
        message: 'Capacity must be between 1 and 10,000'
      });
      return;
    }

    setTicketUpdating(ticketIndex.toString());
    try {
      const updatedTickets = [...eventData.tickets];
      updatedTickets[ticketIndex] = {
        ...ticket,
        capacity: newCapacity,
        available_capacity: newCapacity - soldCount
      };

      await updateDoc(doc(db, 'events', eventId!), {
        tickets: updatedTickets,
        updatedAt: serverTimestamp()
      });

      setTicketUpdateResult({
        type: 'success', 
        message: `✅ "${ticket.name}" capacity updated to ${newCapacity}`
      });
      
      await fetchEventData(); // Refresh data

    } catch (error) {
      console.error('Error updating ticket capacity:', error);
      setTicketUpdateResult({type: 'error', message: 'Failed to update ticket capacity'});
    } finally {
      setTicketUpdating(null);
    }
  };

  const handleUpdateTicketPrice = async (ticketIndex: number, newPrice: number) => {
    if (!permissions.canEdit || !eventData) return;

    if (newPrice < 0) {
      setTicketUpdateResult({type: 'error', message: 'Price cannot be negative'});
      return;
    }

    setTicketUpdating(`price-${ticketIndex}`);
    try {
      const updatedTickets = [...eventData.tickets];
      updatedTickets[ticketIndex] = {
        ...updatedTickets[ticketIndex],
        price: newPrice
      };

      await updateDoc(doc(db, 'events', eventId!), {
        tickets: updatedTickets,
        updatedAt: serverTimestamp()
      });

      setTicketUpdateResult({
        type: 'success', 
        message: `✅ "${updatedTickets[ticketIndex].name}" price updated to ₹${newPrice}`
      });
      
      await fetchEventData(); // Refresh data

    } catch (error) {
      console.error('Error updating ticket price:', error);
      setTicketUpdateResult({type: 'error', message: 'Failed to update ticket price'});
    } finally {
      setTicketUpdating(null);
    }
  };

  const handleDeleteTicket = async (ticketIndex: number) => {
    if (!permissions.canDelete || !eventData) return;

    const ticket = eventData.tickets[ticketIndex];
    const soldCount = calculateSoldTickets(ticket.name);

    if (soldCount > 0) {
      setTicketUpdateResult({
        type: 'error', 
        message: `Cannot delete "${ticket.name}" - ${soldCount} tickets already sold`
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete the "${ticket.name}" ticket type? This action cannot be undone.`)) {
      return;
    }

    setTicketUpdating(`delete-${ticketIndex}`);
    try {
      const updatedTickets = eventData.tickets.filter((_, index) => index !== ticketIndex);

      await updateDoc(doc(db, 'events', eventId!), {
        tickets: updatedTickets,
        updatedAt: serverTimestamp()
      });

      setTicketUpdateResult({
        type: 'success', 
        message: `✅ Ticket type "${ticket.name}" deleted successfully`
      });
      
      await fetchEventData(); // Refresh data

    } catch (error) {
      console.error('Error deleting ticket:', error);
      setTicketUpdateResult({type: 'error', message: 'Failed to delete ticket type'});
    } finally {
      setTicketUpdating(null);
    }
  };

  const filteredAttendees = attendees.filter(attendee => {
    const matchesSearch = searchTerm === '' || 
      attendee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attendee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attendee.phone.includes(searchTerm);
    
    const matchesFilter = filterStatus === 'all' || 
      (filterStatus === 'confirmed' && attendee.status === 'confirmed') ||
      (filterStatus === 'pending' && attendee.status !== 'confirmed') ||
      (filterStatus === 'checked-in' && attendee.checkedIn) ||
      (filterStatus === 'not-checked-in' && !attendee.checkedIn);
    
    return matchesSearch && matchesFilter;
  });

  const handleEdit = () => {
    router.push(`/edit-event/${eventId}`);
  };

  const handleDelete = async () => {
    if (!permissions.canDelete || !eventId || deleteConfirmText !== 'DELETE') return;

    setLoading(true);
    try {
      // Delete all attendees first
      const attendeesRef = collection(db, 'eventAttendees');
      const attendeesQuery = query(attendeesRef, where('eventId', '==', eventId));
      const attendeesSnapshot = await getDocs(attendeesQuery);
      
      const deletePromises = attendeesSnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      await Promise.all(deletePromises);

      // Delete all tickets
      const ticketsRef = collection(db, 'tickets');
      const ticketsQuery = query(ticketsRef, where('eventId', '==', eventId));
      const ticketsSnapshot = await getDocs(ticketsQuery);
      
      const deleteTicketPromises = ticketsSnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      await Promise.all(deleteTicketPromises);

      // Delete the event
      await deleteDoc(doc(db, 'events', eventId));
      
      // Redirect to home page
      router.push('/');
      router.refresh();
    } catch (err) {
      console.error("Error deleting event:", err);
      setError("Failed to delete event. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className={styles.eventDashboard}>
        <div className={styles.loadingState}>Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.eventDashboard}>
        <div className={styles.errorState}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.eventDashboard}>
      {/* Enhanced Header with Event Image */}
      <div className={styles.dashboardHeader}>
        <div className={styles.headerContent}>
          <div className={styles.eventImageSection}>
            {eventData?.event_image ? (
              <img 
                src={eventData.event_image} 
                alt={eventData.title}
                className={styles.eventImage}
              />
            ) : (
              <div className={styles.eventImagePlaceholder}>
                <FaCalendarAlt />
              </div>
            )}
            <div className={styles.liveIndicator}>
              <span className={styles.liveDot}></span>
              <span>Live Dashboard</span>
            </div>
          </div>
          
          <div className={styles.headerLeft}>
            <div className={styles.titleSection}>
              <h1 className={styles.title}>
                {eventData?.title || 'Event Dashboard'}
              </h1>
              <span className={styles.roleIndicator}>{permissions.role}</span>
            </div>
            
            <div className={styles.eventMeta}>
              <div className={styles.metaItem}>
                <FaCalendarAlt />
                <span>
                  {(() => {
                    const timeSlots = eventData?.time_slots;
                    if (!timeSlots || timeSlots.length === 0) return 'No dates set';
                    if (timeSlots.length === 1) return timeSlots[0]?.date || 'Date TBD';
                    return `${timeSlots.length} sessions`;
                  })()}
                </span>
              </div>
              <div className={styles.metaItem}>
                <FaMapMarkerAlt />
                <span>{eventData?.event_venue}</span>
              </div>
              <div className={styles.metaItem}>
                <FaUsers />
                <span>{realTimeStats.checkedInCount}/{attendees.length} attended</span>
              </div>
              <div className={styles.metaItem}>
                <FaClock />
                <span>Updated {lastRefresh.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className={styles.headerActions}>
          <div className={styles.quickStats}>
            <div className={styles.quickStatItem}>
              <span className={styles.quickStatValue}>₹{(realTimeStats.totalRevenue / 1000).toFixed(0)}K</span>
              <span className={styles.quickStatLabel}>Revenue</span>
            </div>
            <div className={styles.quickStatItem}>
              <span className={styles.quickStatValue}>{Math.round((realTimeStats.soldTickets / realTimeStats.totalCapacity) * 100)}%</span>
              <span className={styles.quickStatLabel}>Sold</span>
            </div>
          </div>
          
          <button 
            onClick={handleRefresh} 
            className={`${styles.refreshButton} ${refreshing ? styles.spinning : ''}`}
            disabled={refreshing}
            title="Refresh dashboard data"
          >
            <FaSyncAlt />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Enhanced Stats Grid with Animations */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.revenueCard}`}>
          <div className={styles.statContent}>
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <FaMoneyBillWave />
              </div>
              <div className={styles.statTrend}>
                <span className={styles.trendUp}>+12%</span>
              </div>
            </div>
            <h3 className={styles.statValue}>₹{realTimeStats.totalRevenue.toLocaleString()}</h3>
            <p className={styles.statLabel}>Total Revenue</p>
            <div className={styles.statFooter}>
              <span className={styles.statSubtext}>
                Avg: ₹{Math.round(realTimeStats.totalRevenue / (attendees.length || 1))} per attendee
              </span>
            </div>
          </div>
          <div className={styles.statGlow}></div>
        </div>
        
        <div className={`${styles.statCard} ${styles.ticketCard}`}>
          <div className={styles.statContent}>
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <FaTicketAlt />
              </div>
              <div className={styles.capacityIndicator}>
                <div className={`${styles.capacityDot} ${
                  (realTimeStats.soldTickets / realTimeStats.totalCapacity) > 0.8 ? 'high' : 
                  (realTimeStats.soldTickets / realTimeStats.totalCapacity) > 0.5 ? 'medium' : 'low'
                }`}></div>
              </div>
            </div>
            <h3 className={styles.statValue}>{realTimeStats.soldTickets}</h3>
            <p className={styles.statLabel}>Tickets Sold</p>
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progress}
                  style={{ 
                    width: `${(realTimeStats.soldTickets / realTimeStats.totalCapacity) * 100}%` 
                  }}
                ></div>
              </div>
              <span className={styles.progressText}>
                {realTimeStats.availableTickets} remaining
              </span>
            </div>
          </div>
          <div className={styles.statGlow}></div>
        </div>
        
        <div className={`${styles.statCard} ${styles.attendeeCard}`}>
          <div className={styles.statContent}>
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <FaUserCheck />
              </div>
              {realTimeStats.pendingCheckIn > 0 && (
                <div className={styles.notificationBadge}>
                  {realTimeStats.pendingCheckIn}
                </div>
              )}
            </div>
            <h3 className={styles.statValue}>{realTimeStats.checkedInCount}</h3>
            <p className={styles.statLabel}>Checked In</p>
            <div className={styles.statFooter}>
              <span className={styles.statSubtext}>
                {realTimeStats.pendingCheckIn} awaiting check-in
              </span>
            </div>
          </div>
          <div className={styles.statGlow}></div>
        </div>
        
        <div className={`${styles.statCard} ${styles.capacityCard}`}>
          <div className={styles.statContent}>
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <FaChartBar />
              </div>
              <div className={styles.liveIndicator}>
                <span className={styles.liveDot}></span>
              </div>
            </div>
            <h3 className={styles.statValue}>
              {Math.round((realTimeStats.checkedInCount / (attendees.length || 1)) * 100)}%
            </h3>
            <p className={styles.statLabel}>Attendance Rate</p>
            <div className={styles.attendanceChart}>
              <div className={styles.attendanceBar}>
                <div 
                  className={styles.attendanceProgress}
                  style={{ 
                    width: `${Math.round((realTimeStats.checkedInCount / (attendees.length || 1)) * 100)}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>
          <div className={styles.statGlow}></div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabNavigation}>
        <button 
          className={`${styles.tab} ${activeTab === 'overview' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <FaEye /> Overview
          <span className={styles.tabIndicator}></span>
        </button>
        
        <button 
          className={`${styles.tab} ${activeTab === 'attendees' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('attendees')}
          disabled={!permissions.canManageAttendees}
        >
          <FaUsers /> Attendees 
          <span className={styles.tabCount}>({attendees.length})</span>
          <span className={styles.tabIndicator}></span>
        </button>

        <button 
          className={`${styles.tab} ${activeTab === 'checkin' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('checkin')}
          disabled={!permissions.canManageAttendees}
        >
          <FaQrcode /> Check-in
          {realTimeStats.pendingCheckIn > 0 && (
            <span className={styles.tabCount}>({realTimeStats.pendingCheckIn})</span>
          )}
          <span className={styles.tabIndicator}></span>
        </button>
        


        <button 
          className={`${styles.tab} ${activeTab === 'manage-tickets' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('manage-tickets')}
          disabled={!permissions.canEdit}
        >
          <FaEdit /> Manage Tickets
          <span className={styles.tabIndicator}></span>
        </button>

        <button 
          className={`${styles.tab} ${activeTab === 'settings' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('settings')}
          disabled={!permissions.canView}
        >
          <FaCog /> Settings
          <span className={styles.tabIndicator}></span>
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'overview' && (
          <div className={styles.overviewTab}>
            {/* Enhanced Sessions Overview - Session-Centric Architecture */}
            {eventData?.architecture === 'session-centric' && eventData?.sessions ? (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3>🎯 Sessions Overview</h3>
                  <p>Session-centric event with {eventData.sessions.length} sessions and {eventData.total_capacity} total capacity</p>
                </div>
                <div className={styles.sessionsBreakdown}>
                  {eventData.sessions.map((session, index) => {
                    const sessionAttendees = attendees.filter(attendee => 
                      attendee.selectedTimeSlot?.start_time === session.start_time && 
                      attendee.selectedTimeSlot?.end_time === session.end_time &&
                      attendee.selectedDate === session.date
                    );
                    const sessionCheckedIn = sessionAttendees.filter(a => a.checkedIn).length;
                    const sessionDate = new Date(session.date);
                    const isToday = sessionDate.toDateString() === new Date().toDateString();
                    const isPast = sessionDate < new Date();
                    const sessionCapacity = session.tickets.reduce((sum, ticket) => sum + ticket.capacity, 0);
                    const sessionRevenue = sessionAttendees.reduce((sum, attendee) => {
                      if (attendee.individualAmount) {
                        return sum + attendee.individualAmount;
                      } else if (typeof attendee.tickets === 'object') {
                        return sum + Object.entries(attendee.tickets).reduce((ticketSum, [ticketName, count]) => {
                          const ticket = session.tickets.find(t => t.name === ticketName);
                          return ticketSum + (ticket ? ticket.price * Number(count) : 0);
                        }, 0);
                      }
                      return sum;
                    }, 0);
                    
                    return (
                      <div key={session.id} className={`${styles.sessionCard} ${isToday ? styles.today : ''} ${isPast ? styles.past : ''}`}>
                        <div className={styles.sessionHeader}>
                          <div className={styles.sessionInfo}>
                            <h4>{session.name}</h4>
                            <p className={styles.sessionDate}>
                              {sessionDate.toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                month: 'short', 
                                day: 'numeric' 
                              })} • {session.start_time} - {session.end_time}
                            </p>
                            {session.description && (
                              <p className={styles.sessionDescription}>{session.description}</p>
                            )}
                            {eventData.venue_type === 'per_session' && session.venue && (
                              <p className={styles.sessionVenue}>📍 {session.venue}</p>
                            )}
                          </div>
                          <div className={styles.sessionBadges}>
                            {isToday && <span className={styles.todayBadge}>Today</span>}
                            {isPast && <span className={styles.pastBadge}>Past</span>}
                          </div>
                        </div>
                        
                        <div className={styles.sessionStats}>
                          <div className={styles.statItem}>
                            <span className={styles.statValue}>{sessionAttendees.length}</span>
                            <span className={styles.statLabel}>Attendees</span>
                            <span className={styles.statDetail}>of {sessionCapacity} capacity</span>
                          </div>
                          <div className={styles.statItem}>
                            <span className={styles.statValue}>{sessionCheckedIn}</span>
                            <span className={styles.statLabel}>Checked In</span>
                            <span className={styles.statDetail}>{sessionAttendees.length > 0 ? Math.round((sessionCheckedIn / sessionAttendees.length) * 100) : 0}%</span>
                          </div>
                          <div className={styles.statItem}>
                            <span className={styles.statValue}>₹{sessionRevenue.toLocaleString()}</span>
                            <span className={styles.statLabel}>Revenue</span>
                            <span className={styles.statDetail}>this session</span>
                          </div>
                        </div>

                        <div className={styles.sessionProgress}>
                          <div className={styles.progressSection}>
                            <span className={styles.progressLabel}>Capacity</span>
                            <div className={styles.progressBar}>
                              <div 
                                className={styles.progress}
                                style={{ 
                                  width: `${sessionCapacity > 0 ? (sessionAttendees.length / sessionCapacity) * 100 : 0}%` 
                                }}
                              ></div>
                            </div>
                            <span className={styles.progressText}>
                              {sessionCapacity > 0 ? Math.round((sessionAttendees.length / sessionCapacity) * 100) : 0}% full
                            </span>
                          </div>
                          <div className={styles.progressSection}>
                            <span className={styles.progressLabel}>Check-in Rate</span>
                            <div className={styles.progressBar}>
                              <div 
                                className={styles.progressCheckin}
                                style={{ 
                                  width: `${sessionAttendees.length > 0 ? (sessionCheckedIn / sessionAttendees.length) * 100 : 0}%` 
                                }}
                              ></div>
                            </div>
                            <span className={styles.progressText}>
                              {sessionAttendees.length > 0 ? Math.round((sessionCheckedIn / sessionAttendees.length) * 100) : 0}% attended
                            </span>
                          </div>
                        </div>

                        {/* Session Ticket Breakdown */}
                        <div className={styles.sessionTickets}>
                          <h5>Ticket Breakdown</h5>
                          <div className={styles.ticketList}>
                            {session.tickets.map((ticket, ticketIndex) => {
                              const soldCount = sessionAttendees.filter(attendee => 
                                (attendee.ticketType === ticket.name) || 
                                (typeof attendee.tickets === 'object' && attendee.tickets[ticket.name])
                              ).length;
                              const percentage = (soldCount / ticket.capacity) * 100;
                              
                              return (
                                <div key={ticketIndex} className={styles.ticketItem}>
                                  <span className={styles.ticketName}>{ticket.name}</span>
                                  <span className={styles.ticketPrice}>₹{ticket.price}</span>
                                  <div className={styles.ticketProgress}>
                                    <div 
                                      className={styles.ticketProgressBar}
                                      style={{ width: `${percentage}%` }}
                                    ></div>
                                  </div>
                                  <span className={styles.ticketStats}>{soldCount}/{ticket.capacity}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Legacy Time Slots Overview */
              eventData?.time_slots && eventData.time_slots.length > 1 && (
                <div className={styles.section}>
                  <h3>📅 Sessions Overview</h3>
                  <div className={styles.timeSlotsBreakdown}>
                    {eventData.time_slots.map((slot, index) => {
                      const slotAttendees = attendees.filter(attendee => 
                        attendee.selectedTimeSlot?.start_time === slot.start_time && 
                        attendee.selectedTimeSlot?.end_time === slot.end_time &&
                        attendee.selectedDate === slot.date
                      );
                      const slotCheckedIn = slotAttendees.filter(a => a.checkedIn).length;
                      const slotDate = new Date(slot.date);
                      const isToday = slotDate.toDateString() === new Date().toDateString();
                      const isPast = slotDate < new Date();
                      
                      return (
                        <div key={index} className={`${styles.timeSlotCard} ${isToday ? styles.today : ''} ${isPast ? styles.past : ''}`}>
                          <div className={styles.slotHeader}>
                            <div className={styles.slotDate}>
                              <h4>
                                {slotDate.toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                                {isToday && <span className={styles.todayBadge}>Today</span>}
                                {isPast && <span className={styles.pastBadge}>Past</span>}
                              </h4>
                              <p>{slot.start_time} - {slot.end_time}</p>
                            </div>
                            <div className={styles.slotStats}>
                              <span className={styles.attendeeCount}>{slotAttendees.length} attendees</span>
                              <span className={styles.checkedInCount}>{slotCheckedIn} checked in</span>
                            </div>
                          </div>
                          <div className={styles.slotProgress}>
                            <div className={styles.progressBar}>
                              <div 
                                className={styles.progress}
                                style={{ 
                                  width: `${slotAttendees.length > 0 ? (slotCheckedIn / slotAttendees.length) * 100 : 0}%` 
                                }}
                              ></div>
                            </div>
                            <span className={styles.progressText}>
                              {slotAttendees.length > 0 ? Math.round((slotCheckedIn / slotAttendees.length) * 100) : 0}% attendance
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {/* Ticket Breakdown */}
            <div className={styles.section}>
              <h3>Ticket Sales Overview</h3>
              <div className={styles.ticketBreakdown}>
                {eventData?.tickets.map((ticket, index) => {
                  const soldCount = calculateSoldTickets(ticket.name);
                  const percentage = (soldCount / ticket.capacity) * 100;
                  
                  return (
                    <div key={index} className={styles.ticketRow}>
                      <div className={styles.ticketInfo}>
                        <h4>{ticket.name}</h4>
                        <p>₹{ticket.price} • {soldCount}/{ticket.capacity} sold</p>
                      </div>
                      <div className={styles.ticketProgress}>
                        <div 
                          className={styles.progressBar}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className={styles.ticketStats}>
                        <span>{Math.round(percentage)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Check-ins */}
            <div className={styles.section}>
              <h3>Recent Check-ins</h3>
              <div className={styles.recentBookings}>
                {attendees.filter(a => a.checkedIn).slice(0, 5).map((attendee) => (
                  <div key={attendee.id} className={styles.bookingItem}>
                    <div className={styles.bookingInfo}>
                      <h4>{attendee.name} ✅</h4>
                      <p>{attendee.email}</p>
                    </div>
                    <div className={styles.bookingTickets}>
                      {attendee.canCheckInIndependently && attendee.ticketType ? (
                        <span className={styles.ticketBadge}>
                          {attendee.ticketType}: 1
                          {attendee.ticketIndex && attendee.totalTicketsInBooking && attendee.totalTicketsInBooking > 1 && (
                            <span className={styles.ticketIndex}> (#{attendee.ticketIndex}/{attendee.totalTicketsInBooking})</span>
                          )}
                        </span>
                      ) : typeof attendee.tickets === 'object' ? (
                        Object.entries(attendee.tickets).map(([type, count]) => (
                          <span key={type} className={styles.ticketBadge}>
                            {type}: {count}
                          </span>
                        ))
                      ) : (
                        <span className={styles.ticketBadge}>
                          Activity: {attendee.tickets}
                        </span>
                      )}
                    </div>
                    <div className={styles.bookingTime}>
                      {attendee.checkInTime ? new Date(attendee.checkInTime).toLocaleString() : 'Not checked in'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendees' && (
          <div className={styles.attendeesTab}>
            {/* Search and Filters */}
            <div className={styles.controls}>
              <div className={styles.searchBox}>
                <FaSearch />
                <input
                  type="text"
                  placeholder="Search attendees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className={styles.filterBox}>
                <FaFilter />
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
                  <option value="all">All Status</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="checked-in">Checked In</option>
                  <option value="not-checked-in">Not Checked In</option>
                </select>
              </div>
              <button 
                className={styles.addAttendeeButton}
                onClick={() => setShowManualAttendeeForm(true)}
                disabled={!permissions.canManageAttendees}
              >
                <FaUserPlus /> Add Attendee
              </button>
              <button className={styles.downloadButton}>
                <FaDownload /> Export CSV
              </button>
            </div>

            {/* Attendees Table */}
            {filteredAttendees.length === 0 ? (
              <div className={styles.emptyState}>No attendees found matching your criteria.</div>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Tickets</th>
                      <th>Registration</th>
                      <th>Check-in Status</th>
                      <th>Check-in Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendees.map((attendee) => (
                      <tr key={attendee.id}>
                        <td>{attendee.name}</td>
                        <td>{attendee.email}</td>
                        <td>{attendee.phone}</td>
                        <td>
                          {attendee.canCheckInIndependently && attendee.ticketType ? (
                            <span className={styles.ticketBadge}>
                              {attendee.ticketType}: 1
                              {attendee.ticketIndex && attendee.totalTicketsInBooking && attendee.totalTicketsInBooking > 1 && (
                                <span className={styles.ticketIndex}> (#{attendee.ticketIndex}/{attendee.totalTicketsInBooking})</span>
                              )}
                            </span>
                          ) : typeof attendee.tickets === 'object' ? (
                            Object.entries(attendee.tickets).map(([type, count]) => (
                              <span key={type} className={styles.ticketBadge}>
                                {type}: {count}
                              </span>
                            ))
                          ) : (
                            <span className={styles.ticketBadge}>
                              Activity: {attendee.tickets}
                            </span>
                          )}
                        </td>
                        <td>{new Date(attendee.createdAt).toLocaleDateString()}</td>
                        <td>
                          <span className={`${styles.statusBadge} ${attendee.checkedIn ? styles.confirmed : styles.pending}`}>
                            {attendee.checkedIn ? (
                              <>
                                <FaCheckCircle /> Checked In
                              </>
                            ) : (
                              <>
                                <FaClock /> Pending
                              </>
                            )}
                          </span>
                        </td>
                        <td>
                          {attendee.checkInTime ? 
                            new Date(attendee.checkInTime).toLocaleString() : 
                            '-'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'checkin' && (
          <div className={styles.checkinTab}>
            <div className={styles.section}>
              <h3>Event Check-in</h3>
              <p>Check in attendees using QR code scanning or manual search</p>
              
              <div className={styles.checkInMethods}>
                <div className={styles.methodCard}>
                  <div className={styles.methodHeader}>
                    <FaQrcode />
                    <h4>QR Code Scanner</h4>
                  </div>
                  <p>Scan attendee tickets for quick check-in</p>
                  <button 
                    className={styles.scannerButton}
                    onClick={() => router.push(`/scan-tickets/${eventId}`)}
                  >
                    <FaCamera /> Open QR Scanner
                  </button>
                </div>

                <div className={styles.methodCard}>
                  <div className={styles.methodHeader}>
                    <FaSearch />
                    <h4>Manual Check-in</h4>
                  </div>
                  <p>Search and check in attendees manually</p>
                  <button 
                    className={styles.manualButton}
                    onClick={() => setShowManualCheckIn(true)}
                  >
                    <FaUsers /> Manual Check-in
                  </button>
                </div>
              </div>
              
              {scanResult && (
                <div className={`${styles.scanResult} ${styles[scanResult.type]}`}>
                  {scanResult.message}
                </div>
              )}

              {/* Quick Stats */}
              <div className={styles.checkInStats}>
                <div className={styles.statItem}>
                  <FaCheckCircle />
                  <span>{realTimeStats.checkedInCount} Checked In</span>
                </div>
                <div className={styles.statItem}>
                  <FaClock />
                  <span>{realTimeStats.pendingCheckIn} Pending</span>
                </div>
                <div className={styles.statItem}>
                  <FaUsers />
                  <span>{Math.round((realTimeStats.checkedInCount / (attendees.length || 1)) * 100)}% Attendance</span>
                </div>
              </div>
            </div>

            {/* Pending Check-ins */}
            <div className={styles.section}>
              <h3>Pending Check-ins ({realTimeStats.pendingCheckIn})</h3>
              <div className={styles.pendingList}>
                {attendees.filter(a => !a.checkedIn).slice(0, 10).map((attendee) => (
                  <div key={attendee.id} className={styles.pendingItem}>
                    <div className={styles.attendeeInfo}>
                      <h4>{attendee.name}</h4>
                      <p>{attendee.email}</p>
                    </div>
                    <div className={styles.ticketInfo}>
                      {attendee.canCheckInIndependently && attendee.ticketType ? (
                        <span className={styles.ticketBadge}>
                          {attendee.ticketType}: 1
                          {attendee.ticketIndex && attendee.totalTicketsInBooking && attendee.totalTicketsInBooking > 1 && (
                            <span className={styles.ticketIndex}> (#{attendee.ticketIndex}/{attendee.totalTicketsInBooking})</span>
                          )}
                        </span>
                      ) : typeof attendee.tickets === 'object' ? (
                        Object.entries(attendee.tickets).map(([type, count]) => (
                          <span key={type} className={styles.ticketBadge}>
                            {type}: {count}
                          </span>
                        ))
                      ) : (
                        <span className={styles.ticketBadge}>
                          Activity: {attendee.tickets}
                        </span>
                      )}
                    </div>
                    <div className={styles.pendingActions}>
                      <span className={`${styles.statusBadge} ${styles.pending}`}>
                        <FaClock /> Pending
                      </span>
                      <button 
                        className={styles.quickCheckInButton}
                        onClick={() => handleManualCheckIn(attendee)}
                        title="Quick check-in"
                      >
                        <FaUserCheck />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className={styles.settingsTab}>
            <div className={styles.section}>
              <h3>Event Management</h3>
              <p>Manage your event settings and configuration</p>
              
              <div className={styles.settingsGrid}>
                {/* Event Actions */}
                <div className={styles.settingsCard}>
                  <div className={styles.settingsCardHeader}>
                    <FaEdit className={styles.settingsIcon} />
                    <h4>Edit Event</h4>
                  </div>
                  <p>Update event details, schedule, tickets, and venue information</p>
                  <button 
                    className={styles.settingsButton}
                    onClick={handleEdit}
                  >
                    <FaEdit /> Edit Event Details
                  </button>
                </div>



                {/* Analytics Export */}
                <div className={styles.settingsCard}>
                  <div className={styles.settingsCardHeader}>
                    <FaDownload className={styles.settingsIcon} />
                    <h4>Export Data</h4>
                  </div>
                  <p>Download attendee lists, revenue reports, and analytics</p>
                  <div className={styles.exportControls}>
                    <button className={styles.exportButton}>
                      <FaFileExcel /> Attendees CSV
                    </button>
                    <button className={styles.exportButton}>
                      <FaFilePdf /> Revenue Report
                    </button>
                  </div>
                </div>



                {/* Event URL & Sharing */}
                <div className={styles.settingsCard}>
                  <div className={styles.settingsCardHeader}>
                    <FaShare className={styles.settingsIcon} />
                    <h4>Share Event</h4>
                  </div>
                  <p>Get shareable links and promotional materials</p>
                  <div className={styles.shareControls}>
                    <div className={styles.urlBox}>
                      <input 
                        type="text" 
                        value={`https://zest.com/event-profile/${eventId}`}
                        readOnly
                        className={styles.urlInput}
                      />
                      <button className={styles.copyButton}>
                        <FaCopy />
                      </button>
                    </div>
                    <button className={styles.shareButton}>
                      <FaShare /> Generate QR Code
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className={styles.section}>
              <div className={styles.dangerZone}>
                <h3>⚠️ Danger Zone</h3>
                <p>These actions cannot be undone. Please proceed with caution.</p>
                
                <div className={styles.dangerActions}>
                  <button 
                    className={styles.dangerButton}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <FaTrash /> Delete Event Permanently
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'manage-tickets' && (
          <div className={styles.manageTicketsTab}>
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>Ticket Management</h3>
                <p>Update ticket capacities, prices, and add new ticket types</p>
              </div>
              
              {ticketUpdateResult && (
                <div className={`${styles.updateResult} ${styles[ticketUpdateResult.type]}`}>
                  {ticketUpdateResult.message}
                </div>
              )}

              {/* Current Tickets Management */}
              <div className={styles.currentTickets}>
                <h4>Current Ticket Types</h4>
                <div className={styles.ticketManagementList}>
                  {eventData?.tickets.map((ticket, index) => {
                    const soldCount = calculateSoldTickets(ticket.name);
                    const availableCount = ticket.capacity - soldCount;
                    const salesPercentage = (soldCount / ticket.capacity) * 100;
                    
                    return (
                      <div key={index} className={styles.ticketManagementItem}>
                        <div className={styles.ticketHeader}>
                          <div className={styles.ticketInfo}>
                            <h5>{ticket.name}</h5>
                            <div className={styles.ticketMetrics}>
                              <span className={styles.metric}>
                                <strong>{soldCount}</strong> sold of <strong>{ticket.capacity}</strong>
                              </span>
                              <span className={styles.metric}>
                                <strong>₹{ticket.price}</strong> per ticket
                              </span>
                              <span className={`${styles.metric} ${availableCount <= 5 ? styles.lowStock : ''}`}>
                                <strong>{availableCount}</strong> remaining
                              </span>
                            </div>
                          </div>
                          <div className={styles.ticketProgress}>
                            <div className={styles.progressBar}>
                              <div 
                                className={styles.progress}
                                style={{ width: `${Math.min(salesPercentage, 100)}%` }}
                              ></div>
                            </div>
                            <span className={styles.progressText}>
                              {Math.round(salesPercentage)}% sold
                            </span>
                          </div>
                        </div>

                        <div className={styles.ticketActions}>
                          <div className={styles.actionGroup}>
                            <label>Capacity</label>
                            <div className={styles.capacityInput}>
                              <input
                                type="number"
                                min={soldCount}
                                max="10000"
                                defaultValue={ticket.capacity}
                                onBlur={(e) => {
                                  const newCapacity = parseInt(e.target.value);
                                  if (newCapacity !== ticket.capacity && newCapacity >= soldCount) {
                                    handleUpdateTicketCapacity(index, newCapacity);
                                  }
                                }}
                                disabled={ticketUpdating === index.toString()}
                              />
                              {ticketUpdating === index.toString() && (
                                <span className={styles.updating}>Updating...</span>
                              )}
                            </div>
                          </div>

                          <div className={styles.actionGroup}>
                            <label>Price (₹)</label>
                            <div className={styles.priceInput}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={ticket.price}
                                onBlur={(e) => {
                                  const newPrice = parseFloat(e.target.value);
                                  if (newPrice !== ticket.price && newPrice >= 0) {
                                    handleUpdateTicketPrice(index, newPrice);
                                  }
                                }}
                                disabled={ticketUpdating === `price-${index}`}
                              />
                              {ticketUpdating === `price-${index}` && (
                                <span className={styles.updating}>Updating...</span>
                              )}
                            </div>
                          </div>

                          {soldCount === 0 && permissions.canDelete && (
                            <button
                              className={styles.deleteTicketButton}
                              onClick={() => handleDeleteTicket(index)}
                              disabled={ticketUpdating === `delete-${index}`}
                              title="Delete ticket type"
                            >
                              {ticketUpdating === `delete-${index}` ? (
                                <FaSyncAlt className={styles.spinning} />
                              ) : (
                                <FaTrash />
                              )}
                            </button>
                          )}
                        </div>

                        {soldCount > 0 && (
                          <div className={styles.ticketWarning}>
                            <span>⚠️ Cannot delete - {soldCount} tickets already sold</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add New Ticket Type */}
              {permissions.canEdit && (
                <div className={styles.addNewTicket}>
                  <h4>Add New Ticket Type</h4>
                  <div className={styles.newTicketForm}>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>Ticket Name</label>
                        <input
                          type="text"
                          placeholder="e.g., VIP, Early Bird, Student"
                          value={newTicket.name}
                          onChange={(e) => setNewTicket({...newTicket, name: e.target.value})}
                          disabled={ticketUpdating === 'new'}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Capacity</label>
                        <input
                          type="number"
                          placeholder="100"
                          min="1"
                          max="10000"
                          value={newTicket.capacity}
                          onChange={(e) => setNewTicket({...newTicket, capacity: e.target.value})}
                          disabled={ticketUpdating === 'new'}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Price (₹)</label>
                        <input
                          type="number"
                          placeholder="0"
                          min="0"
                          step="0.01"
                          value={newTicket.price}
                          onChange={(e) => setNewTicket({...newTicket, price: e.target.value})}
                          disabled={ticketUpdating === 'new'}
                        />
                      </div>

                      <button
                        className={styles.addTicketButton}
                        onClick={handleAddNewTicket}
                        disabled={ticketUpdating === 'new' || !newTicket.name || !newTicket.capacity || !newTicket.price}
                      >
                        {ticketUpdating === 'new' ? (
                          <>
                            <FaSyncAlt className={styles.spinning} />
                            Adding...
                          </>
                        ) : (
                          <>
                            <FaTicketAlt />
                            Add Ticket
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Ticket Management Guidelines */}
              <div className={styles.guidelines}>
                <h4>🛡️ Security Guidelines</h4>
                <ul>
                  <li><strong>Capacity Changes:</strong> You cannot reduce capacity below the number of already sold tickets</li>
                  <li><strong>Price Updates:</strong> Price changes apply to new bookings only - existing tickets retain their original price</li>
                  <li><strong>Deletion:</strong> Ticket types with existing sales cannot be deleted</li>
                  <li><strong>Live Updates:</strong> All changes are immediately reflected in booking availability</li>
                  <li><strong>Audit Trail:</strong> All ticket management actions are logged with timestamps</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Manual Attendee Addition Modal */}
      {showManualAttendeeForm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Add Attendee Manually</h3>
              <button 
                className={styles.closeButton}
                onClick={resetManualAttendeeForm}
              >
                <FaTimesCircle />
              </button>
            </div>
            
            <div className={styles.manualAttendeeFormContent}>
              <p className={styles.formDescription}>
                Add an attendee manually. If they already have an account with this phone number, 
                the ticket will be added to their account. Otherwise, it will be linked when they create an account.
              </p>

              {manualAttendeeResult && (
                <div className={`${styles.formResult} ${styles[manualAttendeeResult.type]}`}>
                  {manualAttendeeResult.message}
                </div>
              )}

              <form className={styles.manualAttendeeForm} onSubmit={(e) => e.preventDefault()}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="attendeeName">Full Name *</label>
                    <input
                      id="attendeeName"
                      type="text"
                      placeholder="Enter attendee's full name"
                      value={manualAttendeeData.name}
                      onChange={(e) => setManualAttendeeData({...manualAttendeeData, name: e.target.value})}
                      disabled={manualAttendeeLoading}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="attendeeEmail">Email Address *</label>
                    <input
                      id="attendeeEmail"
                      type="email"
                      placeholder="Enter attendee's email"
                      value={manualAttendeeData.email}
                      onChange={(e) => setManualAttendeeData({...manualAttendeeData, email: e.target.value})}
                      disabled={manualAttendeeLoading}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="attendeePhone">Phone Number *</label>
                    <input
                      id="attendeePhone"
                      type="tel"
                      placeholder="+91XXXXXXXXXX or XXXXXXXXXX"
                      value={manualAttendeeData.phone}
                      onChange={(e) => setManualAttendeeData({...manualAttendeeData, phone: e.target.value})}
                      disabled={manualAttendeeLoading}
                      required
                    />
                    <span className={styles.fieldHint}>
                      Used to link ticket to their account when they sign up
                    </span>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="ticketType">Ticket Type *</label>
                    <select
                      id="ticketType"
                      value={manualAttendeeData.ticketType}
                      onChange={(e) => setManualAttendeeData({...manualAttendeeData, ticketType: e.target.value})}
                      disabled={manualAttendeeLoading}
                      required
                    >
                      <option value="">Select ticket type</option>
                      {eventData?.tickets.map((ticket) => {
                        const soldCount = calculateSoldTickets(ticket.name);
                        const available = ticket.capacity - soldCount;
                        return (
                          <option 
                            key={ticket.name} 
                            value={ticket.name}
                            disabled={available <= 0}
                          >
                            {ticket.name} - ₹{ticket.price} {available <= 0 ? '(Sold Out)' : `(${available} left)`}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="timeSlot">Time Slot *</label>
                    <select
                      id="timeSlot"
                      value={manualAttendeeData.selectedTimeSlot ? JSON.stringify(manualAttendeeData.selectedTimeSlot) : ''}
                      onChange={(e) => setManualAttendeeData({...manualAttendeeData, selectedTimeSlot: e.target.value ? JSON.parse(e.target.value) : null})}
                      disabled={manualAttendeeLoading}
                      required
                    >
                      <option value="">Select time slot</option>
                      {eventData?.time_slots?.map((slot, index) => {
                        const slotDate = new Date(slot.date);
                        const now = new Date();
                        const isPast = slotDate < now;
                        return (
                          <option 
                            key={index} 
                            value={JSON.stringify(slot)}
                            disabled={isPast}
                          >
                            {new Date(slot.date).toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric' 
                            })} - {slot.start_time} to {slot.end_time} {isPast ? '(Past)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    <span className={styles.fieldHint}>
                      Select which session/time slot this attendee will attend
                    </span>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="quantity">Number of Tickets *</label>
                    <input
                      id="quantity"
                      type="number"
                      min="1"
                      max="50"
                      placeholder="1"
                      value={manualAttendeeData.quantity}
                      onChange={(e) => setManualAttendeeData({...manualAttendeeData, quantity: parseInt(e.target.value) || 1})}
                      disabled={manualAttendeeLoading}
                      required
                    />
                    <span className={styles.fieldHint}>
                      Maximum 50 tickets per addition
                    </span>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Total Amount</label>
                    <div className={styles.totalAmountDisplay}>
                      {manualAttendeeData.ticketType && eventData?.tickets.find(t => t.name === manualAttendeeData.ticketType) ? (
                        <span className={styles.totalAmount}>
                          ₹{(eventData.tickets.find(t => t.name === manualAttendeeData.ticketType)!.price * manualAttendeeData.quantity).toLocaleString()}
                        </span>
                      ) : (
                        <span className={styles.totalAmountPlaceholder}>Select ticket type</span>
                      )}
                    </div>
                    <span className={styles.fieldHint}>
                      {manualAttendeeData.quantity} × ₹{eventData?.tickets.find(t => t.name === manualAttendeeData.ticketType)?.price || 0}
                    </span>
                  </div>
                </div>

                <div className={styles.formInfo}>
                  <div className={styles.infoBox}>
                    <FaUsers />
                    <div>
                      <h4>How it works:</h4>
                      <ul>
                        <li>✅ Check if account exists with phone number</li>
                        <li>🎫 Generate multiple tickets and QR codes (if quantity {'>'}1)</li>
                        <li>🔗 Link to existing account OR associate with phone for future linking</li>
                        <li>📧 Each ticket can be checked in independently via QR scan or manual search</li>
                        <li>👥 Multiple tickets for same person create individual attendee records</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            <div className={styles.modalActions}>
              <button 
                className={styles.cancelButton}
                onClick={resetManualAttendeeForm}
                disabled={manualAttendeeLoading}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmButton}
                onClick={handleManualAttendeeAdd}
                disabled={manualAttendeeLoading || !manualAttendeeData.name || !manualAttendeeData.email || !manualAttendeeData.phone || !manualAttendeeData.ticketType || !manualAttendeeData.selectedTimeSlot || !manualAttendeeData.quantity || manualAttendeeData.quantity < 1}
              >
                {manualAttendeeLoading ? (
                  <>
                    <FaSyncAlt className={styles.spinning} />
                    Adding Attendee...
                  </>
                ) : (
                  <>
                    <FaUserPlus />
                    Add Attendee
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Check-in Modal */}
      {showManualCheckIn && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Manual Check-in</h3>
              <button 
                className={styles.closeButton}
                onClick={() => {
                  setShowManualCheckIn(false);
                  setManualCheckInSearch('');
                  setSelectedAttendeeForCheckIn(null);
                }}
              >
                <FaTimesCircle />
              </button>
            </div>
            
            <div className={styles.searchContainer}>
              <div className={styles.searchBox}>
                <FaSearch />
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={manualCheckInSearch}
                  onChange={(e) => setManualCheckInSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className={styles.attendeeSearchResults}>
              {manualCheckInSearch && (
                <div className={styles.searchInfo}>
                  Found {searchableAttendees.length} attendees awaiting check-in
                </div>
              )}
              
              {searchableAttendees.slice(0, 10).map((attendee) => (
                <div key={attendee.id} className={styles.searchResultItem}>
                  <div className={styles.attendeeDetails}>
                    <h4>{attendee.name}</h4>
                    <p>{attendee.email}</p>
                    <p>{attendee.phone}</p>
                    <div className={styles.ticketInfo}>
                      {Object.entries(attendee.tickets).map(([type, count]) => (
                        <span key={type} className={styles.ticketBadge}>
                          {type}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <button 
                    className={styles.checkInButton}
                    onClick={() => handleManualCheckIn(attendee)}
                  >
                    <FaUserCheck /> Check In
                  </button>
                </div>
              ))}

              {manualCheckInSearch && searchableAttendees.length === 0 && (
                <div className={styles.noResults}>
                  <FaUsers />
                  <p>No attendees found matching "{manualCheckInSearch}"</p>
                  <span>Try searching by name, email, or phone number</span>
                </div>
              )}

              {!manualCheckInSearch && (
                <div className={styles.searchPlaceholder}>
                  <FaSearch />
                  <p>Start typing to search for attendees</p>
                  <span>{realTimeStats.pendingCheckIn} attendees awaiting check-in</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>⚠️ Delete Event</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowDeleteConfirm(false)}
              >
                <FaTimesCircle />
              </button>
            </div>
            
            <div className={styles.deleteConfirmContent}>
              <div className={styles.warningIcon}>
                <FaExclamationTriangle />
              </div>
              
              <h4>Are you absolutely sure?</h4>
              <p>
                This action <strong>cannot be undone</strong>. This will permanently delete the event 
                <strong> "{eventData?.title}"</strong> and remove all associated data including:
              </p>
              
              <ul className={styles.deleteList}>
                <li>All attendee registrations ({attendees.length} attendees)</li>
                <li>All generated tickets ({tickets.length} tickets)</li>
                <li>Payment records and transaction history</li>
                <li>Event analytics and reports</li>
                <li>All uploaded images and files</li>
              </ul>
              
              <div className={styles.confirmSection}>
                <p>
                  Type <code>DELETE</code> below to confirm:
                </p>
                <input
                  type="text"
                  className={styles.confirmInput}
                  placeholder="Type DELETE to confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                />
              </div>
            </div>
            
            <div className={styles.modalActions}>
              <button 
                className={styles.cancelButton}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmDeleteButton}
                onClick={handleDelete}
                disabled={deleteConfirmText !== 'DELETE' || loading}
              >
                {loading ? 'Deleting...' : 'Delete Event Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDashboard; 