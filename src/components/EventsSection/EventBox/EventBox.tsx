'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Calendar, Clock, Music, Mic, PartyPopper } from 'lucide-react';
import { db } from '@/services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import styles from './EventBox.module.css';

interface EventBoxProps {
  eventId: string;
  isCollaboration?: boolean;
  collaboratorPageName?: string;
}

interface Event {
  id: string;
  title?: string;
  eventTitle?: string;
  eventType?: string;
  event_categories?: string[];
  eventCategories?: string[];
  hosting_club?: string;
  hostingClub?: string;
  eventDateTime?: any;
  event_venue?: string;
  eventVenue?: string;
  eventRegistrationLink?: string;
  about_event?: string;
  aboutEvent?: string;
  event_image?: string;
  organizationId?: string;
  time_slots?: Array<{
    date: string;
    start_time: string;
    end_time: string;
    available: boolean;
  }>;
  createdAt?: any;
}

export default function EventBox({ eventId, isCollaboration = false, collaboratorPageName }: EventBoxProps) {
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const eventDoc = await getDoc(doc(db(), 'events', eventId));
        
        if (eventDoc.exists()) {
          const eventData = {
            id: eventDoc.id,
            ...eventDoc.data()
          } as Event;
          setEvent(eventData);
        } else {
          setError('Event not found');
        }
      } catch (err) {
        console.error('Error fetching event:', err);
        setError('Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === "No Date Available") return "TBA";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const truncateText = (text: string, wordLimit: number): string => {
    if (!text) return "";
    const words = text.trim().split(/\s+/);
    if (words.length > wordLimit) {
      return words.slice(0, wordLimit).join(" ") + "...";
    }
    return text;
  };

  const getEventTypeIcon = (eventType: string | undefined) => {
    if (!eventType) return <Calendar className={styles.eventTypeIcon} />;
    
    switch (eventType.toLowerCase()) {
      case "concert":
      case "music":
        return <Music className={styles.eventTypeIcon} />;
      case "comedy":
      case "standup":
        return <Mic className={styles.eventTypeIcon} />;
      case "party":
      case "festival":
      case "celebration":
      case "clubbing":
        return <PartyPopper className={styles.eventTypeIcon} />;
      default:
        return <Calendar className={styles.eventTypeIcon} />;
    }
  };

  const getEventTypeColor = (eventType: string | undefined) => {
    if (!eventType) return "default";
    
    switch (eventType.toLowerCase()) {
      case "concert":
      case "music":
        return "music";
      case "comedy":
      case "standup":
        return "comedy";
      case "party":
      case "festival":
      case "celebration":
      case "clubbing":
        return "party";
      case "theater":
      case "drama":
        return "theater";
      default:
        return "default";
    }
  };

  const handleClick = () => {
    if (event) {
      router.push(`/event-profile/${event.id}`);
    }
  };

  if (loading) {
    return (
      <div className={styles.eventBoxWrapper}>
        <div className={styles.eventBoxCard}>
          <div className={styles.imageSection}>
            <div className={styles.imagePlaceholder} />
          </div>
          <div className={styles.eventBoxInfo}>
            <h3>Loading...</h3>
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className={styles.eventBoxWrapper}>
        <div className={styles.eventBoxCard}>
          <div className={styles.imageSection}>
            <div className={styles.noImagePlaceholder}>
              <Calendar className={styles.eventTypeIcon} />
            </div>
          </div>
          <div className={styles.eventBoxInfo}>
            <h3>{error || 'Event not found'}</h3>
          </div>
        </div>
      </div>
    );
  }

  const timeSlots = Array.isArray(event?.time_slots) ? event.time_slots : [];
  const firstDate = timeSlots.length > 0 ? timeSlots[0].date : "No Date Available";
  const firstTime = timeSlots.length > 0 ? timeSlots[0].start_time : "";
  
  // Use first category from eventCategories array, fallback to eventType, then to default
  const displayEventType = event.event_categories && event.event_categories.length > 0 
    ? event.event_categories[0] 
    : event.eventCategories && event.eventCategories.length > 0 
    ? event.eventCategories[0]
    : event.eventType || "event";

  const eventTitle = event.title || event.eventTitle || "";
  const eventVenue = event.event_venue || event.eventVenue || "";

  return (
    <div className={styles.eventBoxWrapper} onClick={handleClick}>
      <div className={styles.eventBoxCard}>
        {/* Image Section */}
        <div className={styles.imageSection}>
          {event.event_image && !imageError ? (
            <>
              <img
                src={event.event_image}
                alt={eventTitle}
                className={`${styles.eventImage} ${imageLoaded ? styles.imageLoaded : styles.imageLoading}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
              {!imageLoaded && <div className={styles.imagePlaceholder} />}
            </>
          ) : (
            <div className={styles.noImagePlaceholder}>
              {getEventTypeIcon(displayEventType)}
            </div>
          )}

          {/* COLLAB Badge - NEW */}
          {isCollaboration && (
            <div className={styles.collabBadge}>
              COLLAB
            </div>
          )}

          {/* Event Type Badge */}
          <div className={`${styles.eventTypeBadge} ${styles[getEventTypeColor(displayEventType)]}`}>
            {getEventTypeIcon(displayEventType)}
            <span>{displayEventType}</span>
          </div>
        </div>

        {/* Content Section */}
        <div className={styles.eventBoxInfo}>
          {/* Title */}
          <h3>{truncateText(eventTitle, 20)}</h3>

          {/* Collaboration Indicator - NEW */}
          {isCollaboration && collaboratorPageName && (
            <div className={styles.collaborationInfo}>
              🤝 Collaborating with {collaboratorPageName}
            </div>
          )}

          {/* Date & Time */}
          <div className={styles.infoRow}>
            <Clock className={styles.timeIcon} />
            <span>
              {formatDate(firstDate)} {firstTime && `• ${firstTime}`}
            </span>
          </div>

          {/* Venue */}
          <div className={styles.infoRow}>
            <MapPin className={styles.venueIcon} />
            <span className={styles.venueText}>
              {truncateText(eventVenue, 25)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
} 