'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';
import { FaTicketAlt, FaQrcode, FaTimes, FaCalendarAlt, FaMapMarkerAlt, FaClock, FaUser, FaRupeeSign } from 'react-icons/fa';
import TicketCard from '@/components/TicketCard/TicketCard';
import { getTicketDisplayStatus } from '@/utils/ticketValidator';
import styles from './Tickets.module.css';

interface Ticket {
  id: string;
  ticketNumber: string;
  qrCode: string;
  type: 'event' | 'activity';
  eventId?: string;
  activityId?: string;
  title: string;
  venue: string;
  selectedDate: string;
  selectedTimeSlot: {
    start_time: string;
    end_time: string;
  };
  ticketType?: string;
  status: 'active' | 'used' | 'cancelled';
  userName: string;
  amount: number;
  createdAt: string;
  usedAt?: string;
}

const TicketsPage = () => {
  const router = useRouter();
  const auth = getAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchTickets(user.uid);
    });

    // Refresh tickets when page becomes visible (after scanning)
    const handleVisibilityChange = () => {
      if (!document.hidden && auth.currentUser) {
        fetchTickets(auth.currentUser.uid);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [auth, router]);

  const fetchTickets = async (userId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tickets?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        // Sort tickets: upcoming active tickets first, then by date
        const sortedTickets = data.tickets.sort((a: Ticket, b: Ticket) => {
          const now = new Date();
          const dateA = new Date(a.selectedDate);
          const dateB = new Date(b.selectedDate);
          
          // Active upcoming tickets first
          if (a.status === 'active' && dateA >= now && (b.status !== 'active' || dateB < now)) {
            return -1;
          }
          if (b.status === 'active' && dateB >= now && (a.status !== 'active' || dateA < now)) {
            return 1;
          }
          
          // Then sort by date descending
          return dateB.getTime() - dateA.getTime();
        });
        
        setTickets(sortedTickets);
      } else {
        setError(data.error || 'Failed to fetch tickets');
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError('Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short'
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const time = new Date();
    time.setHours(parseInt(hours), parseInt(minutes));
    return time.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10B981';
      case 'used': return '#6B7280';
      case 'expired': return '#EF4444';
      case 'cancelled': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getTicketStatus = (ticket: Ticket) => {
    return getTicketDisplayStatus(ticket);
  };

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) > new Date();
  };

  if (loading) {
    return (
      <div className={styles.ticketsPage}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading your tickets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.ticketsPage}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>❌</div>
          <h2>Error Loading Tickets</h2>
          <p>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={() => auth.currentUser && fetchTickets(auth.currentUser.uid)}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.ticketsPage}>
      {/* Simple Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <FaTicketAlt className={styles.titleIcon} />
          <div>
            <h1>My Tickets</h1>
            <p className={styles.subtitle}>
              {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
            </p>
          </div>
        </div>
      </div>

      {/* Tickets Display */}
      <div className={styles.ticketsContainer}>
        {tickets.length === 0 ? (
          <div className={styles.emptyState}>
            <FaTicketAlt className={styles.emptyIcon} />
            <h3>No Tickets Yet</h3>
            <p>You haven't booked any events or activities yet.</p>
            <div className={styles.emptyActions}>
              <button 
                className={styles.browseButton}
                onClick={() => router.push('/events')}
              >
                Browse Events
              </button>
              <button 
                className={styles.browseButton}
                onClick={() => router.push('/activities')}
              >
                Browse Activities
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.ticketsList}>
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onClick={() => setSelectedTicket(ticket)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Full Ticket Modal */}
      {selectedTicket && (
        <div className={styles.modalOverlay} onClick={() => setSelectedTicket(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.closeButton}
              onClick={() => setSelectedTicket(null)}
            >
              <FaTimes />
            </button>

            <div className={styles.fullTicket}>
              {/* Ticket Header */}
              <div className={styles.fullTicketHeader}>
                <div className={styles.fullTicketTitle}>
                  <h2>{selectedTicket.title}</h2>
                  <span className={styles.fullTicketType}>
                    {selectedTicket.type.toUpperCase()}
                  </span>
                </div>
                <div 
                  className={styles.fullTicketStatus}
                  style={{ backgroundColor: getStatusColor(getTicketStatus(selectedTicket).status) }}
                >
                  {getTicketStatus(selectedTicket).displayText.toUpperCase()}
                </div>
              </div>

              {/* QR Code Section */}
              <div className={styles.qrSection}>
                <div className={styles.qrCodeContainer}>
                  <QRCodeSVG
                    value={selectedTicket.qrCode}
                    size={200}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                    includeMargin={true}
                    className={styles.qrCode}
                  />
                </div>
                <p className={styles.qrInstructions}>
                  Show this QR code at the venue entrance
                </p>
              </div>

              {/* Ticket Details */}
              <div className={styles.ticketDetails}>
                <div className={styles.detailRow}>
                  <FaUser className={styles.detailIcon} />
                  <div>
                    <span className={styles.detailLabel}>Name</span>
                    <span className={styles.detailValue}>{selectedTicket.userName}</span>
                  </div>
                </div>

                <div className={styles.detailRow}>
                  <FaCalendarAlt className={styles.detailIcon} />
                  <div>
                    <span className={styles.detailLabel}>Date</span>
                    <span className={styles.detailValue}>{formatDate(selectedTicket.selectedDate)}</span>
                  </div>
                </div>

                <div className={styles.detailRow}>
                  <FaClock className={styles.detailIcon} />
                  <div>
                    <span className={styles.detailLabel}>Time</span>
                    <span className={styles.detailValue}>
                      {formatTime(selectedTicket.selectedTimeSlot.start_time)} - {formatTime(selectedTicket.selectedTimeSlot.end_time)}
                    </span>
                  </div>
                </div>

                <div className={styles.detailRow}>
                  <FaMapMarkerAlt className={styles.detailIcon} />
                  <div>
                    <span className={styles.detailLabel}>Venue</span>
                    <span className={styles.detailValue}>{selectedTicket.venue}</span>
                  </div>
                </div>

                <div className={styles.detailRow}>
                  <FaRupeeSign className={styles.detailIcon} />
                  <div>
                    <span className={styles.detailLabel}>Amount Paid</span>
                    <span className={styles.detailValue}>₹{selectedTicket.amount}</span>
                  </div>
                </div>

                <div className={styles.detailRow}>
                  <FaTicketAlt className={styles.detailIcon} />
                  <div>
                    <span className={styles.detailLabel}>Ticket Number</span>
                    <span className={styles.detailValue}>{selectedTicket.ticketNumber}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                className={styles.viewEventButton}
                onClick={() => {
                  setSelectedTicket(null);
                  if (selectedTicket.type === 'event') {
                    router.push(`/event-profile/${selectedTicket.eventId}`);
                  } else {
                    router.push(`/activity-profile/${selectedTicket.activityId}`);
                  }
                }}
              >
                View {selectedTicket.type === 'event' ? 'Event' : 'Activity'} Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketsPage; 