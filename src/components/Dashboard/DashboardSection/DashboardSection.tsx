import React, { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getAuth } from 'firebase/auth';
import DashboardBox from '../DashboardBox/DashboardBox';
import styles from './DashboardSection.module.css';

interface Event {
  id: string;
  title: string;
  image?: string;
  type: 'event';
}

interface Activity {
  id: string;
  name: string;
  activity_image?: string;
  type: 'activity';
}

type DashboardItem = Event | Activity;

interface DashboardSectionProps {
  pageId?: string;
  pageType?: 'artist' | 'organisation' | 'venue';
}

const DashboardSection: React.FC<DashboardSectionProps> = ({ pageId, pageType }) => {
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const fetchOrganizerContent = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }

      try {
        // Fetch events - filter by specific page if provided, otherwise by user
        const eventsCollectionRef = collection(db, "events");
        let eventsData: Event[] = [];
        
        if (pageId && pageType) {
          // Filter events by specific page creator (new events) + fallback for legacy events
          const [newEventsSnapshot, legacyEventsSnapshot] = await Promise.all([
            getDocs(query(eventsCollectionRef, where("creator.pageId", "==", pageId))),
            getDocs(query(eventsCollectionRef, where("organizationId", "==", auth.currentUser.uid)))
          ]);
          
          // For new events, use creator.pageId directly
          const newEvents = newEventsSnapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title || doc.data().eventTitle,
            image: doc.data().event_image,
            type: 'event' as const
          }));
          
          // For legacy events, filter by page type matching
          const legacyEvents = legacyEventsSnapshot.docs
            .filter(doc => {
              const data = doc.data();
              // Only include legacy events that don't have creator field
              if (data.creator) return false;
              // For now, include all legacy events for organizations (they were the only ones creating events before)
              return pageType === 'organisation';
            })
            .map(doc => ({
              id: doc.id,
              title: doc.data().title || doc.data().eventTitle,
              image: doc.data().event_image,
              type: 'event' as const
            }));
          
          // Combine and deduplicate
          const allEvents = [...newEvents, ...legacyEvents];
          eventsData = allEvents.filter((event, index, self) => 
            index === self.findIndex(e => e.id === event.id)
          );
        } else {
          // Fallback to old behavior for general dashboard
          const eventsSnapshot = await getDocs(query(
            eventsCollectionRef,
            where("organizationId", "==", auth.currentUser.uid)
          ));
          eventsData = eventsSnapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title || doc.data().eventTitle,
            image: doc.data().event_image,
            type: 'event' as const
          }));
        }

        // Fetch activities - similar logic
        const activitiesCollectionRef = collection(db, "activities");
        let activitiesData: Activity[] = [];
        
        if (pageId && pageType) {
          // Filter activities by specific page creator (when implemented)
          const [newActivitiesSnapshot, legacyActivitiesSnapshot] = await Promise.all([
            getDocs(query(activitiesCollectionRef, where("creator.pageId", "==", pageId))),
            getDocs(query(activitiesCollectionRef, where("organizationId", "==", auth.currentUser.uid)))
          ]);
          
          // For new activities, use creator.pageId directly
          const newActivities = newActivitiesSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            activity_image: doc.data().activity_image,
            type: 'activity' as const
          }));
          
          // For legacy activities, filter by page type matching
          const legacyActivities = legacyActivitiesSnapshot.docs
            .filter(doc => {
              const data = doc.data();
              // Only include legacy activities that don't have creator field
              if (data.creator) return false;
              // For now, include all legacy activities for organizations
              return pageType === 'organisation';
            })
            .map(doc => ({
              id: doc.id,
              name: doc.data().name,
              activity_image: doc.data().activity_image,
              type: 'activity' as const
            }));
          
          // Combine and deduplicate
          const allActivities = [...newActivities, ...legacyActivities];
          activitiesData = allActivities.filter((activity, index, self) => 
            index === self.findIndex(a => a.id === activity.id)
          );
        } else {
          // Fallback to old behavior
          const activitiesSnapshot = await getDocs(query(
            activitiesCollectionRef,
            where("organizationId", "==", auth.currentUser.uid)
          ));
          activitiesData = activitiesSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            activity_image: doc.data().activity_image,
            type: 'activity' as const
          }));
        }

        // Combine both arrays
        const combinedItems: DashboardItem[] = [...eventsData, ...activitiesData];
        setItems(combinedItems);
      } catch (error) {
        console.error("Error fetching organizer content:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizerContent();
  }, [pageId, pageType]);

  if (loading) {
    return (
      <div className={styles.dashboardSection}>
        <div className={styles.loadingSkeleton}>
          <div className={styles.skeletonTitle}></div>
          <div className={styles.skeletonBox}></div>
          <div className={styles.skeletonBox}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardSection}>
      <h2 className={styles.dashboardTitle}>My Events & Activities</h2>
      <div className={styles.dashboardEventsContainer}>
        {items.length === 0 ? (
          <div className={styles.noEventsMessage}>
            You haven't created any events or activities yet.
          </div>
        ) : (
          items.map((item) => (
            <DashboardBox key={`${item.type}-${item.id}`} item={item} />
          ))
        )}
      </div>
    </div>
  );
};

export default DashboardSection; 