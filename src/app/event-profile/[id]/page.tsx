'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import styles from './EventProfile.module.css';
import { FaBookmark, FaCalendarAlt, FaMapMarkerAlt, FaLanguage, FaClock, FaUsers } from 'react-icons/fa';
import EventProfileSkeleton from './EventProfileSkeleton';

interface TimeSlot {
  date: string;
  start_time: string;
  end_time: string;
  available: boolean;
}

interface EventData {
  id: string;
  eventTitle: string;
  type: string;
  eventDateTime?: any;
  eventVenue: string;
  eventRegistrationLink?: string;
  hostingClub: string;
  organization_username?: string;
  aboutEvent: string;
  eventImage: string;
  event_category?: string;
  event_languages?: string;
  event_duration?: string;
  event_age_limit?: string;
  time_slots?: TimeSlot[];
}

function EventProfile() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!params?.id) return;

      try {
        const eventDoc = doc(db, "events", params.id);
        const eventSnapshot = await getDoc(eventDoc);
        
        if (eventSnapshot.exists()) {
          const data = eventSnapshot.data();
          setEvent({
            id: eventSnapshot.id,
            eventTitle: data.title || data.eventTitle || '',
            type: data.event_type || data.type || 'event',
            eventDateTime: data.event_date_time || data.eventDateTime,
            eventVenue: data.event_venue || data.eventVenue || '',
            eventRegistrationLink: data.event_registration_link || data.eventRegistrationLink,
            hostingClub: data.hosting_club || data.hostingClub || '',
            organization_username: data.organization_username || '',
            aboutEvent: data.about_event || data.aboutEvent || '',
            eventImage: data.event_image || data.eventImage || '',
            event_category: data.event_category || '',
            event_languages: data.event_languages || '',
            event_duration: data.event_duration || '',
            event_age_limit: data.event_age_limit || '',
            time_slots: data.time_slots || []
          });
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

  const handleOrganizationClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (event?.organization_username) {
      router.push(`/organisation/${event.organization_username}`);
    }
  };

  if (loading) {
    return <EventProfileSkeleton />;
  }

  if (error || !event) {
    return <div className={styles.errorMessage}>{error || "Event not found"}</div>;
  }

  const { eventImage, eventTitle, eventVenue, hostingClub, aboutEvent, time_slots } = event;

  // Determine the date text for the profile
  const dateText = time_slots && time_slots.length > 1 
    ? `${time_slots[0].date} onwards` 
    : time_slots?.[0]?.date || 'Date to be announced';

  return (
    <div className={styles.eventProfileContainer}>
      <div className={styles.eventContent}>
        <div className={styles.eventProfileImage}>
          {eventImage ? (
            <img src={eventImage} alt={eventTitle} />
          ) : (
            <div className={styles.noImage}>No Image Available</div>
          )}
        </div>
        <div className={styles.eventInfoBox}>
          <div className={styles.eventInfo}>
            <h2>{eventTitle}</h2>
            <div 
              className={styles.hostingClub} 
              onClick={handleOrganizationClick}
              style={{ cursor: 'pointer' }}
            >
              By <span className={styles.organizationLink}>{hostingClub}</span>
            </div>
            {event.event_category && (
              <div className={styles.eventDetail}>
                <FaBookmark /> {event.event_category}
              </div>
            )}
            <div className={styles.eventDetail}>
              <FaCalendarAlt /> {dateText}
            </div>
            {time_slots && time_slots.map((slot, index) => (
              <div key={index} className={styles.eventDetail}>
                <FaClock /> {slot.start_time} - {slot.end_time}
              </div>
            ))}
            <div className={styles.eventDetail}>
              <FaMapMarkerAlt /> {eventVenue}
            </div>
            <div className={styles.eventPrice}>
              <button 
                className={styles.bookNowButton} 
                onClick={handleBookNow}
              >
                Book Now
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className={styles.aboutEvent}>
        <h3>About the Event</h3>
        <p>{aboutEvent || "Join us for an engaging event designed to enhance your skills and creativity. Don't miss out on this opportunity!"}</p>
      </div>
      
      <div className={styles.eventGuide}>
        <h3>Event Guide</h3>
        <div className={styles.guideDetails}>
          {event.event_languages && (
            <div className={styles.guideItem}>
              <div className={styles.guideIcon}>
                <FaLanguage />
              </div>
              <div className={styles.guideInfo}>
                <span className={styles.guideLabel}>Language</span>
                <span className={styles.guideValue}>{event.event_languages}</span>
              </div>
            </div>
          )}
          
          {event.event_duration && (
            <div className={styles.guideItem}>
              <div className={styles.guideIcon}>
                <FaClock />
              </div>
              <div className={styles.guideInfo}>
                <span className={styles.guideLabel}>Duration</span>
                <span className={styles.guideValue}>{event.event_duration}</span>
              </div>
            </div>
          )}
          
          {event.event_age_limit && (
            <div className={styles.guideItem}>
              <div className={styles.guideIcon}>
                <FaUsers />
              </div>
              <div className={styles.guideInfo}>
                <span className={styles.guideLabel}>Best Suited For Ages</span>
                <span className={styles.guideValue}>{event.event_age_limit}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EventProfile; 