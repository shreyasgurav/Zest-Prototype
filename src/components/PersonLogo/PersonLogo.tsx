import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '@/services/firebase';
import { signOut, User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { FaTicketAlt, FaUser, FaCog, FaSignOutAlt, FaBuilding, FaMicrophone, FaMapMarkerAlt, FaPlus, FaShareAlt } from 'react-icons/fa';
import { getUserOwnedPages, ArtistData, OrganizationData, VenueData, clearAllSessions } from '../../utils/authHelpers';
import { ContentSharingSecurity } from '@/utils/contentSharingSecurity';
import styles from "./PersonLogo.module.css";

interface UserData {
  name?: string;
  username?: string;
  profilePicture?: string;
  photoURL?: string;
  photo?: string;
  profile_image?: string;
  phone?: string;
  email?: string;
}

function PersonLogo() {
    const [showDropdown, setShowDropdown] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [ownedPages, setOwnedPages] = useState<{
        artists: ArtistData[];
        organizations: OrganizationData[];
        venues: VenueData[];
    }>({ artists: [], organizations: [], venues: [] });
    const [sharedPages, setSharedPages] = useState<{
        artists: Array<{ uid: string; name: string; role: string }>;
        organizations: Array<{ uid: string; name: string; role: string }>;
        venues: Array<{ uid: string; name: string; role: string }>;
        events: Array<{ uid: string; name: string; role: string }>;
        activities: Array<{ uid: string; name: string; role: string }>;
    }>({ artists: [], organizations: [], venues: [], events: [], activities: [] });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();



    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth(), async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    // Load the user's personal profile data
                    const userDoc = await getDoc(doc(db(), "Users", currentUser.uid));
                    let personalData: UserData;
                    
                    if (userDoc.exists()) {
                        personalData = userDoc.data() as UserData;
                        console.log('👤 Loaded personal user data:', personalData);
                        setUserData(personalData);
                    } else {
                        // Fallback to Firebase Auth data for personal profile
                        personalData = {
                            name: currentUser.displayName || currentUser.phoneNumber || 'User',
                            username: currentUser.email?.split('@')[0] || currentUser.phoneNumber?.replace(/\D/g, '') || 'user',
                            photoURL: currentUser.photoURL || undefined,
                            photo: currentUser.photoURL || undefined,
                            phone: currentUser.phoneNumber || undefined,
                            email: currentUser.email || undefined
                        };
                        setUserData(personalData);
                    }
                    
                    // Auto-accept any pending invitations for this user's phone number
                    const userPhone = personalData.phone || currentUser.phoneNumber;
                    if (userPhone) {
                        console.log('👤 Checking for pending invitations for phone:', userPhone);
                        
                        try {
                            const pendingInvitations = await ContentSharingSecurity.getUserPendingInvitations(userPhone);
                            console.log('👤 Found pending invitations:', pendingInvitations);
                            
                            // Auto-accept all pending invitations
                            let acceptedAny = false;
                            for (const invitation of pendingInvitations) {
                                if (invitation.id) {
                                    const result = await ContentSharingSecurity.acceptInvitation(
                                        invitation.id,
                                        currentUser.uid,
                                        personalData.name || currentUser.displayName || 'User'
                                    );
                                    if (result.success) {
                                        console.log('👤 Auto-accepted invitation:', invitation.id);
                                        acceptedAny = true;
                                    }
                                }
                            }
                            
                        } catch (error) {
                            console.error('Error processing pending invitations:', error);
                        }
                    }
                    
                    // Load all pages the user owns (for pages section)
                    const pages = await getUserOwnedPages(currentUser.uid);
                    setOwnedPages(pages);
                    console.log('👤 Loaded owned pages:', pages);
                    
                    // Load shared pages (pages where user has been given access)
                    // This will include any newly accepted invitations
                    const shared = await ContentSharingSecurity.getUserSharedContent(currentUser.uid);
                    setSharedPages(shared);
                    console.log('👤 Loaded shared pages:', shared);
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    // Fallback to Firebase Auth data
                    const fallbackData = {
                        name: currentUser.displayName || currentUser.phoneNumber || 'User',
                        username: currentUser.email?.split('@')[0] || currentUser.phoneNumber?.replace(/\D/g, '') || 'user',
                        photoURL: currentUser.photoURL || undefined,
                        photo: currentUser.photoURL || undefined,
                        phone: currentUser.phoneNumber || undefined,
                        email: currentUser.email || undefined
                    };
                    setUserData(fallbackData);
                }
            } else {
                setUserData(null);
                setOwnedPages({ artists: [], organizations: [], venues: [] });
                setSharedPages({ artists: [], organizations: [], venues: [], events: [], activities: [] });
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setShowDropdown(false);
        }
    };

    const handleLogout = async () => {
        try {
            // Clear all session markers before logout
            clearAllSessions();
            
            await signOut(auth());
            setShowDropdown(false);
            router.push('/');
            console.log("User logged out successfully!");
        } catch (error) {
            console.error("Error logging out:", error instanceof Error ? error.message : "An error occurred");
        }
    };



    const handleTicketsClick = () => {
        setShowDropdown(false);
        router.push('/tickets');
    };

    const handleSettingsClick = () => {
        setShowDropdown(false);
        // Add settings route when available
        console.log("Settings clicked");
    };

    const handleSignInClick = () => {
        router.push('/login');
    };

    const handleCreateNewPage = () => {
        setShowDropdown(false);
        router.push('/business');
    };

    const toggleDropdown = () => {
        setShowDropdown(!showDropdown);
    };

    // Get profile picture URL for user
    const getProfilePictureUrl = () => {
        if (!userData) return null;
        
        // Check all possible field names for profile image
        if (userData.profilePicture) {
            return userData.profilePicture;
        }
        if (userData.photo) {
            return userData.photo;
        }
        if (userData.profile_image) {
            return userData.profile_image;
        }
        if (userData.photoURL) {
            return userData.photoURL;
        }
        
        return null;
    };

    // Get initials for default avatar
    const getUserInitials = () => {
        if (!userData) return 'U';
        
        let name = 'User';
        
        if (userData.name) {
            name = userData.name;
        } else if (userData.phone) {
            name = userData.phone;
        }
        
        return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    };

    if (!user) {
        // Show Sign In button when not logged in
        return (
            <button 
                className={styles.signInButton}
                onClick={handleSignInClick}
            >
                Sign In
            </button>
        );
    }

    // Show profile when logged in
    return (
        <div className={styles.personLogoContainer} ref={dropdownRef}>
            <div 
                className={styles.profileButton}
                onClick={toggleDropdown}
            >
                {getProfilePictureUrl() ? (
                    <img 
                        src={getProfilePictureUrl()!}
                        alt="Profile"
                        className={styles.profileImage}
                        onError={(e) => {
                            // Fallback to initials if image fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.add(styles.show);
                        }}
                    />
                ) : null}
                <div className={`${styles.profileInitials} ${!getProfilePictureUrl() ? styles.show : ''}`}>
                    {getUserInitials()}
                </div>
            </div>

            {showDropdown && (
                <div className={styles.dropdown}>
                    {/* User Info Header - Always personal profile */}
                    <div className={styles.userInfo}>
                        <div className={styles.userInfoImage}>
                            {userData?.photoURL || userData?.photo ? (
                                <img 
                                    src={userData?.photoURL || userData?.photo!}
                                    alt="Profile"
                                    className={styles.userInfoAvatar}
                                />
                            ) : (
                                <div className={styles.userInfoInitials}>
                                    {userData?.name ? userData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                                </div>
                            )}
                        </div>
                        <div className={styles.userInfoText}>
                            <div className={styles.userName}>
                                {userData?.name || userData?.phone || 'User'}
                            </div>
                            <div className={styles.userUsername}>
                                @{userData?.username || userData?.phone?.replace(/\D/g, '') || 'user'}
                            </div>
                        </div>
                    </div>

                    {/* Personal Navigation */}
                    <div className={styles.dropdownItems}>
                        <div className={styles.dropdownItem} onClick={() => { setShowDropdown(false); router.push('/profile'); }}>
                            <FaUser className={styles.dropdownIcon} />
                            <span>View Profile</span>
                        </div>

                        <div className={styles.dropdownItem} onClick={handleTicketsClick}>
                            <FaTicketAlt className={styles.dropdownIcon} />
                            <span>Tickets</span>
                        </div>

                        <div className={styles.dropdownItem} onClick={handleSettingsClick}>
                            <FaCog className={styles.dropdownIcon} />
                            <span>Settings</span>
                        </div>

                        <div className={styles.dropdownDivider}></div>
                    </div>

                    {/*Pages Section */}
                    <div className={styles.ownedPagesSection}>
                        <div className={styles.sectionTitle}>Pages</div>
                        
                        {/* Artist Pages */}
                        {ownedPages.artists.map((artist) => (
                            <div 
                                key={artist.uid} 
                                className={styles.pageItem}
                                onClick={() => { 
                                    setShowDropdown(false); 
                                    // Redirect to management interface with specific page
                                    router.push(`/artist?page=${artist.uid}`);
                                }}
                            >
                                <FaMicrophone className={styles.pageIcon} />
                                <span>{artist.name || 'Unnamed Artist'}</span>
                            </div>
                        ))}
                        
                        {/* Organization Pages */}
                        {ownedPages.organizations.map((org) => (
                            <div 
                                key={org.uid} 
                                className={styles.pageItem}
                                onClick={() => { 
                                    setShowDropdown(false); 
                                    // Redirect to management interface with specific page
                                    router.push(`/organisation?page=${org.uid}`);
                                }}
                            >
                                <FaBuilding className={styles.pageIcon} />
                                <span>{org.name || 'Unnamed Organization'}</span>
                            </div>
                        ))}
                        
                        {/* Venue Pages */}
                        {ownedPages.venues.map((venue) => (
                            <div 
                                key={venue.uid} 
                                className={styles.pageItem}
                                onClick={() => { 
                                    setShowDropdown(false); 
                                    // Redirect to management interface with specific page
                                    router.push(`/venue?page=${venue.uid}`);
                                }}
                            >
                                <FaMapMarkerAlt className={styles.pageIcon} />
                                <span>{venue.name || 'Unnamed Venue'}</span>
                            </div>
                        ))}
                        
                        {/* Shared Pages Section */}
                        {(sharedPages.artists.length > 0 || sharedPages.organizations.length > 0 || sharedPages.venues.length > 0) && (
                            <>
                                <div className={styles.sharedPagesHeader}>
                                    <FaShareAlt className={styles.sharedIcon} />
                                    <span>Shared with me</span>
                                </div>
                                
                                {/* Shared Artist Pages */}
                                {sharedPages.artists.map((artist) => (
                                    <div 
                                        key={`shared-artist-${artist.uid}`} 
                                        className={`${styles.pageItem} ${styles.sharedPageItem}`}
                                        onClick={() => { 
                                            setShowDropdown(false); 
                                            router.push(`/artist?page=${artist.uid}`);
                                        }}
                                    >
                                        <FaMicrophone className={styles.pageIcon} />
                                        <span>{artist.name}</span>
                                        <span className={styles.roleTag}>{artist.role}</span>
                                    </div>
                                ))}
                                
                                {/* Shared Organization Pages */}
                                {sharedPages.organizations.map((org) => (
                                    <div 
                                        key={`shared-org-${org.uid}`} 
                                        className={`${styles.pageItem} ${styles.sharedPageItem}`}
                                        onClick={() => { 
                                            setShowDropdown(false); 
                                            router.push(`/organisation?page=${org.uid}`);
                                        }}
                                    >
                                        <FaBuilding className={styles.pageIcon} />
                                        <span>{org.name}</span>
                                        <span className={styles.roleTag}>{org.role}</span>
                                    </div>
                                ))}
                                
                                {/* Shared Venue Pages */}
                                {sharedPages.venues.map((venue) => (
                                    <div 
                                        key={`shared-venue-${venue.uid}`} 
                                        className={`${styles.pageItem} ${styles.sharedPageItem}`}
                                        onClick={() => { 
                                            setShowDropdown(false); 
                                            router.push(`/venue?page=${venue.uid}`);
                                        }}
                                    >
                                        <FaMapMarkerAlt className={styles.pageIcon} />
                                        <span>{venue.name}</span>
                                        <span className={styles.roleTag}>{venue.role}</span>
                                    </div>
                                ))}
                            </>
                        )}
                        
                        {/* Create New Page Option */}
                        <div className={styles.pageItem} onClick={handleCreateNewPage}>
                            <FaPlus className={styles.pageIcon} />
                            <span>Create new page</span>
                        </div>
                        
                        <div className={styles.dropdownDivider}></div>
                    </div>

                    {/* Sign Out */}
                    <div className={styles.dropdownItems}>
                        <div className={styles.dropdownItem} onClick={handleLogout}>
                            <FaSignOutAlt className={styles.dropdownIcon} />
                            <span>Sign Out</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PersonLogo; 