'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { isOrganizationSession } from '@/utils/authHelpers';
import styles from './EventProfile.module.css';
import { FaBookmark, FaCalendarAlt, FaMapMarkerAlt, FaLanguage, FaClock, FaUsers, FaInfo, FaTicketAlt, FaRupeeSign } from 'react-icons/fa';
import EventProfileSkeleton from './EventProfileSkeleton';

interface TimeSlot {
  date: string;
  start_time: string;
  end_time: string;
  available: boolean;
}

interface TicketType {
  name: string;
  price: number;
  capacity: number;
  available_capacity: number;
}

interface GuideOption {
  id: string;
  label: string;
  placeholder: string;
}

const GUIDE_OPTIONS: GuideOption[] = [
  { id: 'duration', label: 'Duration', placeholder: 'e.g., 2 hours' },
  { id: 'age_requirement', label: 'Age Requirement', placeholder: 'e.g., 16+ years' },
  { id: 'language', label: 'Language', placeholder: 'e.g., Hindi, English' },
  { id: 'seating', label: 'Seating Arrangement', placeholder: 'e.g., Theater, Round Table' },
  { id: 'kid_friendly', label: 'Kid Friendly', placeholder: 'e.g., Yes/No or details' },
  { id: 'pet_friendly', label: 'Pet Friendly', placeholder: 'e.g., Yes/No or details' },
  { id: 'wheelchair', label: 'Wheelchair Accessible', placeholder: 'e.g., Yes/No or details' },
  { id: 'parking', label: 'Parking Available', placeholder: 'e.g., Yes/No or details' },
  { id: 'food', label: 'Food & Beverages', placeholder: 'e.g., Snacks, Dinner, Drinks' },
  { id: 'outdoor', label: 'Outdoor Event', placeholder: 'e.g., Yes/No or details' },
  { id: 'indoor', label: 'Indoor Event', placeholder: 'e.g., Yes/No or details' },
  { id: 'dress_code', label: 'Dress Code', placeholder: 'e.g., Formal, Casual' },
  { id: 'photography', label: 'Photography Allowed?', placeholder: 'e.g., Yes/No or details' },
  { id: 'alcohol', label: 'Alcohol allowed?', placeholder: 'e.g., Yes/No or details' },
];

interface EventData {
  id: string;
  title: string;
  eventTitle?: string;
  event_type?: string;
  type?: string;
  eventDateTime?: any;
  event_venue: string;
  eventVenue?: string;
  eventRegistrationLink?: string;
  hosting_club: string;
  hostingClub?: string;
  organization_username?: string;
  about_event: string;
  aboutEvent?: string;
  event_image: string;
  eventImage?: string;
  event_categories?: string[];
  eventCategories?: string[];
  event_languages?: string;
  event_duration?: string;
  event_age_limit?: string;
  time_slots?: TimeSlot[];
  tickets?: TicketType[];
  event_guides?: { [key: string]: string };
  creator?: {
    type: 'artist' | 'organisation' | 'venue';
    pageId: string;
    name: string;
    username: string;
    userId: string;
  };
}

interface CreatorProfile {
  photoURL?: string;
  profileImage?: string;
  name: string;
}

interface Attendee {
  tickets: Record<string, number>;
  eventId: string;
}

function EventProfile() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllGuides, setShowAllGuides] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isOrganization, setIsOrganization] = useState<boolean>(false);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(null);
  const [ticketAvailability, setTicketAvailability] = useState<TicketType[]>([]);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Check if this is an organization session
        const orgSession = isOrganizationSession();
        
        if (orgSession) {
          // Check if organization profile exists
          try {
            const orgRef = doc(db, "Organisations", currentUser.uid);
            const orgSnap = await getDoc(orgRef);
            setIsOrganization(orgSnap.exists());
          } catch (error) {
            console.error("Error checking organization profile:", error);
            setIsOrganization(false);
          }
        } else {
          // This is a user session
          setIsOrganization(false);
        }
      } else {
        setIsOrganization(false);
      }
      
      setProfileLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Calculate real-time ticket availability
  const calculateTicketAvailability = async (eventData: EventData) => {
    if (!eventData.tickets || eventData.tickets.length === 0) return [];

    try {
      // Fetch actual attendees to calculate real availability
      const attendeesRef = collection(db, 'eventAttendees');
      const attendeesQuery = query(
        attendeesRef,
        where('eventId', '==', eventData.id)
      );

      const snapshot = await getDocs(attendeesQuery);
      const attendees = snapshot.docs.map(doc => doc.data()) as Attendee[];

      // Calculate real-time availability
      const updatedTickets = eventData.tickets.map(ticket => {
        const soldCount = attendees.reduce((count, attendee) => 
          count + (attendee.tickets[ticket.name] || 0), 0
        );
        
        return {
          ...ticket,
          available_capacity: Math.max(0, ticket.capacity - soldCount)
        };
      });

      setTicketAvailability(updatedTickets);
      return updatedTickets;
    } catch (error) {
      console.error('Error calculating ticket availability:', error);
      // Fallback to original capacity if calculation fails
      setTicketAvailability(eventData.tickets || []);
      return eventData.tickets || [];
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Date not set';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date format';
    }
  };

  const formatTime = (timeString: string | undefined) => {
    if (!timeString) return 'Time not set';
    
    try {
      const [hours, minutes] = timeString.split(':');
      if (!hours || !minutes) return 'Invalid time format';
      
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'Invalid time format';
    }
  };

  const handleLocationClick = () => {
    if (event?.event_venue) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.event_venue)}`;
      window.open(mapsUrl, '_blank');
    }
  };

  const getCreatorDisplayName = () => {
    if (event?.creator) {
      return event.creator.name;
    }
    return event?.hosting_club || event?.hostingClub || 'Unknown Creator';
  };

  const getCreatorType = () => {
    if (event?.creator) {
      return event.creator.type;
    }
    return 'organisation'; // Default for legacy events
  };

  const getAvailabilityStatus = (ticket: TicketType) => {
    const percentage = (ticket.available_capacity / ticket.capacity) * 100;
    if (ticket.available_capacity === 0) {
      return { status: 'sold-out', text: 'SOLD OUT', color: '#ef4444' };
    } else if (percentage <= 10) {
      return { status: 'critical', text: 'Almost Sold Out!', color: '#f59e0b' };
    } else if (percentage <= 25) {
      return { status: 'low', text: 'Limited Availability', color: '#f59e0b' };
    } else {
      return { status: 'high', text: 'Available', color: '#10b981' };
    }
  };

  useEffect(() => {
    const fetchEvent = async () => {
      if (!params?.id) return;

      try {
        const eventDoc = doc(db, "events", params.id);
        const eventSnapshot = await getDoc(eventDoc);
        
        if (eventSnapshot.exists()) {
          const data = eventSnapshot.data();
          const eventData: EventData = {
            id: eventSnapshot.id,
            title: data.title || data.eventTitle || '',
            eventTitle: data.eventTitle,
            event_type: data.event_type,
            type: data.type,
            eventDateTime: data.event_date_time || data.eventDateTime,
            event_venue: data.event_venue || data.eventVenue || '',
            eventVenue: data.eventVenue,
            eventRegistrationLink: data.event_registration_link || data.eventRegistrationLink,
            hosting_club: data.hosting_club || data.hostingClub || '',
            hostingClub: data.hostingClub,
            organization_username: data.organization_username || '',
            about_event: data.about_event || data.aboutEvent || '',
            aboutEvent: data.aboutEvent,
            event_image: data.event_image || data.eventImage || '',
            eventImage: data.eventImage,
            event_categories: data.event_categories || [],
            eventCategories: data.eventCategories || [],
            event_languages: data.event_languages || '',
            event_duration: data.event_duration || '',
            event_age_limit: data.event_age_limit || '',
            time_slots: data.time_slots || [],
            tickets: data.tickets || [],
            event_guides: data.event_guides || {},
            creator: data.creator || null
          };
          
          setEvent(eventData);
          
          // Calculate ticket availability
          await calculateTicketAvailability(eventData);
          
          // Fetch creator profile if creator exists
          if (eventData.creator) {
            fetchCreatorProfile(eventData.creator);
          }
        } else {
          setError("Event not found");
        }
      } catch (err) {
        console.error("Error fetching event:", err);
        setError("Error loading event");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [params?.id]);

  const handleBookNow = () => {
    console.log("Navigating to booking flow with ID:", params?.id);
    router.push(`/book-event/${params?.id}`);
  };

  const fetchCreatorProfile = async (creator: any) => {
    if (!creator) return;
    
    try {
      let collectionName = '';
      switch (creator.type) {
        case 'artist':
          collectionName = 'Artists';
          break;
        case 'organisation':
          collectionName = 'Organisations';
          break;
        case 'venue':
          collectionName = 'Venues';
          break;
        default:
          return;
      }
      
      const creatorDoc = doc(db, collectionName, creator.pageId);
      const creatorSnapshot = await getDoc(creatorDoc);
      
      if (creatorSnapshot.exists()) {
        const data = creatorSnapshot.data();
        setCreatorProfile({
          photoURL: data.photoURL || data.profileImage || '',
          profileImage: data.profileImage || data.photoURL || '',
          name: data.name || creator.name
        });
      }
    } catch (error) {
      console.error('Error fetching creator profile:', error);
    }
  };

  const handleCreatorClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (event?.creator) {
      // Use creator information for new events
      const { type, username } = event.creator;
      switch (type) {
        case 'artist':
          router.push(`/artist/${username}`);
          break;
        case 'organisation':
          router.push(`/organisation/${username}`);
          break;
        case 'venue':
          router.push(`/venue/${username}`);
          break;
        default:
          console.warn('Unknown creator type:', type);
      }
    } else if (event?.organization_username) {
      // Fallback to legacy organization link for old events
      router.push(`/organisation/${event.organization_username}`);
    }
  };

  if (loading || profileLoading) {
    return <EventProfileSkeleton />;
  }

  if (error || !event) {
    return <div className={styles.errorMessage}>{error || "Event not found"}</div>;
  }

  const { event_image, title, event_venue, hosting_club, about_event, time_slots } = event;

  // Determine the date text for the profile
  const dateText = time_slots && time_slots.length > 0 
    ? time_slots.length > 1 
      ? `${formatDate(time_slots[0].date)} onwards` 
      : formatDate(time_slots[0].date)
    : 'Date to be announced';

  // Calculate total starting price
  const startingPrice = ticketAvailability.length > 0 
    ? Math.min(...ticketAvailability.map(t => t.price))
    : 0;

  return (
    <div className={styles.eventProfileContainer}>
      <div className={styles.eventContent}>
        <div className={styles.eventProfileImage}>
          {event_image ? (
            <img src={event_image} alt={title} />
          ) : (
            <div className={styles.noImage}>No Image Available</div>
          )}
        </div>
        <div className={styles.eventInfoBox}>
          <div className={styles.eventInfo}>
            <h2>{title}</h2>
            <div 
              className={styles.hostingClub} 
              onClick={handleCreatorClick}
              style={{ cursor: 'pointer' }}
            >
              <div className={styles.creatorInfo}>
                By 
                {creatorProfile && (creatorProfile.photoURL || creatorProfile.profileImage) && (
                  <div className={styles.creatorAvatar}>
                    <img 
                      src={creatorProfile.photoURL || creatorProfile.profileImage} 
                      alt={getCreatorDisplayName()}
                      className={styles.creatorProfileImage}
                    />
                  </div>
                )}
                <span className={styles.organizationLink}>{getCreatorDisplayName()}</span>
              </div>
            </div>
            <div className={styles.eventDetail}>
              <FaCalendarAlt /> {dateText}
            </div>
            {time_slots && time_slots.map((slot, index) => (
              <div key={index} className={styles.eventDetail}>
                <FaClock /> {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
              </div>
            ))}
            <div 
              className={`${styles.eventDetail} ${styles.locationDetail}`}
              onClick={handleLocationClick}
              style={{ cursor: 'pointer' }}
            >
              <FaMapMarkerAlt /> {event_venue}
            </div>

            {/* Ticket Information */}
            {ticketAvailability.length > 0 && (
              <div className={styles.ticketInfo}>
                <div className={styles.priceDisplay}>
                  <FaRupeeSign />
                  <span className={styles.startingPrice}>
                    Starting from ₹{startingPrice}
                  </span>
                </div>
                <div className={styles.ticketTypes}>
                  {ticketAvailability.slice(0, 2).map((ticket, index) => {
                    const availability = getAvailabilityStatus(ticket);
                    return (
                      <div key={index} className={styles.ticketPreview}>
                        <span className={styles.ticketName}>{ticket.name}</span>
                        <span className={styles.ticketPrice}>₹{ticket.price}</span>
                        <span 
                          className={styles.availabilityBadge}
                          style={{ color: availability.color }}
                        >
                          {availability.text}
                        </span>
                      </div>
                    );
                  })}
                  {ticketAvailability.length > 2 && (
                    <div className={styles.moreTickets}>
                      +{ticketAvailability.length - 2} more ticket types
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Only show Book Now button for regular users, not organizations */}
            {!isOrganization && user && (
              <div className={styles.eventPrice}>
                <button 
                  className={styles.bookNowButton} 
                  onClick={handleBookNow}
                >
                  <FaTicketAlt />
                  Book Now
                </button>
              </div>
            )}

            {/* Show message for organizations */}
            {isOrganization && (
              <div className={styles.orgMessage}>
                <p>As an organization, you can explore events but cannot book them.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className={styles.aboutEvent}>
        <h3>About the Event</h3>
        <p>{about_event || "Join us for an engaging event designed to enhance your skills and creativity. Don't miss out on this opportunity!"}</p>
      </div>
      
      <div className={styles.eventGuide}>
        <h3>Event Guide</h3>
        <div className={styles.guideDetails}>
          {event.event_guides && Object.entries(event.event_guides)
            .slice(0, showAllGuides ? undefined : 3)
            .map(([key, value]) => {
              const guideOption = GUIDE_OPTIONS.find(option => option.id === key);
              if (!guideOption) return null;
              
              return (
                <div key={key} className={styles.guideItem}>
                  <div className={styles.guideIcon}>
                    <FaInfo />
                  </div>
                  <div className={styles.guideInfo}>
                    <span className={styles.guideLabel}>{guideOption.label}</span>
                    <span className={styles.guideValue}>{value}</span>
                  </div>
                </div>
              );
            })}
        </div>
        {event.event_guides && Object.keys(event.event_guides).length > 3 && (
          <button 
            className={styles.moreGuidesButton}
            onClick={() => setShowAllGuides(!showAllGuides)}
          >
            {showAllGuides ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>
    </div>
  );
}

export default EventProfile; 