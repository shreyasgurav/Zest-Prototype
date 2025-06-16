'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { MapPin, Calendar, Trash2, Users, Clock } from 'lucide-react';
import styles from './ActivityBox.module.css';

interface Activity {
  id: string;
  activityName: string;
  activityLocation: string;
  aboutActivity: string;
  activity_image: string;
  organizationId: string;
  activityType?: string;
  createdAt: any;
  time_slots?: Array<{
    date: string;
    start_time: string;
    end_time: string;
    available: boolean;
  }>;
}

interface ActivityBoxProps {
  activity: Activity;
  onDelete?: (id: string) => void;
}

export default function ActivityBox({ activity, onDelete }: ActivityBoxProps) {
  const router = useRouter();
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const isActivityCreator = currentUser && currentUser.uid === activity?.organizationId;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const timeSlots = Array.isArray(activity?.time_slots) ? activity.time_slots : [];
  const firstDate = timeSlots.length > 0 ? timeSlots[0].date : "No Date Available";
  const firstTime = timeSlots.length > 0 ? timeSlots[0].start_time : "";

  const formatDate = (dateString: string) => {
    if (dateString === "No Date Available") return "TBA";
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
      return words.slice(0, wordLimit).join(' ') + '...';
    }
    return text;
  };

  const handleClick = () => {
    router.push(`/activity-profile/${activity.id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isActivityCreator) return;

    try {
      if (window.confirm("Are you sure you want to delete this activity?")) {
        await deleteDoc(doc(db, "activities", activity.id));
        if (onDelete) {
          onDelete(activity.id);
        }
      }
    } catch (error) {
      console.error("Error deleting activity:", error);
      alert("Failed to delete activity. Please try again.");
    }
  };

  return (
    <div 
      className={styles.activityBoxWrapper} 
      onClick={handleClick}
    >
      <div className={styles.activityBoxCard}>
        {/* Delete Button */}
        {isActivityCreator && (
          <button 
            className={styles.deleteButton}
            onClick={handleDelete}
            aria-label="Delete activity"
          >
            <Trash2 className={styles.deleteIcon} />
          </button>
        )}

        {/* Image Section */}
        <div className={styles.imageSection}>
          {activity.activity_image && !imageError ? (
            <>
              <img
                src={activity.activity_image}
                alt={activity.activityName}
                className={`${styles.activityImage} ${imageLoaded ? styles.imageLoaded : styles.imageLoading}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
              {!imageLoaded && <div className={styles.imagePlaceholder} />}
            </>
          ) : (
            <div className={styles.noImagePlaceholder}>
              <Calendar className={styles.placeholderIcon} />
            </div>
          )}

          {/* Activity Type Badge */}
          {activity.activityType && (
            <div className={styles.activityTypeBadge}>
              <span>{activity.activityType}</span>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className={styles.activityBoxInfo}>
          {/* Title */}
          <h3>{truncateText(activity.activityName, 20)}</h3>

          {/* Location */}
          <div className={styles.infoRow}>
            <MapPin className={styles.locationIcon} />
            <span>{truncateText(activity.activityLocation, 25)}</span>
          </div>

          {/* Date & Time */}
          <div className={styles.infoRow}>
            <Clock className={styles.timeIcon} />
            <span>{formatDate(firstDate)} {firstTime && `• ${firstTime}`}</span>
          </div>

          {/* About */}
          <div className={styles.infoRow}>
            <Users className={styles.aboutIcon} />
            <span>{truncateText(activity.aboutActivity, 20)}</span>
          </div>
        </div>
      </div>
    </div>
  );
} 