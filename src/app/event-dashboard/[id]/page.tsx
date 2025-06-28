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
  FaUserPlus,
  FaArrowLeft,
  FaLayerGroup,
  FaChevronRight,
  FaPercentage
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
  tickets: Record<string, number> | number;
  selectedDate: string;
  selectedTimeSlot: TimeSlot;
  selectedSession?: EventSession;
  sessionId?: string;
  createdAt: string;
  status?: string;
  paymentStatus?: string;
  checkedIn?: boolean;
  checkInTime?: string;
  ticketIds?: string[];
  userId?: string;
  eventId?: string;
  ticketType?: string;
  ticketIndex?: number;
  totalTicketsInBooking?: number;
  individualAmount?: number;
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
  sessionId?: string;
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
  
  // NEW: Session-centric states
  const [selectedSession, setSelectedSession] = useState<EventSession | null>(null);
  const [showSessionSelector, setShowSessionSelector] = useState(true);
  
  // State management
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [sessionAttendees, setSessionAttendees] = useState<Attendee[]>([]);
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
  const [sessionTickets, setSessionTickets] = useState<Ticket[]>([]);
  
  // Real-time data for selected session
  const [sessionStats, setSessionStats] = useState({
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
  const [qrScannerSupported, setQrScannerSupported] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Loading and Undo states
  const [checkInLoading, setCheckInLoading] = useState<string | null>(null); // attendeeId being processed
  const [recentCheckIn, setRecentCheckIn] = useState<{attendee: Attendee, timestamp: Date} | null>(null);
  const [undoLoading, setUndoLoading] = useState(false);
  
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

  // Remove complex analytics state - keep it simple
  const [showBasicStats, setShowBasicStats] = useState(true);

  // Check QR scanner support on mount
  useEffect(() => {
    const checkQRSupport = async () => {
      try {
        // Check if BarcodeDetector is supported
        if ('BarcodeDetector' in window) {
          setQrScannerSupported(true);
        } else {
          console.log('BarcodeDetector not supported, will use manual input fallback');
          setQrScannerSupported(false);
        }
      } catch (error) {
        console.log('QR scanner not supported:', error);
        setQrScannerSupported(false);
      }
    };

    checkQRSupport();
  }, []);

  // Start QR scanner
  const startQRScanner = async () => {
    if (!qrScannerSupported) {
      setScanResult({
        type: 'info',
        message: 'QR scanning not supported on this device. Use manual check-in instead.'
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera
      });
      
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setScannerActive(true);
      setScanResult({
        type: 'info',
        message: 'QR scanner started. Point camera at attendee QR code.'
      });

      // Start scanning for QR codes
      startBarcodeDetection(stream);
      
    } catch (error) {
      console.error('Error starting camera:', error);
      setScanResult({
        type: 'error',
        message: 'Could not access camera. Please ensure camera permissions are granted.'
      });
    }
  };

  // Stop QR scanner
  const stopQRScanner = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setScannerActive(false);
    setScanResult(null);
  };

  // Barcode detection
  const startBarcodeDetection = async (stream: MediaStream) => {
    if (!('BarcodeDetector' in window)) return;

    try {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['qr_code']
      });

      const detectBarcodes = async () => {
        if (videoRef.current && scannerActive) {
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            
            if (barcodes.length > 0) {
              const qrData = barcodes[0].rawValue;
              await processQRCode(qrData);
            }
            
            // Continue scanning if still active
            if (scannerActive) {
              requestAnimationFrame(detectBarcodes);
            }
          } catch (error) {
            // Continue scanning even if detection fails
            if (scannerActive) {
              requestAnimationFrame(detectBarcodes);
            }
          }
        }
      };

      // Start detection loop
      detectBarcodes();
      
    } catch (error) {
      console.error('Error setting up barcode detection:', error);
      setScanResult({
        type: 'error',
        message: 'Error setting up QR scanner. Please use manual check-in.'
      });
    }
  };

  // Process scanned QR code
  const processQRCode = async (qrData: string) => {
    try {
      // Parse QR data - assuming it contains ticket ID or attendee info
      let ticketId = '';
      let attendeeId = '';
      
      try {
        // Try parsing as JSON first
        const qrJson = JSON.parse(qrData);
        ticketId = qrJson.ticketId || qrJson.id || '';
        attendeeId = qrJson.attendeeId || '';
      } catch {
        // If not JSON, treat as plain ticket ID
        ticketId = qrData;
      }

      if (!ticketId) {
        setScanResult({
          type: 'error',
          message: 'Invalid QR code format'
        });
        return;
      }

      // Find attendee by ticket ID or attendee ID
      const attendee = sessionAttendees.find(a => 
        a.id === attendeeId || 
        a.ticketIds?.includes(ticketId) ||
        a.id === ticketId ||
        a.email.includes(ticketId) // Fallback for email-based lookup
      );

      if (!attendee) {
        setScanResult({
          type: 'error',
          message: `No attendee found for this ticket (${ticketId})`
        });
        return;
      }

      // Stop scanner and process check-in
      stopQRScanner();
      await handleSessionCheckIn(attendee);
      
    } catch (error) {
      console.error('Error processing QR code:', error);
      setScanResult({
        type: 'error',
        message: 'Error processing QR code. Please try manual check-in.'
      });
    }
  };

  // Helper functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000/01/01 ${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // NEW: Session selection handler
  const handleSessionSelect = (session: EventSession) => {
    setSelectedSession(session);
    setShowSessionSelector(false);
    setActiveTab('overview');
    
    // Set up real-time listeners for this session
    if (permissions.canView && eventId) {
      setupRealTimeAttendees();
      setupRealTimeTickets();
    }
  };

  // NEW: Update session-specific statistics
  const updateSessionStats = useCallback((session: EventSession, sessionAttendees: Attendee[], sessionTickets: Ticket[]) => {
    if (!session) return;

    const totalCapacity = session.tickets.reduce((sum, ticket) => sum + ticket.capacity, 0);
    const soldTickets = sessionAttendees.length;
    
    // Calculate revenue for this session
    const revenue = sessionAttendees.reduce((sum, attendee) => {
      // Try individualAmount first (for new individual records)
      if (attendee.individualAmount) {
        return sum + attendee.individualAmount;
      }
      
      // Calculate from ticket prices for group bookings or legacy records
      if (typeof attendee.tickets === 'object') {
        return sum + Object.entries(attendee.tickets).reduce((ticketSum, [ticketName, count]) => {
          const ticket = session.tickets.find(t => t.name === ticketName);
          return ticketSum + (ticket ? ticket.price * Number(count) : 0);
        }, 0);
      }
      
      // For legacy single ticket bookings
      if (typeof attendee.tickets === 'number' && session.tickets.length > 0) {
        return sum + (session.tickets[0].price * attendee.tickets);
      }
      
      // Fallback: try to get from originalBookingData
      if (attendee.originalBookingData?.originalTotalAmount) {
        return sum + attendee.originalBookingData.originalTotalAmount;
      }
      
      return sum;
    }, 0);

    const checkedInCount = sessionAttendees.filter(attendee => attendee.checkedIn).length;
    const pendingCheckIn = sessionAttendees.length - checkedInCount;

    setSessionStats({
      totalRevenue: revenue,
      soldTickets,
      availableTickets: totalCapacity - soldTickets,
      totalCapacity,
      checkedInCount,
      pendingCheckIn,
      lastUpdated: new Date()
    });
  }, []);

  // Initialize dashboard
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
      const eventDoc = await getDoc(doc(db, "events", eventId));
      if (eventDoc.exists()) {
        const data = eventDoc.data() as EventData;
        setEventData({ ...data, id: eventDoc.id });
        
        // For session-centric events, show session selector
        if (data.architecture === 'session-centric' && data.sessions && data.sessions.length > 0) {
          setShowSessionSelector(true);
        } else {
          // For legacy events, set showSessionSelector to false and handle normally
          setShowSessionSelector(false);
        }
      } else {
        setError("Event not found");
      }
    } catch (err) {
      console.error("Error fetching event data:", err);
      setError("Failed to load event data");
    }
  };

  // Set up real-time listeners
  useEffect(() => {
    if (permissions.canView && eventId && !loading) {
      // For session-centric events showing session selector, get all attendees for stats
      if (eventData?.architecture === 'session-centric' && showSessionSelector) {
        // Set up basic attendees listener to populate session selector stats
        setupSessionSelectorAttendees();
        return;
      }
      
      // For selected session or legacy events, set up full listeners
      setupRealTimeAttendees();
      setupRealTimeTickets();
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (unsubscribeAttendees.current) {
        unsubscribeAttendees.current();
        unsubscribeAttendees.current = null;
      }
      if (unsubscribeTickets.current) {
        unsubscribeTickets.current();
        unsubscribeTickets.current = null;
      }
    };
  }, [permissions.canView, eventId, loading, showSessionSelector, selectedSession?.id]);

  // Real-time attendees fetching for session selector
  const setupSessionSelectorAttendees = useCallback(() => {
    if (!eventId || !permissions.canView) return;

    // Clean up existing listener
    if (unsubscribeAttendees.current) {
      unsubscribeAttendees.current();
    }

    // Get all attendees for the event to populate session selector stats
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
        setLastRefresh(new Date());
      },
      (error) => {
        console.error("Error in session selector attendees listener:", error);
        setError(`Failed to load attendees: ${error.message}`);
      }
    );

    unsubscribeAttendees.current = unsubscribe;
    return unsubscribe;
  }, [eventId, permissions.canView]);

  // Real-time attendees fetching
  const setupRealTimeAttendees = useCallback(() => {
    if (!eventId || !permissions.canView) return;

    // Clean up existing listener
    if (unsubscribeAttendees.current) {
      unsubscribeAttendees.current();
    }

    const attendeesRef = collection(db, 'eventAttendees');
    let attendeesQuery;

    // For session-centric events with selected session, filter by session
    if (selectedSession && eventData?.architecture === 'session-centric') {
      // Query by sessionId for efficiency, with fallback filters
      attendeesQuery = query(
        attendeesRef,
        where('eventId', '==', eventId),
        where('sessionId', '==', selectedSession.id),
        orderBy('createdAt', 'desc')
      );
    } else {
      // For legacy events or when no session selected, get all attendees
      attendeesQuery = query(
        attendeesRef,
        where('eventId', '==', eventId),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(
      attendeesQuery,
      (snapshot) => {
        const attendeesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Attendee[];
        
        // For session-centric events, apply additional client-side filtering as a safety net
        if (selectedSession && eventData?.architecture === 'session-centric') {
          const sessionAttendeesFiltered = attendeesList.filter(attendee => {
            // Primary filter: sessionId match (this should be the main filter now)
            if (attendee.sessionId === selectedSession.id) {
              return true;
            }
            
            // Fallback filters for backward compatibility with old records
            if (attendee.selectedSession?.id === selectedSession.id) {
              return true;
            }
            
            // Final fallback: match by date and time
            if (attendee.selectedDate === selectedSession.date && 
                attendee.selectedTimeSlot?.start_time === selectedSession.start_time) {
              return true;
            }
            
            return false;
          });
          
          console.log(`Session ${selectedSession.id}: Found ${sessionAttendeesFiltered.length} attendees`, {
            totalQueried: attendeesList.length,
            sessionFiltered: sessionAttendeesFiltered.length,
            sessionId: selectedSession.id
          });
          
          setSessionAttendees(sessionAttendeesFiltered);
          setAttendees(attendeesList); // Keep full list for stats calculation
          updateSessionStats(selectedSession, sessionAttendeesFiltered, sessionTickets);
        } else {
          setAttendees(attendeesList);
          setSessionAttendees(attendeesList);
        }
        
        setLastRefresh(new Date());
      },
      (error) => {
        console.error("Error in real-time attendees listener:", error);
        
        // If the sessionId query fails (e.g., missing index), fallback to basic query
        if (error.code === 'failed-precondition' && selectedSession && eventData?.architecture === 'session-centric') {
          console.warn('SessionId query failed, falling back to basic query with client-side filtering');
          
          // Fallback: Query all attendees for the event and filter client-side
          const fallbackQuery = query(
            attendeesRef,
            where('eventId', '==', eventId),
            orderBy('createdAt', 'desc')
          );
          
          const fallbackUnsubscribe = onSnapshot(
            fallbackQuery,
            (snapshot) => {
              const allAttendees = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Attendee[];
              
              // Filter for selected session client-side
              const sessionAttendees = allAttendees.filter(attendee => {
                return attendee.sessionId === selectedSession.id ||
                       attendee.selectedSession?.id === selectedSession.id ||
                       (attendee.selectedDate === selectedSession.date && 
                        attendee.selectedTimeSlot?.start_time === selectedSession.start_time);
              });
              
              console.log(`Fallback filtering for session ${selectedSession.id}:`, {
                total: allAttendees.length,
                filtered: sessionAttendees.length
              });
              
              setSessionAttendees(sessionAttendees);
              setAttendees(allAttendees);
              updateSessionStats(selectedSession, sessionAttendees, sessionTickets);
              setLastRefresh(new Date());
            },
            (fallbackError) => {
              console.error("Fallback query also failed:", fallbackError);
              setError(`Database query failed: ${fallbackError.message}`);
            }
          );
          
          unsubscribeAttendees.current = fallbackUnsubscribe;
          return;
        }
        
        setError(error.message);
      }
    );

    unsubscribeAttendees.current = unsubscribe;
    return unsubscribe;
  }, [eventId, permissions.canView, selectedSession, sessionTickets, updateSessionStats, eventData?.architecture]);

  // Real-time tickets fetching
  const setupRealTimeTickets = useCallback(() => {
    if (!eventId || !permissions.canView) return;

    // Clean up existing listener
    if (unsubscribeTickets.current) {
      unsubscribeTickets.current();
    }

    const ticketsRef = collection(db, 'tickets');
    let ticketsQuery;

    // For session-centric events with selected session, filter by session
    if (selectedSession && eventData?.architecture === 'session-centric') {
      ticketsQuery = query(
        ticketsRef,
        where('eventId', '==', eventId),
        where('sessionId', '==', selectedSession.id)
      );
    } else {
      // For legacy events or when no session selected, get all tickets
      ticketsQuery = query(
        ticketsRef,
        where('eventId', '==', eventId)
      );
    }

    const unsubscribe = onSnapshot(
      ticketsQuery,
      (snapshot) => {
        const ticketsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Ticket[];
        
        // For session-centric events, apply additional client-side filtering as a safety net
        if (selectedSession && eventData?.architecture === 'session-centric') {
          const sessionTicketsFiltered = ticketsList.filter(ticket => {
            // Primary filter: sessionId match
            if (ticket.sessionId === selectedSession.id) {
              return true;
            }
            
            // Fallback filters for backward compatibility
            if (ticket.selectedDate === selectedSession.date && 
                ticket.selectedTimeSlot?.start_time === selectedSession.start_time) {
              return true;
            }
            
            return false;
          });
          
          console.log(`Session ${selectedSession.id}: Found ${sessionTicketsFiltered.length} tickets`, {
            totalQueried: ticketsList.length,
            sessionFiltered: sessionTicketsFiltered.length
          });
          
          setSessionTickets(sessionTicketsFiltered);
          setTickets(ticketsList); // Keep full list for stats calculation
          updateSessionStats(selectedSession, sessionAttendees, sessionTicketsFiltered);
        } else {
          setTickets(ticketsList);
          setSessionTickets(ticketsList);
        }
      },
      (error) => {
        console.error("Error in real-time tickets listener:", error);
        
        // If the sessionId query fails, fallback to basic query
        if (error.code === 'failed-precondition' && selectedSession && eventData?.architecture === 'session-centric') {
          console.warn('SessionId ticket query failed, falling back to basic query with client-side filtering');
          
          const fallbackQuery = query(
            ticketsRef,
            where('eventId', '==', eventId)
          );
          
          const fallbackUnsubscribe = onSnapshot(
            fallbackQuery,
            (snapshot) => {
              const allTickets = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Ticket[];
              
              // Filter for selected session client-side
              const sessionTickets = allTickets.filter(ticket => {
                return ticket.sessionId === selectedSession.id ||
                       (ticket.selectedDate === selectedSession.date && 
                        ticket.selectedTimeSlot?.start_time === selectedSession.start_time);
              });
              
              console.log(`Fallback ticket filtering for session ${selectedSession.id}:`, {
                total: allTickets.length,
                filtered: sessionTickets.length
              });
              
              setSessionTickets(sessionTickets);
              setTickets(allTickets);
              updateSessionStats(selectedSession, sessionAttendees, sessionTickets);
            },
            (fallbackError) => {
              console.error("Fallback ticket query also failed:", fallbackError);
            }
          );
          
          unsubscribeTickets.current = fallbackUnsubscribe;
          return;
        }
      }
    );

    unsubscribeTickets.current = unsubscribe;
    return unsubscribe;
  }, [eventId, permissions.canView, selectedSession, sessionAttendees, updateSessionStats, eventData?.architecture]);

  // Handle manual refresh
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

  // Handle check-in for session-specific attendee with validation, loading, and undo
  const handleSessionCheckIn = async (attendee: Attendee) => {
    if (!permissions.canManageAttendees) {
      setScanResult({ type: 'error', message: 'You do not have permission to check in attendees' });
      return;
    }

    if (!selectedSession) {
      setScanResult({ type: 'error', message: 'No session selected for check-in' });
      return;
    }

    // Validate attendee before check-in
    if (attendee.checkedIn) {
      setScanResult({ type: 'info', message: `${attendee.name} is already checked in` });
      return;
    }

    if (attendee.status && attendee.status !== 'confirmed') {
      setScanResult({ type: 'error', message: `Cannot check in ${attendee.name}: Ticket status is ${attendee.status}` });
      return;
    }

    // Validate session timing (optional - allow early check-in but warn for late)
    const sessionStartTime = new Date(`${selectedSession.date} ${selectedSession.start_time}`);
    const now = new Date();
    
    if (now.getTime() > sessionStartTime.getTime() + (3 * 60 * 60 * 1000)) { // 3 hours after start
      const confirmLate = window.confirm(`This session started ${Math.floor((now.getTime() - sessionStartTime.getTime()) / (1000 * 60 * 60))} hours ago. Continue with check-in?`);
      if (!confirmLate) return;
    }

    // Set loading state
    setCheckInLoading(attendee.id);
    
    try {
      const attendeeRef = doc(db, 'eventAttendees', attendee.id);
      await updateDoc(attendeeRef, {
        checkedIn: true,
        checkInTime: new Date().toISOString(),
        checkInMethod: 'manual',
        checkedInBy: auth.currentUser?.uid || 'unknown',
        checkInSessionId: selectedSession.id
      });

      // Store for undo functionality
      setRecentCheckIn({
        attendee: { ...attendee, checkedIn: true, checkInTime: new Date().toISOString() },
        timestamp: new Date()
      });

      setScanResult({
        type: 'success',
        message: `${attendee.name} checked in successfully! Undo available for 30 seconds.`
      });

      // Clear undo option after 30 seconds
      setTimeout(() => {
        setRecentCheckIn(null);
      }, 30000);

      setTimeout(() => setScanResult(null), 5000);
    } catch (error) {
      console.error('Error checking in attendee:', error);
      setScanResult({
        type: 'error',
        message: 'Failed to check in attendee. Please try again.'
      });
      setTimeout(() => setScanResult(null), 5000);
    } finally {
      setCheckInLoading(null);
    }
  };

  // Undo check-in functionality
  const handleUndoCheckIn = async () => {
    if (!recentCheckIn || undoLoading) return;

    setUndoLoading(true);
    
    try {
      const attendeeRef = doc(db, 'eventAttendees', recentCheckIn.attendee.id);
      await updateDoc(attendeeRef, {
        checkedIn: false,
        checkInTime: null,
        checkInMethod: null,
        checkedInBy: null,
        checkInSessionId: null
      });

      setScanResult({
        type: 'info',
        message: `Check-in undone for ${recentCheckIn.attendee.name}`
      });

      setRecentCheckIn(null);
      setTimeout(() => setScanResult(null), 3000);
    } catch (error) {
      console.error('Error undoing check-in:', error);
      setScanResult({
        type: 'error',
        message: 'Failed to undo check-in. Please try again.'
      });
      setTimeout(() => setScanResult(null), 5000);
    } finally {
      setUndoLoading(false);
    }
  };

  // Handle edit event
  const handleEdit = () => {
    router.push(`/edit-event/${eventId}`);
  };

  // Handle delete event
  const handleDelete = async () => {
    if (!permissions.canDelete || !eventData) return;

    if (deleteConfirmText !== eventData.title) {
      setError('Event title does not match. Please type the exact event title to confirm deletion.');
      return;
    }

    try {
      // Delete all related data
      await deleteDoc(doc(db, "events", eventId!));
      
      // Redirect to events list
      router.push('/events');
    } catch (error) {
      console.error('Error deleting event:', error);
      setError('Failed to delete event. Please try again.');
    }
  };

  // Export attendees data
  const handleExportAttendees = () => {
    if (!selectedSession && eventData?.architecture === 'session-centric') {
      alert('Please select a session first');
      return;
    }

    const attendeesToExport = selectedSession ? sessionAttendees : attendees;
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Name,Email,Phone,Ticket Type,Check-in Status,Check-in Time,Registration Date\n"
      + attendeesToExport.map(attendee => 
          `"${attendee.name}","${attendee.email}","${attendee.phone}","${attendee.ticketType || 'Standard'}","${attendee.checkedIn ? 'Checked In' : 'Not Checked In'}","${attendee.checkInTime ? new Date(attendee.checkInTime).toLocaleString() : 'N/A'}","${new Date(attendee.createdAt).toLocaleString()}"`
        ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${eventData?.title}_${selectedSession ? selectedSession.name : 'all'}_attendees.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Update session ticket capacity
  const handleUpdateSessionTicket = async (ticketIndex: number, field: 'capacity' | 'price', value: number) => {
    if (!selectedSession || !eventData || !eventData.sessions || !permissions.canEdit) return;

    setTicketUpdating(`${field}-${ticketIndex}`);
    
    try {
      // Find the session in the event data
      const sessionIndex = eventData.sessions.findIndex(s => s.id === selectedSession.id);
      if (sessionIndex === -1) {
        throw new Error('Session not found');
      }

      // Update the session data
      const updatedSessions = [...eventData.sessions];
      const updatedTickets = [...updatedSessions[sessionIndex].tickets];
      
      if (field === 'capacity') {
        const soldCount = sessionAttendees.filter(a => a.ticketType === updatedTickets[ticketIndex].name).length;
        if (value < soldCount) {
          setTicketUpdateResult({
            type: 'error',
            message: `Cannot reduce capacity below ${soldCount} (already sold tickets)`
          });
          return;
        }
        updatedTickets[ticketIndex].capacity = value;
        updatedTickets[ticketIndex].available_capacity = value - soldCount;
      } else {
        updatedTickets[ticketIndex].price = value;
      }

      updatedSessions[sessionIndex].tickets = updatedTickets;

      // Update in database
      await updateDoc(doc(db, 'events', eventId!), {
        sessions: updatedSessions,
        updatedAt: serverTimestamp()
      });

      setTicketUpdateResult({
        type: 'success',
        message: `Ticket ${field} updated successfully!`
      });

      // Refresh event data
      await fetchEventData();

    } catch (error) {
      console.error(`Error updating ticket ${field}:`, error);
      setTicketUpdateResult({
        type: 'error',
        message: `Failed to update ticket ${field}`
      });
    } finally {
      setTicketUpdating(null);
      setTimeout(() => setTicketUpdateResult(null), 3000);
    }
  };

  // Add new ticket type to session
  const handleAddSessionTicket = async () => {
    if (!selectedSession || !eventData || !eventData.sessions || !permissions.canEdit) return;

    if (!newTicket.name.trim() || !newTicket.capacity || !newTicket.price) {
      setTicketUpdateResult({
        type: 'error',
        message: 'Please fill in all ticket fields'
      });
      return;
    }

    setTicketUpdating('new');

    try {
      // Find the session in the event data
      const sessionIndex = eventData.sessions.findIndex(s => s.id === selectedSession.id);
      if (sessionIndex === -1) {
        throw new Error('Session not found');
      }

      // Check for duplicate ticket names
      const sessionTickets = eventData.sessions[sessionIndex].tickets;
      if (sessionTickets.some((t: any) => t.name.toLowerCase() === newTicket.name.trim().toLowerCase())) {
        setTicketUpdateResult({
          type: 'error',
          message: 'Ticket type with this name already exists in this session'
        });
        return;
      }

      // Update the session data
      const updatedSessions = [...eventData.sessions];
      updatedSessions[sessionIndex].tickets.push({
        name: newTicket.name.trim(),
        capacity: parseInt(newTicket.capacity),
        price: parseFloat(newTicket.price),
        available_capacity: parseInt(newTicket.capacity)
      });

      // Update in database
      await updateDoc(doc(db, 'events', eventId!), {
        sessions: updatedSessions,
        updatedAt: serverTimestamp()
      });

      setTicketUpdateResult({
        type: 'success',
        message: 'New ticket type added successfully!'
      });

      setNewTicket({ name: '', capacity: '', price: '' });
      
      // Refresh event data
      await fetchEventData();

    } catch (error) {
      console.error('Error adding new ticket:', error);
      setTicketUpdateResult({
        type: 'error',
        message: 'Failed to add new ticket type'
      });
    } finally {
      setTicketUpdating(null);
      setTimeout(() => setTicketUpdateResult(null), 3000);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={styles.dashboardContainer}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading event dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !permissions.canView) {
    return (
      <div className={styles.dashboardContainer}>
        <div className={styles.errorState}>
          <FaExclamationTriangle />
          <h2>Access Denied</h2>
          <p>{error || "You don't have permission to view this dashboard"}</p>
          <button onClick={() => router.push('/events')} className={styles.backButton}>
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  // Session selector for session-centric events
  if (showSessionSelector && eventData?.architecture === 'session-centric' && eventData.sessions) {
    return (
      <div className={styles.dashboardContainer}>
        <div className={styles.sessionSelectorContainer}>
          <div className={styles.sessionSelectorHeader}>
            <button 
              onClick={() => router.push('/events')} 
              className={styles.backButton}
            >
              <FaArrowLeft /> Back to Events
            </button>
            <div className={styles.eventInfo}>
              <h1>{eventData.title}</h1>
              <p className={styles.eventSubtitle}>
                <FaLayerGroup /> {eventData.sessions.length} Sessions • Select a session to manage
              </p>
            </div>
          </div>

          <div className={styles.sessionsGrid}>
            {eventData.sessions.map((session, index) => {
              // Filter attendees for this specific session
              const sessionAttendeesList = attendees.filter(attendee => {
                // Primary filter: sessionId match
                if (attendee.sessionId === session.id) return true;
                
                // Fallback: selectedSession object match
                if (attendee.selectedSession?.id === session.id) return true;
                
                // Final fallback: date and time match for legacy records
                if (attendee.selectedDate === session.date && 
                    attendee.selectedTimeSlot?.start_time === session.start_time) return true;
                
                return false;
              });

              const sessionAttendeeCount = sessionAttendeesList.length;
              const sessionCapacity = session.maxCapacity || session.tickets.reduce((sum, ticket) => sum + ticket.capacity, 0);
              
              // Calculate revenue for this session with better error handling
              const sessionRevenue = sessionAttendeesList.reduce((sum, attendee) => {
                try {
                  // Try individualAmount first (for new individual records)
                  if (attendee.individualAmount && typeof attendee.individualAmount === 'number') {
                    return sum + attendee.individualAmount;
                  }
                  
                  // Calculate from ticket prices for group bookings or legacy records
                  if (typeof attendee.tickets === 'object' && attendee.tickets) {
                    const ticketRevenue = Object.entries(attendee.tickets).reduce((ticketSum, [ticketName, quantity]) => {
                      const ticket = session.tickets.find(t => t.name === ticketName);
                      const count = Number(quantity);
                      return ticketSum + (ticket && !isNaN(count) ? ticket.price * count : 0);
                    }, 0);
                    return sum + ticketRevenue;
                  }
                  
                  // For legacy single ticket bookings
                  if (typeof attendee.tickets === 'number' && session.tickets.length > 0) {
                    return sum + (session.tickets[0].price * attendee.tickets);
                  }
                  
                  // Fallback: try to get from originalBookingData
                  if (attendee.originalBookingData?.originalTotalAmount && 
                      typeof attendee.originalBookingData.originalTotalAmount === 'number') {
                    return sum + attendee.originalBookingData.originalTotalAmount;
                  }
                  
                  return sum;
                } catch (error) {
                  console.warn('Error calculating revenue for attendee:', attendee.id, error);
                  return sum;
                }
              }, 0);

              return (
                <div
                  key={session.id}
                  className={styles.sessionCard}
                  onClick={() => handleSessionSelect(session)}
                >
                  <div className={styles.sessionCardHeader}>
                    <h3>{session.name}</h3>
                    <span className={styles.sessionDate}>
                      {formatDate(session.date)}
                    </span>
                  </div>
                  
                  <div className={styles.sessionCardContent}>
                    <div className={styles.sessionTime}>
                      <FaClock />
                      <span>{formatTime(session.start_time)} - {formatTime(session.end_time)}</span>
                    </div>
                    
                    {session.venue && session.venue !== eventData.event_venue && (
                      <div className={styles.sessionVenue}>
                        <FaMapMarkerAlt />
                        <span>{session.venue}</span>
                      </div>
                    )}
                    
                    <div className={styles.sessionStats}>
                      <div className={styles.statItem}>
                        <FaUsers />
                        <span>{sessionAttendeeCount} / {sessionCapacity}</span>
                        <small>Attendees</small>
                      </div>
                      <div className={styles.statItem}>
                        <FaMoneyBillWave />
                        <span>₹{sessionRevenue.toLocaleString()}</span>
                        <small>Revenue</small>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.sessionCardFooter}>
                    <span className={styles.manageButton}>
                      Manage Session <FaChevronRight />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Main dashboard view (session-specific or legacy)
  return (
    <div className={styles.dashboardContainer}>
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            {selectedSession ? (
              <button 
                onClick={() => setShowSessionSelector(true)} 
                className={styles.backButton}
              >
                <FaArrowLeft /> Back to Sessions
              </button>
            ) : (
              <button 
                onClick={() => router.push('/events')} 
                className={styles.backButton}
              >
                <FaArrowLeft /> Back to Events
              </button>
            )}
            <div className={styles.eventTitleSection}>
              <h1>{eventData?.title}</h1>
              {selectedSession && (
                <div className={styles.sessionBreadcrumb}>
                  <FaLayerGroup />
                  <span>{selectedSession.name}</span>
                  <span className={styles.sessionDate}>
                    {formatDate(selectedSession.date)} • {formatTime(selectedSession.start_time)} - {formatTime(selectedSession.end_time)}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className={styles.headerRight}>
            <button 
              onClick={handleRefresh}
              className={`${styles.refreshButton} ${refreshing ? styles.refreshing : ''}`}
              disabled={refreshing}
            >
              <FaSyncAlt />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <span className={styles.lastUpdated}>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Session Stats Overview */}
        {selectedSession && (
          <div className={styles.statsOverview}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <FaMoneyBillWave />
              </div>
              <div className={styles.statContent}>
                <h3>₹{(() => {
                  const totalRevenue = sessionAttendees.reduce((sum, attendee) => {
                    // Try individualAmount first (for new individual records)
                    if (attendee.individualAmount) {
                      return sum + attendee.individualAmount;
                    }
                    
                    // Calculate from ticket prices for group bookings or legacy records
                    if (typeof attendee.tickets === 'object' && selectedSession) {
                      return sum + Object.entries(attendee.tickets).reduce((ticketSum, [ticketName, quantity]) => {
                        const ticket = selectedSession.tickets.find(t => t.name === ticketName);
                        return ticketSum + (ticket ? ticket.price * Number(quantity) : 0);
                      }, 0);
                    }
                    
                    // For legacy single ticket bookings
                    if (typeof attendee.tickets === 'number' && selectedSession && selectedSession.tickets.length > 0) {
                      return sum + (selectedSession.tickets[0].price * attendee.tickets);
                    }
                    
                    // Fallback: try to get from originalBookingData
                    if (attendee.originalBookingData?.originalTotalAmount) {
                      return sum + attendee.originalBookingData.originalTotalAmount;
                    }
                    
                    return sum;
                  }, 0);
                  
                  return totalRevenue.toLocaleString();
                })()}</h3>
                <p>Total Revenue</p>
              </div>
            </div>
            
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <FaTicketAlt />
              </div>
              <div className={styles.statContent}>
                <h3>{sessionAttendees.length}</h3>
                <p>Total Tickets Sold</p>
              </div>
            </div>
            
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <FaCheckCircle />
              </div>
              <div className={styles.statContent}>
                <h3>{sessionAttendees.filter(a => a.checkedIn).length}</h3>
                <p>Checked In</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabNavigation}>
        <button
          className={`${styles.tabButton} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <FaChartBar />
          Overview
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'attendees' ? styles.active : ''}`}
          onClick={() => setActiveTab('attendees')}
        >
          <FaUsers />
          Attendees ({selectedSession ? sessionAttendees.length : attendees.length})
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'checkin' ? styles.active : ''}`}
          onClick={() => setActiveTab('checkin')}
        >
          <FaQrcode />
          Check-in
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'manage-tickets' ? styles.active : ''}`}
          onClick={() => setActiveTab('manage-tickets')}
        >
          <FaTicketAlt />
          Manage Tickets
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'settings' ? styles.active : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <FaCog />
          Settings
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'overview' && selectedSession && (
          <div className={styles.overviewTab}>
            <div className={styles.overviewHeader}>
              <h2>Session Overview</h2>
              <div className={styles.sessionInfo}>
                <span className={styles.sessionDate}>{formatDate(selectedSession.date)}</span>
                <span className={styles.sessionTime}>
                  {formatTime(selectedSession.start_time)} - {formatTime(selectedSession.end_time)}
                </span>
              </div>
            </div>



            {/* Ticket Sales Breakdown - Simple and Clear */}
            <div className={styles.overviewSection}>
              <h3>Ticket Sales by Type</h3>
              <div className={styles.ticketBreakdown}>
                {selectedSession.tickets.map((ticket, index) => {
                  const soldCount = sessionAttendees.filter(attendee => 
                    attendee.ticketType === ticket.name ||
                    (typeof attendee.tickets === 'object' && attendee.tickets[ticket.name] > 0)
                  ).length;
                  const revenue = soldCount * ticket.price;
                  const percentage = (soldCount / ticket.capacity) * 100;

                  return (
                    <div key={index} className={styles.ticketBreakdownCard}>
                      <div className={styles.ticketHeader}>
                        <h4>{ticket.name}</h4>
                        <span className={styles.ticketPrice}>₹{ticket.price}</span>
                      </div>
                      <div className={styles.ticketStats}>
                        <div className={styles.ticketStat}>
                          <span className={styles.statLabel}>Sold</span>
                          <span className={styles.statValue}>{soldCount} / {ticket.capacity}</span>
                          <div className={styles.soldProgressBar}>
                            <div 
                              className={styles.soldProgressFill}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className={styles.soldPercentageText}>{percentage.toFixed(1)}% sold</span>
                        </div>
                        <div className={styles.ticketStat}>
                          <span className={styles.statLabel}>Revenue</span>
                          <span className={styles.statValue}>₹{revenue.toLocaleString()}</span>
                        </div>
                        <div className={styles.ticketStat}>
                          <span className={styles.statLabel}>Available</span>
                          <span className={styles.statValue}>{ticket.capacity - soldCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>


          </div>
        )}

        {/* Attendees Tab - DATA VIEW ONLY with CSV Export */}
        {activeTab === 'attendees' && (
          <div className={styles.attendeesTab}>
            <div className={styles.attendeesHeader}>
              <h2>Attendees Data ({sessionAttendees.length})</h2>
              <div className={styles.attendeesActions}>
                <div className={styles.searchBox}>
                  <FaSearch />
                  <input
                    type="text"
                    placeholder="Search attendees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className={styles.filterSelect}
                >
                  <option value="all">All Attendees</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked-in">Checked In</option>
                  <option value="not-checked-in">Not Checked In</option>
                </select>
                <button 
                  className={styles.exportButton}
                  onClick={handleExportAttendees}
                >
                  <FaDownload /> Export CSV
                </button>
              </div>
            </div>

            {/* Attendee Statistics Summary */}
            <div className={styles.attendeesSummary}>
              <div className={styles.summaryCard}>
                <span className={styles.summaryNumber}>{sessionAttendees.length}</span>
                <span className={styles.summaryLabel}>Total Attendees</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryNumber}>
                  {sessionAttendees.filter(a => a.checkedIn).length}
                </span>
                <span className={styles.summaryLabel}>Checked In</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryNumber}>
                  {sessionAttendees.filter(a => !a.checkedIn).length}
                </span>
                <span className={styles.summaryLabel}>Pending</span>
              </div>
            </div>

            {/* Attendees Data Table */}
            <div className={styles.attendeesDataTable}>
              {sessionAttendees.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateIcon}>
                    <FaUsers />
                  </div>
                  <h3>No attendees yet</h3>
                  <p>Attendees will appear here once they register for this session.</p>
                  <div className={styles.emptyStateActions}>
                    <button 
                      className={styles.emptyStateButton}
                      onClick={() => setActiveTab('overview')}
                    >
                      <FaChartBar /> View Overview
                    </button>
                  </div>
                </div>
              ) : (
                sessionAttendees
                  .filter(attendee => {
                    const matchesSearch = attendee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        attendee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        attendee.phone.includes(searchTerm);
                    
                    const matchesFilter = filterStatus === 'all' ||
                                        (filterStatus === 'checked-in' && attendee.checkedIn) ||
                                        (filterStatus === 'not-checked-in' && !attendee.checkedIn) ||
                                        (filterStatus === 'confirmed' && attendee.status === 'confirmed');
                    
                    return matchesSearch && matchesFilter;
                  })
                  .length === 0 ? (
                    <div className={styles.noResults}>
                      <div className={styles.noResultsIcon}>
                        <FaSearch />
                      </div>
                      <h3>No attendees match your search</h3>
                      <p>Try adjusting your search terms or filter settings.</p>
                      <button 
                        className={styles.clearFiltersButton}
                        onClick={() => {
                          setSearchTerm('');
                          setFilterStatus('all');
                        }}
                      >
                        Clear Filters
                      </button>
                    </div>
                  ) : (
                    <div className={styles.dataTableContainer}>
                      <table className={styles.attendeesTable}>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Ticket Type</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Booking Date</th>
                            <th>Check-in Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionAttendees
                            .filter(attendee => {
                              const matchesSearch = attendee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                  attendee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                  attendee.phone.includes(searchTerm);
                              
                              const matchesFilter = filterStatus === 'all' ||
                                                  (filterStatus === 'checked-in' && attendee.checkedIn) ||
                                                  (filterStatus === 'not-checked-in' && !attendee.checkedIn) ||
                                                  (filterStatus === 'confirmed' && attendee.status === 'confirmed');
                              
                              return matchesSearch && matchesFilter;
                            })
                            .map(attendee => (
                              <tr key={attendee.id} className={attendee.checkedIn ? styles.checkedInRow : styles.pendingRow}>
                                <td>
                                  <div className={styles.nameCell}>
                                    <strong>{attendee.name}</strong>
                                    {attendee.ticketIndex && attendee.totalTicketsInBooking && attendee.totalTicketsInBooking > 1 && (
                                      <span className={styles.groupIndicator}>
                                        #{attendee.ticketIndex} of {attendee.totalTicketsInBooking}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td>{attendee.email}</td>
                                <td>{attendee.phone}</td>
                                <td>
                                  <span className={styles.ticketTypeTag}>
                                    {attendee.ticketType || 'Standard'}
                                  </span>
                                </td>
                                <td>
                                  <span className={styles.amountCell}>
                                    ₹{(() => {
                                      // Try individualAmount first
                                      if (attendee.individualAmount) {
                                        return attendee.individualAmount.toLocaleString();
                                      }
                                      
                                      // Calculate from ticket prices if selectedSession available
                                      if (typeof attendee.tickets === 'object' && selectedSession) {
                                        const calculatedAmount = Object.entries(attendee.tickets).reduce((sum, [ticketName, quantity]) => {
                                          const ticket = selectedSession.tickets.find(t => t.name === ticketName);
                                          return sum + (ticket ? ticket.price * Number(quantity) : 0);
                                        }, 0);
                                        return calculatedAmount.toLocaleString();
                                      }
                                      
                                      // Legacy single ticket
                                      if (typeof attendee.tickets === 'number' && selectedSession && selectedSession.tickets.length > 0) {
                                        const amount = selectedSession.tickets[0].price * attendee.tickets;
                                        return amount.toLocaleString();
                                      }
                                      
                                      // Fallback
                                      if (attendee.originalBookingData?.originalTotalAmount) {
                                        return attendee.originalBookingData.originalTotalAmount.toLocaleString();
                                      }
                                      
                                      return '0';
                                    })()}
                                  </span>
                                </td>
                                <td>
                                  {attendee.checkedIn ? (
                                    <span className={styles.statusCheckedIn}>
                                      <FaCheckCircle /> Checked In
                                    </span>
                                  ) : (
                                    <span className={styles.statusPending}>
                                      <FaClock /> Pending
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {new Date(attendee.createdAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </td>
                                                                 <td>
                                   {attendee.checkedIn && attendee.checkInTime ? (
                                     <span className={styles.checkInTimeCell}>
                                       {new Date(attendee.checkInTime).toLocaleString('en-US', {
                                         month: 'short',
                                         day: 'numeric',
                                         hour: '2-digit',
                                         minute: '2-digit'
                                       })}
                                     </span>
                                   ) : (
                                     <span className={styles.notCheckedIn}>-</span>
                                   )}
                                 </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
            </div>
          </div>
        )}

        {/* Check-in Tab - COMPLETE CHECK-IN MANAGEMENT WITH ATTENDEE INFO */}
        {activeTab === 'checkin' && (
          <div className={styles.checkinTab}>
            <div className={styles.checkinHeader}>
              <h2>Check-in Management</h2>
              <div className={styles.checkinActions}>
                <div className={styles.checkinStats}>
                  <span className={styles.checkinStat}>
                    <FaUsers /> {sessionAttendees.filter(a => a.checkedIn).length} / {sessionAttendees.length} checked in
                  </span>
                  <span className={styles.checkinStat}>
                    <FaPercentage /> {sessionAttendees.length > 0 
                      ? ((sessionAttendees.filter(a => a.checkedIn).length / sessionAttendees.length) * 100).toFixed(1)
                      : 0}% completion
                  </span>
                </div>
                <button 
                  className={styles.exportButton}
                  onClick={handleExportAttendees}
                >
                  <FaDownload /> Export List
                </button>
              </div>
            </div>
            
            {scanResult && (
              <div className={`${styles.scanResult} ${styles[scanResult.type]}`}>
                {scanResult.type === 'success' && <FaCheckCircle />}
                {scanResult.type === 'error' && <FaTimesCircle />}
                {scanResult.type === 'info' && <FaExclamationTriangle />}
                <span>{scanResult.message}</span>
              </div>
            )}

            {/* Undo Check-in Option */}
            {recentCheckIn && (
              <div className={styles.undoSection}>
                <div className={styles.undoCard}>
                  <div className={styles.undoInfo}>
                    <span>Just checked in: <strong>{recentCheckIn.attendee.name}</strong></span>
                    <span className={styles.undoTimer}>
                      Undo available for {Math.max(0, 30 - Math.floor((Date.now() - recentCheckIn.timestamp.getTime()) / 1000))} seconds
                    </span>
                  </div>
                  <button
                    onClick={handleUndoCheckIn}
                    disabled={undoLoading}
                    className={styles.undoButton}
                  >
                    {undoLoading ? (
                      <>
                        <FaSyncAlt className={styles.spinning} /> Undoing...
                      </>
                    ) : (
                      <>
                        <FaArrowLeft /> Undo Check-in
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Check-in Options */}
            <div className={styles.checkinMethods}>
              <div className={styles.checkinMethodsHeader}>
                <h3>Check-in Methods</h3>
              </div>
              <div className={styles.checkinOptions}>
                <button 
                  className={`${styles.scannerButton} ${scannerActive ? styles.active : ''}`}
                  onClick={scannerActive ? stopQRScanner : startQRScanner}
                >
                  <FaQrcode />
                  {scannerActive ? 'Stop QR Scanner' : 'Start QR Scanner'}
                </button>
                
                <button 
                  className={`${styles.manualButton} ${showManualCheckIn ? styles.active : ''}`}
                  onClick={() => setShowManualCheckIn(!showManualCheckIn)}
                >
                  <FaSearch />
                  Manual Search & Check-in
                </button>
              </div>
            </div>

            {/* QR Scanner Video */}
            {scannerActive && (
              <div className={styles.qrScannerContainer}>
                <div className={styles.scannerFrame}>
                  <video
                    ref={videoRef}
                    className={styles.scannerVideo}
                    autoPlay
                    playsInline
                    muted
                  />
                  <div className={styles.scannerOverlay}>
                    <div className={styles.scannerTarget}></div>
                    <p>Position QR code within the frame</p>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Search Check-in */}
            {showManualCheckIn && (
              <div className={styles.manualCheckInSection}>
                <div className={styles.manualCheckInHeader}>
                  <h3>Search & Check-in Attendees</h3>
                  <div className={styles.searchBox}>
                    <FaSearch />
                    <input
                      type="text"
                      placeholder="Search by name, email, or phone..."
                      value={manualCheckInSearch}
                      onChange={(e) => setManualCheckInSearch(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className={styles.searchResultsContainer}>
                  {manualCheckInSearch ? (
                    <div className={styles.searchResults}>
                      {sessionAttendees
                        .filter(attendee => 
                          attendee.name.toLowerCase().includes(manualCheckInSearch.toLowerCase()) ||
                          attendee.email.toLowerCase().includes(manualCheckInSearch.toLowerCase()) ||
                          attendee.phone.includes(manualCheckInSearch)
                        )
                        .length === 0 ? (
                          <div className={styles.noSearchResults}>
                            <FaSearch />
                            <p>No attendees found matching "{manualCheckInSearch}"</p>
                          </div>
                        ) : (
                                                     sessionAttendees
                             .filter(attendee => 
                               attendee.name.toLowerCase().includes(manualCheckInSearch.toLowerCase()) ||
                               attendee.email.toLowerCase().includes(manualCheckInSearch.toLowerCase()) ||
                               attendee.phone.includes(manualCheckInSearch)
                             )
                             .map(attendee => (
                               <div key={attendee.id} className={`${styles.searchResultItem} ${attendee.checkedIn ? styles.alreadyCheckedIn : styles.availableForCheckIn}`}>
                                 <div className={styles.attendeeInfoDetailed}>
                                   <div className={styles.attendeeMainInfo}>
                                     <h4>{attendee.name}</h4>
                                     {attendee.checkedIn ? (
                                       <span className={styles.checkedInBadge}>
                                         <FaCheckCircle /> Already Checked In
                                       </span>
                                     ) : (
                                       <span className={styles.pendingBadge}>
                                         <FaClock /> Ready to Check In
                                       </span>
                                     )}
                                   </div>
                                   <div className={styles.attendeeDetailsGrid}>
                                     <div className={styles.detailItem}>
                                       <span className={styles.detailLabel}>Email:</span>
                                       <span className={styles.detailValue}>{attendee.email}</span>
                                     </div>
                                     <div className={styles.detailItem}>
                                       <span className={styles.detailLabel}>Phone:</span>
                                       <span className={styles.detailValue}>{attendee.phone}</span>
                                     </div>
                                     <div className={styles.detailItem}>
                                       <span className={styles.detailLabel}>Ticket:</span>
                                       <span className={styles.detailValue}>{attendee.ticketType || 'Standard'}</span>
                                     </div>
                                     <div className={styles.detailItem}>
                                       <span className={styles.detailLabel}>Amount:</span>
                                       <span className={styles.detailValue}>₹{(attendee.individualAmount || 0).toLocaleString()}</span>
                                     </div>
                                     {attendee.checkedIn && attendee.checkInTime && (
                                       <div className={styles.detailItem}>
                                         <span className={styles.detailLabel}>Checked in:</span>
                                         <span className={styles.detailValue}>
                                           {new Date(attendee.checkInTime).toLocaleString('en-US', {
                                             month: 'short',
                                             day: 'numeric',
                                             hour: '2-digit',
                                             minute: '2-digit'
                                           })}
                                         </span>
                                       </div>
                                     )}
                                   </div>
                                   <div className={styles.attendeeCheckInActions}>
                                     {!attendee.checkedIn ? (
                                       <button
                                         onClick={() => handleSessionCheckIn(attendee)}
                                         disabled={checkInLoading === attendee.id}
                                         className={`${styles.checkInButton} ${checkInLoading === attendee.id ? styles.loading : ''}`}
                                       >
                                         {checkInLoading === attendee.id ? (
                                           <>
                                             <FaSyncAlt className={styles.spinning} /> Checking In...
                                           </>
                                         ) : (
                                           <>
                                             <FaUserCheck /> Check In Now
                                           </>
                                         )}
                                       </button>
                                     ) : (
                                       <span className={styles.alreadyCheckedInText}>
                                         <FaCheckCircle /> Checked In
                                       </span>
                                     )}
                                   </div>
                                 </div>
                               </div>
                            ))
                        )}
                    </div>
                  ) : (
                    <div className={styles.noSearchQuery}>
                      <FaSearch />
                      <p>Start typing to search for attendees to check in</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Check-in List for Pending Attendees */}
            {!showManualCheckIn && !scannerActive && (
              <div className={styles.quickCheckinList}>
                <h3>Pending Check-ins ({sessionAttendees.filter(a => !a.checkedIn).length})</h3>
                
                {sessionAttendees.filter(a => !a.checkedIn).length === 0 ? (
                  <div className={styles.allCheckedIn}>
                    <FaCheckCircle />
                    <h4>All attendees have been checked in!</h4>
                    <p>Great job! Everyone is accounted for.</p>
                  </div>
                ) : (
                  <div className={styles.pendingAttendeesList}>
                    {sessionAttendees
                      .filter(a => !a.checkedIn)
                      .slice(0, 10) // Show first 10 pending
                      .map(attendee => (
                        <div key={attendee.id} className={styles.quickCheckInItem}>
                          <div className={styles.attendeeQuickInfo}>
                            <span className={styles.attendeeName}>{attendee.name}</span>
                            <span className={styles.attendeeTicket}>{attendee.ticketType || 'Standard'}</span>
                          </div>
                          <button
                            onClick={() => handleSessionCheckIn(attendee)}
                            disabled={checkInLoading === attendee.id}
                            className={`${styles.quickCheckInButton} ${checkInLoading === attendee.id ? styles.loading : ''}`}
                          >
                            {checkInLoading === attendee.id ? (
                              <>
                                <FaSyncAlt className={styles.spinning} /> Checking In...
                              </>
                            ) : (
                              <>
                                <FaUserCheck /> Check In
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    
                    {sessionAttendees.filter(a => !a.checkedIn).length > 10 && (
                      <div className={styles.showMorePending}>
                        <p>+{sessionAttendees.filter(a => !a.checkedIn).length - 10} more pending</p>
                        <button 
                          onClick={() => setShowManualCheckIn(true)}
                          className={styles.showAllButton}
                        >
                          View All Pending
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Manage Tickets Tab */}
        {activeTab === 'manage-tickets' && selectedSession && (
          <div className={styles.manageTicketsTab}>
            <h2>Manage Session Tickets</h2>
            
            {ticketUpdateResult && (
              <div className={`${styles.updateResult} ${styles[ticketUpdateResult.type]}`}>
                {ticketUpdateResult.message}
              </div>
            )}
            
            <div className={styles.ticketsGrid}>
              {selectedSession.tickets.map((ticket, index) => (
                <div key={index} className={styles.ticketManageCard}>
                  <div className={styles.ticketManageHeader}>
                    <h3>{ticket.name}</h3>
                    <span className={styles.ticketPrice}>₹{ticket.price}</span>
                  </div>
                  
                  <div className={styles.ticketManageStats}>
                    <div className={styles.statRow}>
                      <span>Capacity:</span>
                      <span>{ticket.capacity}</span>
                    </div>
                    <div className={styles.statRow}>
                      <span>Sold:</span>
                      <span>{ticket.capacity - ticket.available_capacity}</span>
                    </div>
                    <div className={styles.statRow}>
                      <span>Available:</span>
                      <span>{ticket.available_capacity}</span>
                    </div>
                    <div className={styles.statRow}>
                      <span>Revenue:</span>
                      <span>₹{((ticket.capacity - ticket.available_capacity) * ticket.price).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className={styles.ticketManageActions}>
                    <button 
                      className={styles.editTicketButton}
                      onClick={() => setEditingTicket({...ticket, index})}
                    >
                      <FaEdit /> Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Tab - Keep minimal */}
        {activeTab === 'settings' && (
          <div className={styles.settingsTab}>
            <h2>Event Settings</h2>
            
            <div className={styles.settingsSection}>
              <h3>Event Management</h3>
              <div className={styles.settingsActions}>
                <button 
                  onClick={handleEdit}
                  className={styles.editEventButton}
                  disabled={!permissions.canEdit}
                >
                  <FaEdit /> Edit Event
                </button>
                
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className={styles.deleteEventButton}
                  disabled={!permissions.canDelete}
                >
                  <FaTrash /> Delete Event
                </button>
              </div>
            </div>

            {showDeleteConfirm && (
              <div className={styles.deleteConfirmation}>
                <h3>⚠️ Delete Event</h3>
                <p>This action cannot be undone. All attendee data and tickets will be permanently deleted.</p>
                <p>Type the event title "<strong>{eventData?.title}</strong>" to confirm:</p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Enter event title"
                />
                <div className={styles.deleteActions}>
                  <button 
                    onClick={handleDelete}
                    className={styles.confirmDeleteButton}
                    disabled={deleteConfirmText !== eventData?.title}
                  >
                    Delete Event
                  </button>
                  <button 
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                    className={styles.cancelDeleteButton}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ticket Edit Modal */}
      {editingTicket && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Edit Ticket: {editingTicket.name}</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setEditingTicket(null)}
              >
                <FaTimesCircle />
              </button>
            </div>
            
            <div className={styles.editTicketForm}>
              <div className={styles.formGroup}>
                <label>Capacity</label>
                <input
                  type="number"
                  defaultValue={editingTicket.capacity}
                  min={sessionAttendees.filter(a => a.ticketType === editingTicket.name).length}
                  onBlur={(e) => {
                    const newCapacity = parseInt(e.target.value);
                    if (newCapacity !== editingTicket.capacity && newCapacity >= 0) {
                      handleUpdateSessionTicket(editingTicket.index, 'capacity', newCapacity);
                    }
                  }}
                  disabled={ticketUpdating === `capacity-${editingTicket.index}`}
                />
                {ticketUpdating === `capacity-${editingTicket.index}` && (
                  <span className={styles.updating}>Updating...</span>
                )}
              </div>

              <div className={styles.formGroup}>
                <label>Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={editingTicket.price}
                  min="0"
                  onBlur={(e) => {
                    const newPrice = parseFloat(e.target.value);
                    if (newPrice !== editingTicket.price && newPrice >= 0) {
                      handleUpdateSessionTicket(editingTicket.index, 'price', newPrice);
                    }
                  }}
                  disabled={ticketUpdating === `price-${editingTicket.index}`}
                />
                {ticketUpdating === `price-${editingTicket.index}` && (
                  <span className={styles.updating}>Updating...</span>
                )}
              </div>

              <div className={styles.ticketStats}>
                <p>Sold: {sessionAttendees.filter(a => a.ticketType === editingTicket.name).length}</p>
                <p>Available: {editingTicket.available_capacity}</p>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button 
                className={styles.cancelButton}
                onClick={() => setEditingTicket(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDashboard; 