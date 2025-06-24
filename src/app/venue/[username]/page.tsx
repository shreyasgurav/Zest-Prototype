'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { checkPageOwnership } from '../../../utils/authHelpers';
import styles from './PublicVenueProfile.module.css';

interface VenueData {
  uid?: string;
  name?: string;
  username?: string;
  bio?: string;
  photoURL?: string;
  bannerImage?: string;
  venueType?: string;
  address?: string;
  city?: string;
  capacity?: number;
  ownerId?: string;
}

const PublicVenueProfile = () => {
  const params = useParams();
  const username = params?.username as string | undefined;
  const [venueDetails, setVenueDetails] = useState<VenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Check if current user can manage this page
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchVenueData = async () => {
      if (!username) {
        setError("Username is required");
        setLoading(false);
        return;
      }

      try {
        const db = getFirestore();
        
        // First, find the venue by username
        const venuesQuery = query(
          collection(db, "Venues"),
          where("username", "==", username.toLowerCase())
        );
        const venueSnapshot = await getDocs(venuesQuery);
        
        if (venueSnapshot.empty) {
          setError("Venue not found");
          setLoading(false);
          return;
        }

        const venueDoc = venueSnapshot.docs[0];
        const venueData = venueDoc.data() as VenueData;
        venueData.uid = venueDoc.id;
        setVenueDetails(venueData);

        // Check if current user can manage this page
        if (currentUser && venueData.uid) {
          const canEdit = await checkPageOwnership(currentUser.uid, 'venue', venueData.uid);
          setCanManage(canEdit);
        }

        setError(null);
      } catch (err) {
        console.error("Error fetching venue data:", err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchVenueData();
  }, [username, currentUser]);

  const handleManage = () => {
    // Redirect to management interface
    window.location.href = `/venue?page=${venueDetails?.uid}`;
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.skeletonBanner}></div>
        <div className={styles.skeletonProfileImage}></div>
        <div className={styles.skeletonContent}>
          <div className={styles.skeletonName}></div>
          <div className={styles.skeletonUsername}></div>
          <div className={styles.skeletonBio}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!venueDetails) {
    return (
      <div className={styles.errorContainer}>
        <h2>Venue Not Found</h2>
        <p>The venue you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className={styles.venueProfileContainer}>
      {/* Banner and Profile Image Section */}
      <div className={styles.venueBannerSection}>
        <div className={styles.venueBanner}>
          {venueDetails.bannerImage ? (
            <img
              src={venueDetails.bannerImage}
              alt="Venue Banner"
              className={styles.bannerImage}
            />
          ) : (
            <div className={styles.defaultBanner} />
          )}
        </div>
        <div className={styles.venueProfileImageContainer}>
          {venueDetails.photoURL ? (
            <img 
              src={venueDetails.photoURL} 
              alt="Profile"
              className={styles.venueProfileImage}
            />
          ) : (
            <div className={styles.noPhoto}>No profile photo</div>
          )}
        </div>
      </div>

      {/* Venue Details Section */}
      <div className={styles.venueDetailsSection}>
        <div className={styles.venueHeader}>
          <div className={styles.venueInfo}>
            <div className={styles.venueName}>
              <h1>{venueDetails.name || "Venue Name"}</h1>
            </div>
            <div className={styles.venueUsername}>
              <span>@{venueDetails.username || "username"}</span>
            </div>
            
            <div className={styles.venueMetadata}>
              {venueDetails.venueType && (
                <div className={styles.venueType}>
                  <span>{venueDetails.venueType}</span>
                </div>
              )}
              {venueDetails.capacity && (
                <div className={styles.venueCapacity}>
                  <span>👥 Capacity: {venueDetails.capacity}</span>
                </div>
              )}
              {(venueDetails.address || venueDetails.city) && (
                <div className={styles.venueLocation}>
                  <span>📍 {[venueDetails.address, venueDetails.city].filter(Boolean).join(', ')}</span>
                </div>
              )}
            </div>
          </div>
          
          {canManage && (
            <div className={styles.managementActions}>
              <button onClick={handleManage} className={styles.manageButton}>
                Manage Page
              </button>
            </div>
          )}
        </div>
        
        <div className={styles.venueBio}>
          <p>{venueDetails.bio || "No description available"}</p>
        </div>
      </div>

      {/* Content Sections */}
      <div className={styles.contentSections}>
        <div className={styles.placeholderSection}>
          <h3>Events & Bookings</h3>
          <p>Coming soon - showcase upcoming events and booking information</p>
        </div>
        
        <div className={styles.placeholderSection}>
          <h3>Venue Details</h3>
          <p>Coming soon - detailed venue information, amenities, and photos</p>
        </div>
      </div>
    </div>
  );
};

export default PublicVenueProfile; 