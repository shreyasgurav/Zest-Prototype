"use client";

import React, { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import useEmblaCarousel from "embla-carousel-react";
import ActivityBox from "./ActivityBox/ActivityBox";
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import styles from "./ActivitySection.module.css";
import Link from 'next/link';
import ActivitySectionSkeleton from './ActivitySectionSkeleton';

interface Activity {
  id: string;
  activityName: string;
  activityLocation: string;
  aboutActivity: string;
  activity_image: string;
  organizationId: string;
  createdAt: any;
}

const ActivitySection = () => {
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
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

  // Filter activities based on selected city
  const filterActivitiesByLocation = useCallback((activities: Activity[], city: string) => {
    if (!city || city === 'All Cities') return activities;
    
    return activities.filter(activity => {
      const location = activity.activityLocation || '';
      // Check if location contains the city name (case insensitive)
      return location.toLowerCase().includes(city.toLowerCase());
    });
  }, []);

  // Update filtered activities when city or all activities change
  useEffect(() => {
    const filtered = filterActivitiesByLocation(allActivities, selectedCity);
    setFilteredActivities(filtered);
    console.log(`Filtered ${filtered.length} activities for ${selectedCity}`);
  }, [allActivities, selectedCity, filterActivitiesByLocation]);

  // Preload images
  const preloadImages = async (activitiesData: Activity[]) => {
    try {
      const imagePromises = activitiesData
        .filter(activity => activity.activity_image)
        .map(activity => {
          return new Promise((resolve) => {
            const img = new window.Image();
            img.onload = resolve;
            img.onerror = resolve;
            img.src = activity.activity_image;
          });
        });

      await Promise.all(imagePromises);
      setImagesLoaded(true);
    } catch (err) {
      console.error('Error preloading images:', err);
      setImagesLoaded(true); // Continue even if preloading fails
    }
  };

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        if (!db) throw new Error('Firebase is not initialized');

        const activitiesCollectionRef = collection(db, "activities");
        const q = query(activitiesCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        const activitiesData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            activityName: data.name || data.activityName || '',
            activityLocation: data.location || data.activityLocation || '',
            aboutActivity: data.about_activity || data.aboutActivity || '',
            activity_image: data.activity_image || '',
            organizationId: data.organizationId || '',
            createdAt: data.createdAt
          };
        }) as Activity[];
        
        setAllActivities(activitiesData);
        preloadImages(activitiesData);
        setError(null);
      } catch (error) {
        console.error('Error fetching activities:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch activities');
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const handleActivityDelete = (activityId: string) => {
    setAllActivities(prevActivities => prevActivities.filter(activity => activity.id !== activityId));
  };

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorMessage}>{error}</p>
      </div>
    );
  }

  if (loading || !imagesLoaded) {
    return <ActivitySectionSkeleton />;
  }

  if (!filteredActivities.length) {
    return (
      <div className={styles.activitySection}>
        <div className={styles.activitySectionHeading}>
          <h1 className={styles.upcomingActivitiesHeading}>Fun Activities</h1>
          <Link href="/activities" className={styles.seeAllLink}>See All</Link>
        </div>
        <div className={styles.noActivitiesMessage}>No activities available.</div>
      </div>
    );
  }

  return (
    <div className={styles.activitySection}>
      <div className={styles.activitySectionHeading}>
        <h1 className={styles.upcomingActivitiesHeading}>Fun Activities</h1>
        <Link href="/activities" className={styles.seeAllLink}>See All</Link>
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
              {filteredActivities.map((activity) => (
                <div className={styles.embla__slide} key={activity.id}>
                  <ActivityBox activity={activity} onDelete={handleActivityDelete} />
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

export default ActivitySection; 