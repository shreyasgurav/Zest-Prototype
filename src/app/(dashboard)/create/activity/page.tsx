'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { db, storage } from "@/infrastructure/firebase";
import { collection, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { getUserOwnedPages } from "@/domains/authentication/services/auth.service";
import { ContentSharingSecurity } from "@/shared/utils/security/contentSharingSecurity";
import styles from "./CreateActivity.module.css";
// @ts-ignore
import PlacesAutocomplete, { Suggestion } from 'react-places-autocomplete';
import Script from 'next/script';
import { FaMapMarkerAlt } from 'react-icons/fa';

// A more extensive list of cities for better search results
const ALL_CITIES = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur',
    'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna',
    'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Kalyan-Dombivali',
    'Vasai-Virar', 'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar', 'Navi Mumbai', 'Allahabad',
    'Ranchi', 'Howrah', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota',
    'Guwahati', 'Chandigarh', 'Solapur', 'Hubli-Dharwad', 'Mysore', 'Tiruchirappalli', 'Bareilly', 'Aligarh',
    'Tiruppur', 'Gurgaon', 'Moradabad', 'Jalandhar', 'Bhubaneswar', 'Salem', 'Warangal', 'Guntur', 'Noida',
    'Dehradun', 'Kochi'
];

const ACTIVITY_CATEGORIES = [
  { id: 'fitness', label: 'Fitness' },
  { id: 'art', label: 'Art' },
  { id: 'music', label: 'Music' },
  { id: 'sports', label: 'Sports' },
  { id: 'dance', label: 'Dance' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'technology', label: 'Technology' },
  { id: 'education', label: 'Education' },
  { id: 'wellness', label: 'Wellness' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'crafts', label: 'Crafts' },
  { id: 'photography', label: 'Photography' }
];

const GUIDE_OPTIONS = [
  { id: 'equipment', label: 'Equipment Provided', placeholder: 'e.g., Yoga mats, Art supplies' },
  { id: 'prerequisites', label: 'Prerequisites', placeholder: 'e.g., Basic fitness level' },
  { id: 'what_to_bring', label: 'What to Bring', placeholder: 'e.g., Water bottle, Comfortable clothes' },
  { id: 'facilities', label: 'Facilities Available', placeholder: 'e.g., Changing rooms, Parking' },
  { id: 'instructor', label: 'Instructor Details', placeholder: 'e.g., Certified trainer with 5+ years experience' },
  { id: 'group_size', label: 'Group Size', placeholder: 'e.g., Maximum 10 participants per session' },
  { id: 'difficulty_level', label: 'Difficulty Level', placeholder: 'e.g., Beginner, Intermediate, Advanced' },
  { id: 'cancellation', label: 'Cancellation Policy', placeholder: 'e.g., 24 hours notice required' },
  { id: 'weather', label: 'Weather Policy', placeholder: 'e.g., Indoor alternative available' },
  { id: 'accessibility', label: 'Accessibility', placeholder: 'e.g., Wheelchair accessible' }
];

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

const CreateActivity = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Authorization states
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>("");
  
  // Form states
  const [activityName, setActivityName] = useState<string>("");
  const [activityLocation, setActivityLocation] = useState<string>("");
  const [aboutActivity, setAboutActivity] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("");
  const [orgUsername, setOrgUsername] = useState<string>("");
  const [creatorInfo, setCreatorInfo] = useState<{
    type: string;
    pageId: string;
    name: string;
    username: string;
  } | null>(null);
  const [activityImage, setActivityImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [activityLanguages, setActivityLanguages] = useState<string>("");
  const [activityDuration, setActivityDuration] = useState<string>("");
  const [activityAgeLimit, setActivityAgeLimit] = useState<string>("");
  const [pricePerSlot, setPricePerSlot] = useState<string>("");
  
  // Weekly schedule - default to all days open with one time slot
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>([
    { day: 'Monday', isOpen: true, timeSlots: [{ startTime: '09:00', endTime: '10:00', capacity: 10 }] },
    { day: 'Tuesday', isOpen: true, timeSlots: [{ startTime: '09:00', endTime: '10:00', capacity: 10 }] },
    { day: 'Wednesday', isOpen: true, timeSlots: [{ startTime: '09:00', endTime: '10:00', capacity: 10 }] },
    { day: 'Thursday', isOpen: true, timeSlots: [{ startTime: '09:00', endTime: '10:00', capacity: 10 }] },
    { day: 'Friday', isOpen: true, timeSlots: [{ startTime: '09:00', endTime: '10:00', capacity: 10 }] },
    { day: 'Saturday', isOpen: true, timeSlots: [{ startTime: '09:00', endTime: '10:00', capacity: 10 }] },
    { day: 'Sunday', isOpen: false, timeSlots: [] }
  ]);

  // Specific closed dates
  const [closedDates, setClosedDates] = useState<string[]>([]);
  const [newClosedDate, setNewClosedDate] = useState<string>("");
  
  // Google Maps integration
  const [address, setAddress] = useState('');
  const [isMapsScriptLoaded, setIsMapsScriptLoaded] = useState(false);
  const [isLocationFocused, setIsLocationFocused] = useState(false);
  const [mapsScriptError, setMapsScriptError] = useState(false);
  const [selectedCity, setSelectedCity] = useState('Mumbai');
  
  // Activity guides
  const [guides, setGuides] = useState<{ [key: string]: string }>({});
  
  const auth = getAuth();

  // Google Maps script loading
  useEffect(() => {
    // Check if Google Maps is already loaded globally
    if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.places) {
      console.log('Google Maps already loaded globally');
      setIsMapsScriptLoaded(true);
      return;
    }

    // Check if script was previously loaded but failed
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      console.log('Google Maps script already exists in DOM');
      // Wait a bit and check again
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          setIsMapsScriptLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);

      // Clear interval after 10 seconds to prevent infinite checking
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!isMapsScriptLoaded) {
          console.error('Google Maps failed to load after timeout');
          setMapsScriptError(true);
        }
      }, 10000);
    }
  }, []);

  // Authorization check
  useEffect(() => {
    const checkAuthorization = async (user: any) => {
      if (!user) {
        setAuthError("Please sign in to create activities");
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      try {
        // Get URL parameters for creator context
        const creatorType = searchParams?.get('from');
        const creatorPageId = searchParams?.get('pageId');
        const creatorName = searchParams?.get('name');
        const creatorUsername = searchParams?.get('username');

        // Verify user owns pages and has authorization to create activities
        const ownedPages = await getUserOwnedPages(user.uid);
        
        if (creatorType && creatorPageId) {
          // Check if user owns the specific page they're creating from
          let hasSpecificPageAccess = false;
          let accessLevel = 'unauthorized';
          
          if (creatorType === 'organisation' || creatorType === 'organization') {
            hasSpecificPageAccess = ownedPages.organizations.some(org => org.uid === creatorPageId);
            if (hasSpecificPageAccess) accessLevel = 'owner';
          } else if (creatorType === 'artist') {
            hasSpecificPageAccess = ownedPages.artists.some(artist => artist.uid === creatorPageId);
            if (hasSpecificPageAccess) accessLevel = 'owner';
          } else if (creatorType === 'venue') {
            hasSpecificPageAccess = ownedPages.venues.some(venue => venue.uid === creatorPageId);
            if (hasSpecificPageAccess) accessLevel = 'owner';
          }

          // If not owned, check for shared access
          if (!hasSpecificPageAccess) {
            console.log(`🔍 User doesn't own ${creatorType} page ${creatorPageId}, checking shared access...`);
            
            try {
              const contentType = creatorType === 'organisation' || creatorType === 'organization' ? 'organization' : creatorType as 'artist' | 'venue';
              const permissions = await ContentSharingSecurity.verifyContentAccess(contentType, creatorPageId, user.uid);
              
              // Editor and Admin can create content
              if (permissions.canEdit && (permissions.role === 'editor' || permissions.role === 'admin' || permissions.role === 'owner')) {
                hasSpecificPageAccess = true;
                accessLevel = permissions.role;
                console.log(`✅ User has ${permissions.role} access to ${creatorType} page, can create activities`);
              } else {
                console.log(`❌ User has ${permissions.role} access, insufficient for creating activities`);
              }
            } catch (error) {
              console.error('Error checking shared access:', error);
            }
          }

          if (!hasSpecificPageAccess) {
            setAuthError(`You don't have permission to create activities as ${creatorName}. You need at least Editor access to this ${creatorType} page.`);
            setIsAuthorized(false);
            setIsLoading(false);
            return;
          }
          
          console.log(`✅ User authorized to create activities as ${creatorName} with ${accessLevel} access`);
        } else {
          // No specific creator context - check if user has any pages at all
          const hasAnyPages = ownedPages.artists.length > 0 || 
                             ownedPages.organizations.length > 0 || 
                             ownedPages.venues.length > 0;

          if (!hasAnyPages) {
            setAuthError("You need to create at least one page (Artist, Organization, or Venue) before you can create activities.");
            setIsAuthorized(false);
            setIsLoading(false);
            return;
          }
        }

        setIsAuthorized(true);
        setIsLoading(false);
      } catch (error) {
        console.error("Error checking authorization:", error);
        setAuthError("Error verifying your permissions. Please try again.");
        setIsAuthorized(false);
        setIsLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, checkAuthorization);
    return () => unsubscribe();
  }, [searchParams]);

  useEffect(() => {
    const fetchCreatorDetails = async () => {
      if (!auth.currentUser) return;

      try {
        // Check if we have creator info from URL parameters
        const creatorType = searchParams?.get('from');
        const creatorPageId = searchParams?.get('pageId');
        const creatorName = searchParams?.get('name');
        const creatorUsername = searchParams?.get('username');

        if (creatorType && creatorPageId && creatorName && creatorUsername) {
          // Use creator info from URL parameters
          setCreatorInfo({
            type: creatorType,
            pageId: creatorPageId,
            name: decodeURIComponent(creatorName),
            username: decodeURIComponent(creatorUsername)
          });
          setOrgName(decodeURIComponent(creatorName));
          setOrgUsername(decodeURIComponent(creatorUsername));
        } else {
          // Fallback to organization lookup (legacy behavior)
          const orgDoc = await getDoc(doc(db(), "Organisations", auth.currentUser.uid));
          if (orgDoc.exists()) {
            const data = orgDoc.data();
            setOrgName(data.name || "");
            setOrgUsername(data.username || "");
            setCreatorInfo({
              type: 'organisation',
              pageId: auth.currentUser.uid,
              name: data.name || "",
              username: data.username || ""
            });
            localStorage.setItem('orgName', data.name || "");
            localStorage.setItem('orgUsername', data.username || "");
          }
        }
      } catch (error) {
        console.error("Error fetching creator details:", error);
      }
    };

    fetchCreatorDetails();
  }, [searchParams]);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5242880) {
        setMessage("Image size should be less than 5MB");
        return;
      }
      setActivityImage(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  const handleSelectAddress = (address: string) => {
    setAddress(address);
    setActivityLocation(address);
    
    // Extract city from the address
    const addressParts = address.split(',');
    if (addressParts.length >= 2) {
      // Try to find a city name from the address parts
      for (let i = addressParts.length - 3; i >= 0; i--) {
        const part = addressParts[i].trim();
        if (part && !/^\d+$/.test(part) && part.length > 2) {
          const matchedCity = ALL_CITIES.find((city: string) => 
            city.toLowerCase().includes(part.toLowerCase()) || 
            part.toLowerCase().includes(city.toLowerCase())
          );
          if (matchedCity) {
            setSelectedCity(matchedCity);
            break;
          } else {
            setSelectedCity(part);
            break;
          }
        }
      }
    }
    setIsLocationFocused(false);
  };

  const handleGuideToggle = (id: string) => {
    setGuides(prev =>
      id in prev ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id)) : { ...prev, [id]: '' }
    );
  };

  const handleGuideInput = (id: string, value: string) => {
    setGuides(prev => ({ ...prev, [id]: value }));
  };

  // Day schedule management
  const toggleDayOpen = (dayIndex: number) => {
    const updatedSchedule = [...weeklySchedule];
    updatedSchedule[dayIndex].isOpen = !updatedSchedule[dayIndex].isOpen;
    if (!updatedSchedule[dayIndex].isOpen) {
      updatedSchedule[dayIndex].timeSlots = [];
    } else if (updatedSchedule[dayIndex].timeSlots.length === 0) {
      updatedSchedule[dayIndex].timeSlots = [{ startTime: '09:00', endTime: '10:00', capacity: 10 }];
    }
    setWeeklySchedule(updatedSchedule);
  };

  const addTimeSlot = (dayIndex: number) => {
    const updatedSchedule = [...weeklySchedule];
    updatedSchedule[dayIndex].timeSlots.push({ startTime: '09:00', endTime: '10:00', capacity: 10 });
    setWeeklySchedule(updatedSchedule);
  };

  const removeTimeSlot = (dayIndex: number, slotIndex: number) => {
    const updatedSchedule = [...weeklySchedule];
    updatedSchedule[dayIndex].timeSlots.splice(slotIndex, 1);
    setWeeklySchedule(updatedSchedule);
  };

  const updateTimeSlot = (dayIndex: number, slotIndex: number, field: keyof TimeSlot, value: string | number) => {
    const updatedSchedule = [...weeklySchedule];
    (updatedSchedule[dayIndex].timeSlots[slotIndex] as any)[field] = value;
    setWeeklySchedule(updatedSchedule);
  };

  // Closed dates management
  const addClosedDate = () => {
    if (newClosedDate && !closedDates.includes(newClosedDate)) {
      setClosedDates([...closedDates, newClosedDate]);
      setNewClosedDate("");
    }
  };

  const removeClosedDate = (date: string) => {
    setClosedDates(closedDates.filter(d => d !== date));
  };

  const validateSchedule = (): boolean => {
    const openDays = weeklySchedule.filter(day => day.isOpen);
    if (openDays.length === 0) {
      setMessage("At least one day must be open");
      return false;
    }

    for (const day of openDays) {
      if (day.timeSlots.length === 0) {
        setMessage(`${day.day} is marked as open but has no time slots`);
        return false;
      }
      
      for (const slot of day.timeSlots) {
        if (!slot.startTime || !slot.endTime || slot.capacity <= 0) {
          setMessage(`Invalid time slot on ${day.day}`);
          return false;
        }
        
        const startTime = new Date(`2000-01-01 ${slot.startTime}`);
        const endTime = new Date(`2000-01-01 ${slot.endTime}`);
        if (endTime <= startTime) {
          setMessage(`End time must be after start time on ${day.day}`);
          return false;
        }
      }
    }
    return true;
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!file) return null;
    
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image size should be less than 5MB");
      }

      if (!file.type.startsWith('image/')) {
        throw new Error("File must be an image");
      }

      const fileExtension = file.name.split('.').pop();
      const fileName = `activities/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const storageRef = ref(storage(), fileName);

      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedBy: auth.currentUser?.uid || 'unknown',
          uploadTime: new Date().toISOString()
        }
      };

      const blob = new Blob([await file.arrayBuffer()], { type: file.type });

      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`Attempt ${retryCount + 1} to upload image...`);
          
          const uploadResult = await uploadBytes(storageRef, blob, metadata);
          console.log('Upload successful:', uploadResult);

          const downloadURL = await getDownloadURL(uploadResult.ref);
          console.log('Download URL obtained:', downloadURL);
          
          return downloadURL;
        } catch (error: any) {
          console.error(`Upload attempt ${retryCount + 1} failed:`, error);
          
          if (retryCount === maxRetries - 1) {
            throw new Error(`Image upload failed after ${maxRetries} attempts: ${error.message}`);
          }
          
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          retryCount++;
        }
      }

      throw new Error('Upload failed after all retry attempts');
    } catch (error: any) {
      console.error('Error in uploadImage:', error);
      throw new Error(`Image upload failed: ${error.message}`);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log("Form submitted");
    
    if (!activityName.trim() || !activityLocation.trim() || selectedCategories.length === 0 || !pricePerSlot.trim()) {
      setMessage("Please fill in all required fields and select at least one category");
      return;
    }

    if (!validateSchedule()) {
      return;
    }

    if (parseFloat(pricePerSlot) < 0) {
      setMessage("Price must be non-negative");
      return;
    }

    console.log("Validation passed, starting creation");
    setLoading(true);
    setMessage("");

    try {
      console.log("Starting upload process");
      let imageUrl: string | null = null;
      let imageUploadError = false;
      let imageUploadErrorMessage = '';

      if (activityImage) {
        try {
          console.log("Uploading image...");
          imageUrl = await uploadImage(activityImage);
          console.log("Image uploaded:", imageUrl);
        } catch (uploadError: any) {
          console.error('Image upload failed:', uploadError);
          imageUploadError = true;
          imageUploadErrorMessage = 'Image upload failed. The activity will be created without an image. You can add an image later by editing the activity.';
        }
      }

      console.log("Creating activity data");
      const activityData = {
        name: activityName.trim(),
        activity_type: "activity",
        weekly_schedule: weeklySchedule.map(day => ({
          day: day.day,
          is_open: day.isOpen,
          time_slots: day.timeSlots.map(slot => ({
            start_time: slot.startTime,
            end_time: slot.endTime,
            capacity: slot.capacity,
            available_capacity: slot.capacity
          }))
        })),
        closed_dates: closedDates,
        price_per_slot: parseFloat(pricePerSlot),
        location: activityLocation.trim(),
        city: selectedCity,
        about_activity: aboutActivity.trim(),
        activity_image: imageUrl,
        organizationId: auth.currentUser?.uid,
        hosting_organization: orgName,
        organization_username: orgUsername,
        activity_categories: selectedCategories,
        activity_languages: activityLanguages.trim(),
        activity_duration: activityDuration.trim(),
        activity_age_limit: activityAgeLimit.trim(),
        activity_guides: guides,
        // Creator information
        creator: creatorInfo ? {
          type: creatorInfo.type, // 'artist', 'organisation', or 'venue'
          pageId: creatorInfo.pageId,
          name: creatorInfo.name,
          username: creatorInfo.username,
          userId: auth.currentUser!.uid
        } : {
          type: 'organisation',
          pageId: auth.currentUser!.uid,
          name: orgName,
          username: orgUsername,
          userId: auth.currentUser!.uid
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'active',
        image_upload_status: imageUploadError ? 'failed' : (imageUrl ? 'success' : 'none')
      };

      console.log("Activity data prepared:", activityData);
      const activitiesCollectionRef = collection(db(), "activities");
      console.log("Adding document to Firestore...");
      await addDoc(activitiesCollectionRef, activityData);
      console.log("Activity created successfully in Firestore");
      
      if (imageUploadError) {
        setMessage(`Activity created successfully! Note: ${imageUploadErrorMessage} You can try uploading the image again later.`);
      } else {
        setMessage("Activity created successfully!");
      }

      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 2000);
    } catch (error: any) {
      console.error("Error creating activity:", error);
      setMessage(`Failed to create activity: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.createActivityPage}>
        <div className={styles.createActivityContainer}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '200px',
            color: '#aeadad'
          }}>
            Verifying permissions...
          </div>
        </div>
      </div>
    );
  }

  // Unauthorized state
  if (!isAuthorized) {
    return (
      <div className={styles.createActivityPage}>
        <div className={styles.unauthorizedMessageContainer}>
          <div className={styles.unauthorizedMessage}>
            <h1>Access Denied</h1>
            <p>{authError}</p>
            <button 
              onClick={() => router.push("/business")}
              className={styles.backButton}
            >
              Create Your First Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.createActivityPage}>
      <div className={styles.createActivityContainer}>
        <h1 className={styles.pageTitle}>
          Create Activity
          {creatorInfo && (
            <span className={styles.creatorInfo}>
              as {creatorInfo.name} ({creatorInfo.type})
            </span>
          )}
        </h1>
        <form onSubmit={handleSubmit} className={styles.createActivityForm}>
          {/* Image Upload Section */}
          <div className={styles.formSection}>
            <h2>Activity Profile Image</h2>
            <label htmlFor="activity-image-upload" className={styles.imageUploadBox}>
              <span className={styles.imageUploadLabel}>
                {imagePreview ? 'Change Activity Image' : 'Click to upload activity profile image'}
              </span>
              {imagePreview && (
                <div className={styles.imagePreview}>
                  <img src={imagePreview} alt="Preview" className={styles.imagePreviewImg} />
                </div>
              )}
              <input
                id="activity-image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className={styles.fileInput}
              />
            </label>
            <p className={styles.imageTip}>Please upload a square image for best results (max 5MB)</p>
          </div>

          {/* Activity Details */}
          <div className={styles.formSection}>
            <h2>Activity Details</h2>
            <div className={styles.formGroup}>
              <label>Activity Name</label>
              <input
                type="text"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder="Enter activity name"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Activity Categories</label>
              <div className={styles.categoriesGrid}>
                {ACTIVITY_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={`${styles.categoryButton} ${selectedCategories.includes(category.id) ? styles.categoryButtonActive : ''}`}
                    onClick={() => handleCategoryChange(category.id)}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
              {selectedCategories.length === 0 && (
                <p className={styles.errorText}>Please select at least one category</p>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>Price per Slot (₹)</label>
              <input
                type="number"
                value={pricePerSlot}
                onChange={(e) => setPricePerSlot(e.target.value)}
                placeholder="Price per slot"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          {/* Location */}
          <div className={styles.formSection}>
            <h2>Location</h2>
            <div className={styles.formGroup}>
              <label>City</label>
              <div className={styles.locationSelectorWrapper}>
                <div className={styles.cityInputGroup}>
                  <input
                    type="text"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    placeholder="Enter city name"
                    className={styles.cityInput}
                    list="cities-list"
                  />
                  <datalist id="cities-list">
                    {ALL_CITIES.map(city => (
                      <option key={city} value={city} />
                    ))}
                  </datalist>
                </div>
                <p className={styles.locationNote}>
                  The city will be automatically detected from the venue address below, or you can manually enter it above.
                </p>
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>Activity Location</label>
              {!isMapsScriptLoaded && !mapsScriptError && (
                <Script
                  src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
                  strategy="afterInteractive"
                  onLoad={() => {
                    console.log('Google Maps script loaded successfully');
                    setIsMapsScriptLoaded(true);
                    setMapsScriptError(false);
                  }}
                  onError={(e) => {
                    console.error('Google Maps script failed to load:', e);
                    setMapsScriptError(true);
                    setIsMapsScriptLoaded(false);
                  }}
                />
              )}
              {isMapsScriptLoaded ? (
                <PlacesAutocomplete
                  value={address}
                  onChange={setAddress}
                  onSelect={handleSelectAddress}
                >
                  {(props: {
                    getInputProps: (options: any) => any;
                    suggestions: Suggestion[];
                    getSuggestionItemProps: (suggestion: Suggestion, options?: any) => any;
                    loading: boolean;
                  }) => {
                    const { getInputProps, suggestions, getSuggestionItemProps, loading } = props;
                    return (
                      <div style={{ position: 'relative' }}>
                        <input
                          {...getInputProps({
                            placeholder: 'Search for activity location...',
                            className: styles.locationInput,
                            required: true,
                            onFocus: () => setIsLocationFocused(true),
                            onBlur: () => setTimeout(() => setIsLocationFocused(false), 150),
                          })}
                        />
                        {isLocationFocused && suggestions.length > 0 && (
                          <div className={styles.autocompleteDropdown}>
                            {loading && <div className={styles.suggestionItem}>Loading...</div>}
                            {suggestions.map((suggestion: Suggestion) => {
                              const className = suggestion.active
                                ? styles.suggestionItemActive
                                : styles.suggestionItem;
                              const main = suggestion.structured_formatting?.main_text || suggestion.description;
                              const secondary = suggestion.structured_formatting?.secondary_text;
                              return (
                                <div
                                  {...getSuggestionItemProps(suggestion, { className })}
                                  key={suggestion.placeId}
                                >
                                  <span className={styles.locationIcon}><FaMapMarkerAlt /></span>
                                  <span>
                                    <span className={styles.suggestionMain}>{main}</span>
                                    {secondary && (
                                      <div className={styles.suggestionSecondary}>{secondary}</div>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }}
                </PlacesAutocomplete>
              ) : mapsScriptError ? (
                <div>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setActivityLocation(e.target.value);
                    }}
                    placeholder="Enter activity location manually"
                    className={styles.locationInput}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      console.log('Retrying Google Maps load...');
                      setMapsScriptError(false);
                      setIsMapsScriptLoaded(false);
                      // Remove existing script if any
                      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
                      if (existingScript) {
                        existingScript.remove();
                      }
                    }}
                    style={{
                      marginTop: '8px',
                      padding: '8px 16px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Retry Maps Loading
                  </button>
                  <p style={{ color: '#888', fontSize: '14px', marginTop: '8px' }}>
                    Google Maps failed to load. You can enter the address manually or try reloading.
                  </p>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Loading Google Maps..."
                  disabled
                  className={styles.locationInput}
                />
              )}
            </div>
          </div>

          {/* Weekly Schedule Section */}
          <div className={styles.formSection}>
            <h2>Weekly Schedule</h2>
            <p className={styles.sectionDescription}>Set your weekly availability and time slots</p>
            {weeklySchedule.map((daySchedule, dayIndex) => (
              <div key={daySchedule.day} className={styles.daySchedule}>
                <div className={styles.dayHeader}>
                  <h3>{daySchedule.day}</h3>
                  <label className={styles.toggleSwitch}>
                    <input
                      type="checkbox"
                      checked={daySchedule.isOpen}
                      onChange={() => toggleDayOpen(dayIndex)}
                    />
                    <span className={styles.slider}></span>
                    <span className={styles.toggleLabel}>
                      {daySchedule.isOpen ? 'Open' : 'Closed'}
                    </span>
                  </label>
                </div>
                
                {daySchedule.isOpen && (
                  <div className={styles.timeSlotsContainer}>
                    {daySchedule.timeSlots.map((slot, slotIndex) => (
                      <div key={slotIndex} className={styles.timeSlot}>
                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label>Start Time</label>
                            <input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) => updateTimeSlot(dayIndex, slotIndex, 'startTime', e.target.value)}
                              required
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label>End Time</label>
                            <input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) => updateTimeSlot(dayIndex, slotIndex, 'endTime', e.target.value)}
                              required
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label>Capacity</label>
                            <input
                              type="number"
                              value={slot.capacity}
                              onChange={(e) => updateTimeSlot(dayIndex, slotIndex, 'capacity', parseInt(e.target.value))}
                              min="1"
                              required
                            />
                          </div>
                          {daySchedule.timeSlots.length > 1 && (
                            <button
                              type="button"
                              className={styles.removeSlotButton}
                              onClick={() => removeTimeSlot(dayIndex, slotIndex)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={styles.addSlotButton}
                      onClick={() => addTimeSlot(dayIndex)}
                    >
                      Add Time Slot
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Closed Dates Section */}
          <div className={styles.formSection}>
            <h2>Specific Closed Dates (Optional)</h2>
            <p className={styles.sectionDescription}>Add specific dates when your activity will be closed (holidays, maintenance, etc.)</p>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Add Closed Date</label>
                <input
                  type="date"
                  value={newClosedDate}
                  onChange={(e) => setNewClosedDate(e.target.value)}
                />
              </div>
              <button
                type="button"
                className={styles.addDateButton}
                onClick={addClosedDate}
                disabled={!newClosedDate}
              >
                Add Date
              </button>
            </div>
            {closedDates.length > 0 && (
              <div className={styles.closedDatesList}>
                {closedDates.map((date, index) => (
                  <div key={index} className={styles.closedDateItem}>
                    <span>{date}</span>
                    <button
                      type="button"
                      className={styles.removeDateButton}
                      onClick={() => removeClosedDate(date)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* About Activity */}
          <div className={styles.formSection}>
            <h2>About Activity</h2>
            <div className={styles.formGroup}>
              <textarea
                value={aboutActivity}
                onChange={(e) => setAboutActivity(e.target.value)}
                placeholder="Describe your activity - what participants will learn, experience, or achieve"
                rows={4}
                required
              />
            </div>
          </div>

          {/* Activity Guide */}
          <div className={styles.formSection}>
            <h2>Activity Information</h2>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Duration per Session</label>
                <input
                  type="text"
                  value={activityDuration}
                  onChange={(e) => setActivityDuration(e.target.value)}
                  placeholder="e.g., 1 Hour, 90 Minutes"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Age Requirement</label>
                <input
                  type="text"
                  value={activityAgeLimit}
                  onChange={(e) => setActivityAgeLimit(e.target.value)}
                  placeholder="e.g., 16+ years, All ages"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Languages</label>
                <input
                  type="text"
                  value={activityLanguages}
                  onChange={(e) => setActivityLanguages(e.target.value)}
                  placeholder="e.g., English, Hindi, Local language"
                  required
                />
              </div>
            </div>
          </div>

          {/* Activity Guides */}
          <div className={styles.formSection}>
            <h2>Additional Information (Optional)</h2>
            <div className={styles.guidesGrid}>
              {GUIDE_OPTIONS.map(option => (
                <div key={option.id} className={styles.guideRow}>
                  <label className={styles.guideCheckboxLabel}>
                    <input
                      type="checkbox"
                      checked={option.id in guides}
                      onChange={() => handleGuideToggle(option.id)}
                    />
                    {option.label}
                  </label>
                  {option.id in guides && (
                    <input
                      type="text"
                      className={styles.guideInput}
                      placeholder={option.placeholder}
                      value={guides[option.id]}
                      onChange={e => handleGuideInput(option.id, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {message && (
            <div className={`${styles.message} ${message.includes("success") ? styles.success : styles.error}`}>
              {message}
            </div>
          )}

          <div className={styles.formActions}>
            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? "Creating Activity..." : "Create Activity"}
            </button>
            <button 
              type="button" 
              className={styles.cancelButton} 
              onClick={() => router.push('/')}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateActivity; 