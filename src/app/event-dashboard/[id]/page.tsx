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
  FaCamera
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
  tickets: Record<string, number>;
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

interface EventData {
  id: string;
  title: string;
  event_image?: string;
  organizationId: string;
  event_type: string;
  time_slots: Array<{
    date: string;
    start_time: string;
    end_time: string;
    available: boolean;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'attendees' | 'checkin' | 'tickets'>('overview');
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
  
  // Refs for cleanup
  const unsubscribeAttendees = useRef<(() => void) | null>(null);
  const unsubscribeTickets = useRef<(() => void) | null>(null);

  // Update real-time statistics
  const updateRealTimeStats = useCallback((attendeesList: Attendee[], ticketsList: Ticket[]) => {
    if (!eventData) return;

    const totalCapacity = eventData.tickets.reduce((sum, ticket) => sum + ticket.capacity, 0);
    const soldTickets = attendeesList.reduce((sum, attendee) => 
      sum + Object.values(attendee.tickets).reduce((ticketSum: number, count: any) => ticketSum + Number(count), 0), 0
    );
    const revenue = attendeesList.reduce((sum, attendee) => {
      return sum + Object.entries(attendee.tickets).reduce((ticketSum, [ticketName, count]) => {
        const ticket = eventData.tickets.find(t => t.name === ticketName);
        return ticketSum + (ticket ? ticket.price * Number(count) : 0);
      }, 0);
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
    if (!permissions.canDelete || !eventId) return;

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
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            {eventData?.title || 'Event Dashboard'}
            <span className={styles.roleIndicator}>{permissions.role}</span>
          </h1>
          <div className={styles.eventMeta}>
            <span><FaCalendarAlt /> {eventData?.time_slots[0]?.date}</span>
            <span><FaMapMarkerAlt /> {eventData?.event_venue}</span>
            <span><FaUsers /> {realTimeStats.checkedInCount}/{attendees.length} checked in</span>
            <span className={styles.liveIndicator}>
              <span className={styles.liveDot}></span>
              Live • Updated {lastRefresh.toLocaleTimeString()}
            </span>
          </div>
        </div>
        
        <div className={styles.headerActions}>
          <button 
            onClick={handleRefresh} 
            className={`${styles.refreshButton} ${refreshing ? styles.spinning : ''}`}
            disabled={refreshing}
          >
            <FaSyncAlt /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          {permissions.canView && (
            <div className={styles.actionButtons}>
              {permissions.canEdit && (
                <button onClick={handleEdit} className={styles.editButton}>
                  <FaEdit /> Edit Event
                </button>
              )}
              {permissions.canDelete && (
                <button onClick={() => setShowDeleteConfirm(true)} className={styles.deleteButton}>
                  <FaTrash /> Delete Event
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Essential Stats */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.revenueCard}`}>
          <div className={styles.statIcon}>
            <FaMoneyBillWave />
          </div>
          <div className={styles.statContent}>
            <h3>₹{realTimeStats.totalRevenue.toLocaleString()}</h3>
            <p>Total Revenue</p>
          </div>
        </div>
        
        <div className={`${styles.statCard} ${styles.ticketCard}`}>
          <div className={styles.statIcon}>
            <FaTicketAlt />
          </div>
          <div className={styles.statContent}>
            <h3>{realTimeStats.soldTickets}</h3>
            <p>Tickets Sold</p>
            <span className={styles.statSubtext}>
              of {realTimeStats.totalCapacity} total
            </span>
          </div>
          <div className={styles.progressBar}>
            <div 
              className={styles.progress}
              style={{ 
                width: `${(realTimeStats.soldTickets / realTimeStats.totalCapacity) * 100}%` 
              }}
            ></div>
          </div>
        </div>
        
        <div className={`${styles.statCard} ${styles.attendeeCard}`}>
          <div className={styles.statIcon}>
            <FaUserCheck />
          </div>
          <div className={styles.statContent}>
            <h3>{realTimeStats.checkedInCount}</h3>
            <p>Checked In</p>
            <span className={styles.statSubtext}>
              {realTimeStats.pendingCheckIn} pending
            </span>
          </div>
        </div>
        
        <div className={`${styles.statCard} ${styles.capacityCard}`}>
          <div className={styles.statIcon}>
            <FaChartBar />
          </div>
          <div className={styles.statContent}>
            <h3>{Math.round((realTimeStats.checkedInCount / attendees.length) * 100) || 0}%</h3>
            <p>Attendance Rate</p>
            <span className={styles.statSubtext}>
              Live tracking
            </span>
          </div>
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
          className={`${styles.tab} ${activeTab === 'tickets' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('tickets')}
          disabled={!permissions.canView}
        >
          <FaTicketAlt /> Tickets 
          <span className={styles.tabCount}>({tickets.length})</span>
          <span className={styles.tabIndicator}></span>
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'overview' && (
          <div className={styles.overviewTab}>
            {/* Ticket Breakdown */}
            <div className={styles.section}>
              <h3>Ticket Sales Overview</h3>
              <div className={styles.ticketBreakdown}>
                {eventData?.tickets.map((ticket, index) => {
                  const soldCount = attendees.reduce((count, attendee) => 
                    count + (attendee.tickets[ticket.name] || 0), 0
                  );
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
                      {Object.entries(attendee.tickets).map(([type, count]) => (
                        <span key={type} className={styles.ticketBadge}>
                          {type}: {count}
                        </span>
                      ))}
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
                          {Object.entries(attendee.tickets).map(([type, count]) => (
                            <span key={type} className={styles.ticketBadge}>
                              {type}: {count}
                            </span>
                          ))}
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
              <p>Scan attendee QR codes to mark them as checked in</p>
              
              <div className={styles.scannerContainer}>
                <button 
                  className={styles.scannerButton}
                  onClick={() => router.push(`/scan-tickets/${eventId}`)}
                >
                  <FaCamera /> Open QR Scanner
                </button>
                
                {scanResult && (
                  <div className={`${styles.scanResult} ${styles[scanResult.type]}`}>
                    {scanResult.message}
                  </div>
                )}
              </div>

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
                  <span>{Math.round((realTimeStats.checkedInCount / attendees.length) * 100) || 0}% Attendance</span>
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
                      {Object.entries(attendee.tickets).map(([type, count]) => (
                        <span key={type} className={styles.ticketBadge}>
                          {type}: {count}
                        </span>
                      ))}
                    </div>
                    <span className={`${styles.statusBadge} ${styles.pending}`}>
                      <FaClock /> Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className={styles.ticketsTab}>
            <div className={styles.controls}>
              <h3>Generated Tickets ({tickets.length})</h3>
              <div className={styles.ticketStats}>
                <span className={styles.statBadge}>
                  {tickets.filter(t => t.status === 'active').length} Active
                </span>
                <span className={styles.statBadge}>
                  {tickets.filter(t => t.status === 'used').length} Used
                </span>
                <span className={styles.statBadge}>
                  {tickets.filter(t => t.status === 'cancelled').length} Cancelled
                </span>
              </div>
            </div>
            
            <div className={styles.ticketsList}>
              {tickets.map((ticket) => (
                <div key={ticket.id} className={styles.ticketItem}>
                  <div className={styles.ticketDetails}>
                    <h4>#{ticket.ticketNumber}</h4>
                    <p>{ticket.userName}</p>
                    <p>{ticket.ticketType || 'General'}</p>
                    <p>{ticket.userEmail}</p>
                    <p>₹{ticket.amount}</p>
                  </div>
                  <div className={styles.ticketStatus}>
                    <span className={`${styles.statusBadge} ${styles[ticket.status]}`}>
                      {ticket.status === 'used' && <FaCheckCircle />}
                      {ticket.status === 'active' && <FaClock />}
                      {ticket.status === 'cancelled' && <FaTimesCircle />}
                      {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                    </span>
                    {ticket.usedAt && (
                      <div className={styles.usedTime}>
                        Used: {new Date(ticket.usedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Delete Event</h3>
            <p>Are you sure you want to delete this event? This action cannot be undone.</p>
            <div className={styles.modalActions}>
              <button onClick={handleDelete} className={styles.confirmDeleteButton}>
                Yes, Delete Event
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDashboard; 