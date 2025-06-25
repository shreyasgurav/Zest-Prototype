import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Image from 'next/image';
import { ChevronRight, MapPin } from 'lucide-react';
import { 
  FaShare,
  FaDownload,
  FaCopy,
  FaQrcode
} from 'react-icons/fa';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import styles from './TicketCard.module.css';

interface TicketCardProps {
  ticket: {
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
    event_image?: string;
    ticketIndex?: number;
    totalTicketsInBooking?: number;
    originalBookingData?: {
      originalTotalAmount: number;
      originalTickets: any;
      bookingReference: string;
    };
  };
  onClick?: () => void;
  viewMode?: 'grid' | 'list';
}

const TicketCard: React.FC<TicketCardProps> = ({ ticket, onClick, viewMode = 'grid' }) => {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [eventImage, setEventImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short'
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000/01/01 ${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusText = () => {
    switch (ticket.status) {
      case 'active': 
        return 'Active';
      case 'used': 
        return 'Finished';
      case 'cancelled': 
        return 'Cancelled';
      default: 
        return 'Unknown';
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${ticket.title} - Ticket`,
          text: `My ticket for ${ticket.title} on ${formatDate(ticket.selectedDate)}`,
          url: window.location.href
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      const shareText = `${ticket.title}\n${formatDate(ticket.selectedDate)} at ${ticket.venue}\nTicket #${ticket.ticketNumber}`;
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Download ticket:', ticket.id);
  };

  const copyTicketNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ticket.ticketNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusText = getStatusText();

  // Fetch event/activity image
  useEffect(() => {
    const fetchEventImage = async () => {
      try {
        setImageLoading(true);
        
        if (ticket.eventId) {
          // Fetch from events collection
          const eventDoc = await getDoc(doc(db, 'events', ticket.eventId));
          if (eventDoc.exists()) {
            const eventData = eventDoc.data();
            setEventImage(eventData.event_image || null);
          }
        } else if (ticket.activityId) {
          // Fetch from activities collection
          const activityDoc = await getDoc(doc(db, 'activities', ticket.activityId));
          if (activityDoc.exists()) {
            const activityData = activityDoc.data();
            setEventImage(activityData.activity_image || activityData.event_image || null);
          }
        }
      } catch (error) {
        console.error('Error fetching event/activity image:', error);
        setEventImage(null);
      } finally {
        setImageLoading(false);
      }
    };

    if (ticket.eventId || ticket.activityId) {
      fetchEventImage();
    } else {
      setImageLoading(false);
    }
  }, [ticket.eventId, ticket.activityId]);

  return (
    <div className={styles.ticketCard} onClick={onClick}>
      <div className={styles.ticketContent}>
        <div className={styles.ticketInfo}>
          <div className={styles.eventDetails}>
            <h2 className={styles.eventName}>{ticket.title}</h2>
            <div className={styles.dateTime}>
              {formatDate(ticket.selectedDate)} | {formatTime(ticket.selectedTimeSlot.start_time)}
            </div>
            <div className={styles.ticketCount}>
              {ticket.totalTicketsInBooking && ticket.totalTicketsInBooking > 1 ? (
                <div className={styles.groupBookingInfo}>
                  <span className={styles.ticketNumber}>
                    Ticket {ticket.ticketIndex} of {ticket.totalTicketsInBooking}
                  </span>
                  <span className={styles.groupBookingBadge}>
                    Group Booking
                  </span>
                </div>
              ) : (
                '1 ticket'
              )}
            </div>
          </div>

          <div className={styles.bottomSection}>
            <div className={styles.leftBottom}>
              <div className={styles.locationSection}>
                <div className={styles.locationLabel}>Location</div>
                <div className={styles.locationRow}>
                  <MapPin size={16} className={styles.locationIcon} />
                  <div className={styles.locationName}>{ticket.venue}</div>
                </div>
              </div>
              <div className={styles.statusBadge}>{statusText}</div>
            </div>

            <div className={styles.rightBottom}>
            </div>
          </div>
        </div>

        <div className={styles.eventImageContainer}>
          {imageLoading ? (
            <div className={styles.placeholderImage}>
              <div className={styles.loadingSpinner}></div>
              <span className={styles.placeholderText}>Loading...</span>
            </div>
          ) : eventImage ? (
            <Image
              src={eventImage}
              alt={ticket.title}
              width={150}
              height={200}
              className={styles.eventImage}
              onError={(e) => {
                console.log('Image failed to load:', eventImage);
                setEventImage(null);
              }}
            />
          ) : (
            <div className={styles.placeholderImage}>
              <FaQrcode size={40} />
              <span className={styles.placeholderText}>
                {ticket.type.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Overlay */}
      {showQR && ticket.status === 'active' && (
        <div className={styles.qrOverlay}>
          <div className={styles.qrContainer}>
            <QRCodeSVG
              value={ticket.qrCode}
              size={200}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
              includeMargin={true}
            />
            <p className={styles.qrText}>Scan at venue entrance</p>
            <p className={styles.qrWarning}>Valid only once</p>
            <button 
              className={styles.closeQR}
              onClick={(e) => {
                e.stopPropagation();
                setShowQR(false);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        {ticket.status === 'active' && (
          <button 
            className={styles.quickAction}
            onClick={(e) => {
              e.stopPropagation();
              setShowQR(!showQR);
            }}
            title="Show QR Code"
          >
            <FaQrcode />
          </button>
        )}
        <button 
          className={styles.quickAction}
          onClick={handleShare}
          title="Share ticket"
        >
          <FaShare />
        </button>
        <button 
          className={styles.quickAction}
          onClick={handleDownload}
          title="Download ticket"
        >
          <FaDownload />
        </button>
        <button 
          className={styles.quickAction}
          onClick={copyTicketNumber}
          title="Copy ticket number"
        >
          <FaCopy />
          {copied && <span className={styles.copiedText}>Copied!</span>}
        </button>
      </div>
    </div>
  );
};

export default TicketCard; 