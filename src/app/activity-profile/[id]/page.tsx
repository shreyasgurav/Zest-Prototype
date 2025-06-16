'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import styles from './ActivityProfile.module.css';
import { FaBookmark, FaMapMarkerAlt, FaLanguage, FaClock, FaUsers, FaCalendarAlt, FaMoneyBillWave } from 'react-icons/fa';
import ActivityProfileSkeleton from './ActivityProfileSkeleton';

interface TimeSlot {
  startTime: string;
  endTime: string;
  capacity: number;
}

interface DaySchedule {
  day: string;
  isOpen: boolean;
  timeSlots: TimeSlot[];
}

interface ActivityData {
  id: string;
  name: string;
  activity_type: string;
  location: string;
  about_activity: string;
  activity_image: string;
  organizationId: string;
  hosting_organization: string;
  organization_username?: string;
  activity_category: string;
  activity_languages: string;
  activity_duration: string;
  activity_age_limit: string;
  price_per_slot: number;
  weekly_schedule: {
    day: string;
    is_open: boolean;
    time_slots: {
      start_time: string;
      end_time: string;
      capacity: number;
      available_capacity: number;
    }[];
  }[];
  closed_dates: string[];
  createdAt: string;
}

function ActivityProfile() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const fetchActivity = async () => {
      if (!params?.id) return;

      try {
        const activityDoc = doc(db, "activities", params.id);
        const activitySnapshot = await getDoc(activityDoc);
        
        if (activitySnapshot.exists()) {
          const data = activitySnapshot.data();
          setActivity({
            id: activitySnapshot.id,
            ...data
          } as ActivityData);
        } else {
          setError("Activity not found");
        }
      } catch (err) {
        console.error("Error fetching activity:", err);
        setError("Error loading activity");
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [params?.id]);

  const handleBookNow = () => {
    router.push(`/book-activity/${params?.id}`);
  };

  const handleOrganizationClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (activity?.organization_username) {
      router.push(`/organisation/${activity.organization_username}`);
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  if (loading) {
    return <ActivityProfileSkeleton />;
  }

  if (error || !activity) {
    return <div className={styles.errorMessage}>{error || "Activity not found"}</div>;
  }

  const { activity_image, name, location, hosting_organization, about_activity, activity_category, price_per_slot } = activity;

  return (
    <div className={styles.activityProfileContainer}>
      <div className={styles.activityContent}>
        <div className={styles.activityProfileImage}>
          {activity_image && !imageError ? (
            <Image
              src={activity_image}
              alt={name}
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              style={{ objectFit: 'cover' }}
              onError={handleImageError}
              priority
            />
          ) : (
            <div className={styles.noImage}>No Image Available</div>
          )}
        </div>
        <div className={styles.activityInfoBox}>
          <div className={styles.activityInfo}>
            <h2>{name}</h2>
            <div 
              className={styles.organizationName} 
              onClick={handleOrganizationClick}
              style={{ cursor: 'pointer' }}
            >
              By <span className={styles.organizationLink}>{hosting_organization}</span>
            </div>
            {activity_category && (
              <div className={styles.activityDetail}>
                <FaBookmark /> {activity_category}
              </div>
            )}
            <div className={styles.activityDetail}>
              <FaMapMarkerAlt /> {location}
            </div>
            <div className={styles.activityPrice}>
              <span>Starting at ₹{price_per_slot}</span>
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
      
      <div className={styles.aboutActivity}>
        <h3>About the Activity</h3>
        <p>{about_activity || "Join us for an engaging activity designed to enhance your skills and creativity. Don't miss out on this opportunity!"}</p>
      </div>
      
      <div className={styles.activityGuide}>
        <h3>Activity Guide</h3>
        <div className={styles.guideDetails}>
          {activity.activity_languages && (
            <div className={styles.guideItem}>
              <div className={styles.guideIcon}>
                <FaLanguage />
              </div>
              <div className={styles.guideInfo}>
                <span className={styles.guideLabel}>Language</span>
                <span className={styles.guideValue}>{activity.activity_languages}</span>
              </div>
            </div>
          )}
          
          {activity.activity_duration && (
            <div className={styles.guideItem}>
              <div className={styles.guideIcon}>
                <FaClock />
              </div>
              <div className={styles.guideInfo}>
                <span className={styles.guideLabel}>Duration</span>
                <span className={styles.guideValue}>{activity.activity_duration}</span>
              </div>
            </div>
          )}
          
          {activity.activity_age_limit && (
            <div className={styles.guideItem}>
              <div className={styles.guideIcon}>
                <FaUsers />
              </div>
              <div className={styles.guideInfo}>
                <span className={styles.guideLabel}>Best Suited For Ages</span>
                <span className={styles.guideValue}>{activity.activity_age_limit}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ActivityProfile; 