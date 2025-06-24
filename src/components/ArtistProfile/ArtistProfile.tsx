'use client';

import React, { useEffect, useState } from "react";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { toast } from "react-toastify";
import { FaCamera, FaTimes, FaPlus, FaMusic, FaUser, FaAt, FaMapMarkerAlt, FaTag, FaEdit, FaPhone } from 'react-icons/fa';
import ArtistProfileSkeleton from "./ArtistProfileSkeleton";
import DashboardSection from '../Dashboard/DashboardSection/DashboardSection';
import PhotoUpload from '../PhotoUpload/PhotoUpload';
import LocationPicker from '../LocationPicker/LocationPicker';
import { getUserOwnedPages } from '../../utils/authHelpers';
import { useRouter } from 'next/navigation';
import styles from "./ArtistProfile.module.css";

interface ArtistData {
  uid?: string;
  ownerId?: string;
  phoneNumber?: string;
  isActive?: boolean;
  role?: string;
  name?: string;
  username?: string;
  bio?: string;
  photoURL?: string;
  bannerImage?: string;
  genre?: string;
  location?: string;
  createdAt?: string;
  updatedAt?: string;
  settings?: {
    notifications?: boolean;
    emailUpdates?: boolean;
    privacy?: {
      profileVisibility?: string;
      contactVisibility?: string;
    };
  };
}

interface ArtistProfileProps {
  selectedPageId?: string | null;
}

const ArtistProfile: React.FC<ArtistProfileProps> = ({ selectedPageId }) => {
  const router = useRouter();
  const [artistDetails, setArtistDetails] = useState<ArtistData | null>(null);
  const [ownedArtistPages, setOwnedArtistPages] = useState<ArtistData[]>([]);
  const [currentArtistPageId, setCurrentArtistPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  
  const [name, setName] = useState<string>("");
  const [newName, setNewName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [newUsername, setNewUsername] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [newBio, setNewBio] = useState<string>("");
  const [genre, setGenre] = useState<string>("");
  const [newGenre, setNewGenre] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [newLocation, setNewLocation] = useState<string>("");
  const [photoURL, setPhotoURL] = useState<string>("");
  const [newPhotoURL, setNewPhotoURL] = useState<string>("");
  const [bannerImage, setBannerImage] = useState<string>("");
  const [newBannerImage, setNewBannerImage] = useState<string>("");
  const [usernameError, setUsernameError] = useState<string>("");
  const [isCheckingUsername, setIsCheckingUsername] = useState<boolean>(false);

  // Photo editing states
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState<boolean>(false);
  const [currentPhotoType, setCurrentPhotoType] = useState<'profile' | 'banner'>('profile');

  const fetchArtistData = async (pageId: string) => {
    console.log("Fetching artist data for page:", pageId);
    try {
      const db = getFirestore();
      const artistDocRef = doc(db, "Artists", pageId);
      const docSnap = await getDoc(artistDocRef);
  
      if (docSnap.exists()) {
        console.log("Document exists in Firestore");
        const data = docSnap.data() as ArtistData;
        
        setArtistDetails(data);
        setName(data.name || "");
        setNewName(data.name || "");
        setUsername(data.username || "");
        setNewUsername(data.username || "");
        setBio(data.bio || "");
        setNewBio(data.bio || "");
        setGenre(data.genre || "");
        setNewGenre(data.genre || "");
        setLocation(data.location || "");
        setNewLocation(data.location || "");
        setPhotoURL(data.photoURL || "");
        setNewPhotoURL(data.photoURL || "");
        setBannerImage(data.bannerImage || "");
        setNewBannerImage(data.bannerImage || "");
        
        localStorage.setItem('artistDetails', JSON.stringify(data));
        localStorage.setItem('artistName', data.name || "");
        localStorage.setItem('artistUsername', data.username || "");
        localStorage.setItem('artistBio', data.bio || "");
        localStorage.setItem('artistGenre', data.genre || "");
        localStorage.setItem('artistLocation', data.location || "");
        localStorage.setItem('artistPhotoURL', data.photoURL || "");
        localStorage.setItem('artistBannerImage', data.bannerImage || "");
      } else {
        console.log("Document doesn't exist in Firestore");
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (user) {
          const newData: ArtistData = {
            phoneNumber: user.phoneNumber || "",
            isActive: true,
            role: "Artist",
            settings: {
              emailUpdates: false,
              notifications: true,
              privacy: {
                contactVisibility: "followers",
                profileVisibility: "public"
              }
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
  
          await setDoc(artistDocRef, newData);
          setArtistDetails(newData);
        }
      }
    } catch (err) {
      console.error("Error in fetchArtistData:", err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    if (!username || username.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return false;
    }

    try {
      const db = getFirestore();
      const usernameQuery = query(
        collection(db, "Artists"),
        where("username", "==", username.toLowerCase())
      );
      
      const querySnapshot = await getDocs(usernameQuery);
      
      // If no documents found, username is available
      if (querySnapshot.empty) {
        setUsernameError("");
        return true;
      }
      
      // If documents found, check if any of them belong to the current user
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        setUsernameError("Please log in to check username availability");
        return false;
      }
      
      // Check if any of the found documents belong to the current user (check ownerId field)
      const isOwnUsername = querySnapshot.docs.some(doc => {
        const data = doc.data();
        return data.ownerId === currentUser.uid;
      });
      
      if (!isOwnUsername) {
        setUsernameError("Username is already taken");
        return false;
      }
      
      // Username belongs to current user, so it's available for them to use
      setUsernameError("");
      return true;
    } catch (err) {
      console.error("Error checking username:", err);
      setUsernameError("Error checking username availability");
      return false;
    }
  };

  const handleUsernameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value;
    setNewUsername(newUsername);
    setUsernameError("");
    
    // Don't check if it's the same as current username
    if (newUsername.toLowerCase() === username.toLowerCase()) {
      return;
    }
    
    if (newUsername.length >= 3) {
      setIsCheckingUsername(true);
      await checkUsernameAvailability(newUsername);
      setIsCheckingUsername(false);
    }
  };

  useEffect(() => {
    const auth = getAuth();
    let isSubscribed = true;
    
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      console.log("Auth state changed:", user?.uid);
      
      if (user && isSubscribed) {
        try {
          // Load owned artist pages
          const ownedPages = await getUserOwnedPages(user.uid);
          setOwnedArtistPages(ownedPages.artists);
          
          if (ownedPages.artists.length > 0) {
            // Check if there's a specific artist page to load
            const sessionSelectedPageId = typeof window !== 'undefined' ? 
              sessionStorage.getItem('selectedArtistPageId') : null;
            
            let pageToLoad = ownedPages.artists[0]; // Default to first page
            
            // Priority: prop selectedPageId > session storage > first page
            const pageIdToUse = selectedPageId || sessionSelectedPageId;
            
            if (pageIdToUse) {
              const selectedPage = ownedPages.artists.find(page => page.uid === pageIdToUse);
              if (selectedPage) {
                pageToLoad = selectedPage;
              }
              // Clear the session selection after using it
              if (sessionSelectedPageId) {
                sessionStorage.removeItem('selectedArtistPageId');
              }
            }
            
            setCurrentArtistPageId(pageToLoad.uid);
            await fetchArtistData(pageToLoad.uid);
          } else {
            // No artist pages found
            setError("No artist pages found. Please create an artist page first.");
            setLoading(false);
          }
        } catch (err) {
          console.error("Error loading owned pages:", err);
          setError("Failed to load artist pages");
          setLoading(false);
        }
      } else if (!user) {
        setArtistDetails(null);
        setOwnedArtistPages([]);
        setCurrentArtistPageId(null);
        setError(null);
        setEditMode(false);
        setLoading(false);
      }
    });
  
    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [selectedPageId]);

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      const auth = getAuth();
      const user = auth.currentUser;
  
      if (!user) {
        setError("User not authenticated");
        toast.error("Please login to save profile");
        return;
      }
  
      if (newUsername) {
        const isUsernameAvailable = await checkUsernameAvailability(newUsername);
        if (!isUsernameAvailable) {
          setLoading(false);
          return;
        }
      }
  
      const db = getFirestore();
      if (!currentArtistPageId) {
        setError("No artist page selected");
        toast.error("No artist page selected");
        setLoading(false);
        return;
      }
      const artistDocRef = doc(db, "Artists", currentArtistPageId);
  
      const updates = {
        name: newName,
        username: newUsername.toLowerCase(),
        bio: newBio,
        genre: newGenre,
        location: newLocation,
        photoURL: newPhotoURL,
        bannerImage: newBannerImage,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(artistDocRef, updates);
      
      const updatedArtistDetails = { ...artistDetails, ...updates };
      setArtistDetails(updatedArtistDetails);
      setName(newName);
      setUsername(newUsername);
      setBio(newBio);
      setGenre(newGenre);
      setLocation(newLocation);
      setPhotoURL(newPhotoURL);
      setBannerImage(newBannerImage);
      
      localStorage.setItem('artistDetails', JSON.stringify(updates));
      localStorage.setItem('artistName', newName);
      localStorage.setItem('artistUsername', newUsername);
      localStorage.setItem('artistBio', newBio);
      localStorage.setItem('artistGenre', newGenre);
      localStorage.setItem('artistLocation', newLocation);
      localStorage.setItem('artistPhotoURL', newPhotoURL);
      localStorage.setItem('artistBannerImage', newBannerImage);
      
      setUsernameError("");
      setEditMode(false);
      toast.success("Profile updated successfully!");
    } catch (err) {
      console.error("Error saving profile:", err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error("Error saving profile");
    } finally {
      setLoading(false);
    }
  };

  // Photo editing handlers
  const handleProfilePhotoClick = () => {
    setCurrentPhotoType('profile');
    setShowPhotoModal(true);
  };

  const handleBannerClick = () => {
    setCurrentPhotoType('banner');
    setShowPhotoModal(true);
  };

  const handleUploadPhotoClick = () => {
    setShowPhotoModal(false);
    setShowPhotoUpload(true);
  };

  const handlePhotoChange = async (imageUrl: string) => {
    try {
      if (currentPhotoType === 'profile') {
        setNewPhotoURL(imageUrl);
        setPhotoURL(imageUrl);
      } else {
        setNewBannerImage(imageUrl);
        setBannerImage(imageUrl);
      }

      // Update Firestore immediately
      const auth = getAuth();
      const user = auth.currentUser;
      if (user && currentArtistPageId) {
        const db = getFirestore();
        const artistDocRef = doc(db, "Artists", currentArtistPageId);
        const updateField = currentPhotoType === 'profile' ? 'photoURL' : 'bannerImage';
        await updateDoc(artistDocRef, {
          [updateField]: imageUrl,
          updatedAt: new Date().toISOString()
        });
      }

      setShowPhotoUpload(false);
      toast.success(`${currentPhotoType === 'profile' ? 'Profile photo' : 'Banner'} updated successfully!`);
    } catch (error) {
      console.error('Error updating photo:', error);
      toast.error(`Failed to update ${currentPhotoType === 'profile' ? 'profile photo' : 'banner'}`);
    }
  };

  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setShowPhotoUpload(false);
  };

  if (loading) {
    return <ArtistProfileSkeleton />;
  }

  if (error && !artistDetails) {
    return (
      <div className={styles.artistProfileContainer}>
        <div className={styles.noArtistPagesContainer}>
          <div className={styles.noArtistPagesCard}>
            <FaMusic className={styles.noArtistPagesIcon} />
            <h2>No Artist Pages Found</h2>
            <p>You haven't created any artist pages yet. Create your first artist page to start showcasing your talent!</p>
            <button 
              onClick={() => router.push('/business')}
              className={styles.createArtistPageButton}
            >
              <FaPlus className={styles.createIcon} />
              Create Artist Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.artistProfileContainer}>

      {/* Spotify-Style Banner Section */}
      <div className={styles.spotifyBanner}>
        {/* Banner Background */}
        <div 
          className={styles.bannerBackground}
          onClick={handleBannerClick} 
          style={{ cursor: 'pointer' }}
        >
          {bannerImage ? (
            <img
              src={bannerImage}
              alt="Artist Banner"
              className={styles.bannerImage}
            />
          ) : (
            <div className={styles.defaultBannerGradient} />
          )}
          
          {/* Banner Overlay */}
          <div className={styles.bannerOverlay} />
          
          {/* Edit Banner Button */}
          <div className={styles.bannerEditHover}>
            <FaCamera className={styles.editIcon} />
            <span>Edit Banner</span>
          </div>
        </div>

        {/* Artist Info at Bottom of Banner */}
        <div className={styles.artistInfoSection}>
          <div className={styles.artistContent}>
            {/* Large Avatar */}
            <div 
              className={styles.avatarContainer}
              onClick={handleProfilePhotoClick}
              style={{ cursor: 'pointer' }}
            >
              {photoURL ? (
                <img 
                  src={photoURL} 
                  alt="Artist" 
                  className={styles.avatar}
                />
              ) : (
                <div className={styles.avatarFallback}>
                  {name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'ART'}
                </div>
              )}
              
              {/* Edit Avatar Overlay */}
              <div className={styles.avatarEditOverlay}>
                <FaCamera className={styles.avatarEditIcon} />
              </div>
            </div>

            {/* Artist Details */}
            <div className={styles.artistDetails}>
              {/* Large Artist Name */}
              <h1 className={styles.artistName}>
                {name || "Artist Name"}
              </h1>

              {/* Additional Info */}
              <div className={styles.artistMeta}>
                {username && (
                  <span className={styles.username}>@{username}</span>
                )}
                {genre && (
                  <span className={styles.genre}>{genre}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bio and Edit Section */}
      <div className={styles.contentSection}>
        {bio && (
          <div className={styles.bioSection}>
            <p>{bio}</p>
          </div>
        )}

        {/* Edit Profile Button */}
                  {!editMode && (
          <div className={styles.profileButtonsContainer}>
            <button 
              onClick={() => setEditMode(true)}
              className={styles.editProfileButton}
            >
              Edit Profile
            </button>
                          <button 
                onClick={() => {
                  // Navigate to create page with artist context
                  if (currentArtistPageId) {
                    router.push(`/create?from=artist&pageId=${currentArtistPageId}&name=${encodeURIComponent(name || '')}&username=${encodeURIComponent(username || '')}`);
                  } else {
                    router.push('/create');
                  }
                }}
                className={styles.createButton}
              >
                Create
              </button>
          </div>
        )}
      </div>

      {/* Enhanced Edit Form */}
      {editMode && (
        <div className={styles.editProfileContainer}>
          <div className={styles.editHeader}>
            <h2>
              <FaEdit className={styles.editIcon} />
              Edit Artist Profile
            </h2>
            <p>Update your artist information to showcase your talent</p>
          </div>

          <div className={styles.editGrid}>
            <div className={styles.editColumn}>
              <div className={styles.modernInputGroup}>
                <label htmlFor="name">
                  <FaUser className={styles.inputIcon} />
                  Artist Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter your artist name"
                  className={styles.modernInput}
                />
              </div>

              <div className={styles.modernInputGroup}>
                <label htmlFor="username">
                  <FaAt className={styles.inputIcon} />
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={newUsername}
                  onChange={handleUsernameChange}
                  placeholder="Choose a unique username"
                  className={styles.modernInput}
                />
                {isCheckingUsername && (
                  <span className={styles.checkingText}>
                    <div className={styles.loadingDot}></div>
                    Checking availability...
                  </span>
                )}
                {usernameError && <span className={styles.errorText}>{usernameError}</span>}
              </div>

              <div className={styles.modernInputGroup}>
                <label htmlFor="genre">
                  <FaTag className={styles.inputIcon} />
                  Genre
                </label>
                <input
                  id="genre"
                  type="text"
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  placeholder="e.g., Rock, Pop, Jazz, Electronic"
                  className={styles.modernInput}
                />
              </div>
            </div>

            <div className={styles.editColumn}>
              <div className={styles.modernInputGroup}>
                <label>
                  <FaMapMarkerAlt className={styles.inputIcon} />
                  Location
                </label>
                <LocationPicker
                  value={newLocation}
                  onChange={(location) => setNewLocation(location)}
                  placeholder="Search for your location..."
                />
              </div>

              <div className={styles.modernInputGroup}>
                <label>
                  <FaPhone className={styles.inputIcon} />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={artistDetails?.phoneNumber || ""}
                  className={`${styles.modernInput} ${styles.disabledInput}`}
                  placeholder="Phone number"
                  disabled
                />
                <span className={styles.helperText}>
                  <span>🔒 Phone number is linked to your account and cannot be changed</span>
                </span>
              </div>
            </div>
          </div>

          <div className={styles.bioInputGroup}>
            <label htmlFor="bio">
              <FaEdit className={styles.inputIcon} />
              About You
            </label>
            <textarea
              id="bio"
              value={newBio}
              onChange={(e) => setNewBio(e.target.value)}
              placeholder="Tell your fans about your music journey, style, and what inspires you..."
              className={styles.modernTextarea}
              rows={4}
            />
            <div className={styles.charCount}>
              {newBio.length}/500 characters
            </div>
          </div>

          <div className={styles.modernButtonGroup}>
            <button 
              onClick={() => setEditMode(false)}
              className={styles.cancelButton}
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveProfile}
              disabled={isCheckingUsername || !!usernameError || loading}
              className={styles.saveButton}
            >
              {loading ? (
                <>
                  <div className={styles.spinner}></div>
                  Saving...
                </>
              ) : (
                <>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Photo Options Modal */}
      {showPhotoModal && (
        <div className={styles.modalOverlay} onClick={closePhotoModal}>
          <div className={styles.photoModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Edit {currentPhotoType === 'profile' ? 'Profile Photo' : 'Banner'}</h3>
              <button className={styles.closeButton} onClick={closePhotoModal}>
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalContent}>
              <button className={styles.photoOption} onClick={handleUploadPhotoClick}>
                <FaCamera className={styles.optionIcon} />
                <span>Upload {currentPhotoType === 'profile' ? 'Photo' : 'Banner'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {showPhotoUpload && (
        <div className={styles.modalOverlay} onClick={closePhotoModal}>
          <div className={styles.uploadModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Upload & Crop {currentPhotoType === 'profile' ? 'Profile Photo' : 'Banner'}</h3>
              <button className={styles.closeButton} onClick={closePhotoModal}>
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalContent}>
              <PhotoUpload
                currentImageUrl={currentPhotoType === 'profile' ? photoURL : bannerImage}
                onImageChange={handlePhotoChange}
                type={currentPhotoType}
              />
            </div>
          </div>
        </div>
      )}

                  <div className={styles.artistDashboardSection}>
              <DashboardSection pageId={currentArtistPageId || undefined} pageType="artist" />
            </div>
    </div>
  );
};

export default ArtistProfile; 