'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './activities.module.css';
import { Calendar, MapPin, Clock, Building2, Music, PartyPopper, Palette, Beer, Mountain, Trophy, Users, Sun, Sparkles, User, Heart } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import ActivityBox from '@/components/ActivitySection/ActivityBox/ActivityBox';

// Activity type definition
interface Activity {
  id: string;
  activityName: string;
  aboutActivity: string;
  activity_image: string;
  activityDateTime: string;
  activityLocation: string;
  activityType: string;
  hostingClub: string;
  maxParticipants: number;
  currentParticipants: number;
  organizationId: string;
  createdAt: any;
  time_slots?: Array<{
    date: string;
    start_time: string;
    end_time: string;
    available: boolean;
  }>;
}

// Filter type definition
type FilterType = 'all' | 'games' | 'adventure' | 'art' | 'indoor' | 'outdoor' | 'solo' | 'couple' | 'group';

const activityTypes = [
  { id: 'all', label: 'All Activities', icon: PartyPopper },
  { id: 'games', label: 'Games', icon: Trophy },
  { id: 'adventure', label: 'Adventure', icon: Mountain },
  { id: 'art', label: 'Art', icon: Palette },
  { id: 'indoor', label: 'Indoor', icon: Building2 },
  { id: 'outdoor', label: 'Outdoor', icon: Sun },
  { id: 'solo', label: 'Solo', icon: User },
  { id: 'couple', label: 'Couple', icon: Heart },
  { id: 'group', label: 'Group', icon: Users }
];

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [isHeaderLoaded, setIsHeaderLoaded] = useState(false);

  // Load header and filters first
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsHeaderLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Load activities after header is loaded
  useEffect(() => {
    if (isHeaderLoaded) {
      const loadActivities = async () => {
        try {
          // Remove the limit to fetch all activities
          const activitiesQuery = query(
            collection(db, "activities"),
            orderBy("createdAt", "desc")
          );
          const querySnapshot = await getDocs(activitiesQuery);
          const activitiesData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Activity[];
          
          // Sort activities by date (most recent first)
          const sortedActivities = activitiesData.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          setActivities(sortedActivities);
          setFilteredActivities(sortedActivities);
          
          // Add a small delay before showing activities for smooth transition
          setTimeout(() => {
            setLoading(false);
          }, 500);
        } catch (error) {
          console.error("Error loading activities:", error);
          setLoading(false);
        }
      };

      loadActivities();
    }
  }, [isHeaderLoaded]);

  const handleFilter = (filter: FilterType) => {
    setActiveFilter(filter);
    if (filter === 'all') {
      setFilteredActivities(activities);
    } else {
      const filtered = activities.filter(activity => {
        const activityType = activity.activityType.toLowerCase();
        // Handle special cases for indoor/outdoor
        if (filter === 'indoor' && activityType.includes('indoor')) return true;
        if (filter === 'outdoor' && activityType.includes('outdoor')) return true;
        // Handle special cases for participation type
        if (filter === 'solo' && activityType.includes('solo')) return true;
        if (filter === 'couple' && activityType.includes('couple')) return true;
        if (filter === 'group' && activityType.includes('group')) return true;
        // Handle other categories
        return activityType === filter;
      });
      setFilteredActivities(filtered);
    }
  };

  const getActivityTypeIcon = (type: string) => {
    const IconComponent = activityTypes.find(t => t.id === type.toLowerCase())?.icon || PartyPopper;
    return <IconComponent className={styles.activityTypeIcon} />;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy • h:mm a');
    } catch (error) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.wrapper}>
          <div className={styles.loading}>
            <div className={styles.loadingSpinner}>
              <div className={styles.spinner}></div>
              <div className={styles.spinnerSecondary}></div>
            </div>
            <p className={styles.loadingText}>Loading activities...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        {/* Header Section - Loads First */}
        <div className={`${styles.header} ${isHeaderLoaded ? styles.fadeIn : ''}`}>
          <h1 className={styles.title}>Discover Activities</h1>
          <p className={styles.subtitle}>
            Find your perfect activity - from solo adventures to group experiences, indoor fun to outdoor excitement.
          </p>
        </div>

        {/* Filters Section - Loads with Header */}
        {isHeaderLoaded && (
          <div className={styles.filters}>
            {activityTypes.map((type) => (
              <button
                key={type.id}
                className={`${styles.filterButton} ${activeFilter === type.id ? styles[`${type.id}Active`] : ''}`}
                onClick={() => handleFilter(type.id as FilterType)}
              >
                <type.icon className={styles.filterIcon} />
                <span>{type.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Activities Grid - Loads Last */}
        {isHeaderLoaded && (
          <>
            {filteredActivities.length > 0 && (
              <div className={styles.activitiesCount}>
                Showing {filteredActivities.length} {filteredActivities.length === 1 ? 'activity' : 'activities'}
              </div>
            )}
            <div className={styles.activitiesGrid}>
              {filteredActivities.length > 0 ? (
                filteredActivities.map((activity, index) => (
                  <div 
                    key={activity.id} 
                    className={`${styles.activityCardWrapper} ${styles[`animationDelay${(index % 9) + 1}`]}`}
                  >
                    <ActivityBox activity={activity} />
                  </div>
                ))
              ) : (
                <div className={styles.noActivities}>
                  <div className={styles.noActivitiesIcon}>
                    <PartyPopper className={styles.noActivitiesIconSvg} />
                  </div>
                  <h2 className={styles.noActivitiesTitle}>No Activities Found</h2>
                  <p className={styles.noActivitiesText}>
                    {activeFilter === 'all' 
                      ? "There are no activities available at the moment. Check back later!"
                      : `No ${activeFilter} activities found. Try a different category or check back later.`}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
} 