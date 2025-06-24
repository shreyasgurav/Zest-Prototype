"use client";

import React, { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import useEmblaCarousel from "embla-carousel-react";
import EventBox from "./EventBox/EventBox";
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import styles from "./EventsSection.module.css";
import Link from 'next/link';
import EventsSectionSkeleton from './EventsSectionSkeleton';

const EventsSection = () => {
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState('Mumbai');

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
    slidesToScroll: 1
  });

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  const [prevBtnEnabled, setPrevBtnEnabled] = useState(false);
  const [nextBtnEnabled, setNextBtnEnabled] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setPrevBtnEnabled(emblaApi.canScrollPrev());
    setNextBtnEnabled(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  // Listen for location changes
  useEffect(() => {
    // Get initial city from localStorage
    const storedCity = localStorage.getItem('selectedCity');
    if (storedCity) {
      setSelectedCity(storedCity);
    }

    // Listen for location changes from header
    const handleLocationChange = (event: CustomEvent) => {
      setSelectedCity(event.detail.city);
    };

    window.addEventListener('locationChanged', handleLocationChange as EventListener);
    
    return () => {
      window.removeEventListener('locationChanged', handleLocationChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const fetchEventIds = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!db) throw new Error('Firebase is not initialized');

        const eventsCollectionRef = collection(db, "events");
        const q = query(eventsCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        // Just get the IDs, let EventBox fetch its own data
        const ids = querySnapshot.docs.map(doc => doc.id);
        
        // Limit to first 10 for carousel
        setEventIds(ids.slice(0, 10));
        
        console.log(`Fetched ${ids.length} event IDs`);
        
      } catch (error) {
        console.error('Error fetching event IDs:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch events');
      } finally {
        setLoading(false);
      }
    };

    fetchEventIds();
  }, []);

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorMessage}>{error}</p>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return <EventsSectionSkeleton />;
  }

  if (!eventIds.length) {
    return (
      <div className={styles.eventsSection}>
        <div className={styles.eventsSectionHeading}>
          <h1 className={styles.upcomingEventsHeading}>Upcoming Events</h1>
          <Link href="/events" className={styles.seeAllLink}>See All</Link>
        </div>
        <div className={styles.noEventsMessage}>No events available.</div>
      </div>
    );
  }

  return (
    <div className={styles.eventsSection}>
      <div className={styles.eventsSectionHeading}>
        <h1 className={styles.upcomingEventsHeading}>Upcoming Events</h1>
        <Link href="/events" className={styles.seeAllLink}>See All</Link>
      </div>

      <div className={styles.emblaContainer}>
        <button 
          className={`${styles.emblaButton} ${styles.emblaButtonPrev} ${!prevBtnEnabled ? styles.emblaButtonDisabled : ''}`}
          onClick={scrollPrev}
          disabled={!prevBtnEnabled}
        >
          <FiChevronLeft />
        </button>

        <div className={styles.embla}>
          <div className={styles.embla__viewport} ref={emblaRef}>
            <div className={styles.embla__container}>
              {eventIds.map((eventId) => (
                <div className={styles.embla__slide} key={eventId}>
                  <EventBox eventId={eventId} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <button 
          className={`${styles.emblaButton} ${styles.emblaButtonNext} ${!nextBtnEnabled ? styles.emblaButtonDisabled : ''}`}
          onClick={scrollNext}
          disabled={!nextBtnEnabled}
        >
          <FiChevronRight />
        </button>
      </div>
    </div>
  );
};

export default EventsSection; 