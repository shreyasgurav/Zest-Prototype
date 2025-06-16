'use client';

import logo from '../header-images/zest-logo.png';
import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import PersonLogo from "../PersonLogo/PersonLogo";
import styles from "./header.module.css";
import Link from 'next/link';
import { Calendar, PartyPopper, Search, X, Building2, MapPin, Clock, ArrowRight, ChevronDown, Ticket, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SearchResult {
    id: string;
    type: 'event' | 'activity' | 'organization';
    title: string;
    description?: string;
    image?: string;
    location?: string;
    date?: string;
    organizationName?: string;
}

const POPULAR_CITIES = [
    'Mumbai',
    'Delhi',
    'Bangalore',
    'Hyderabad',
    'Chennai',
    'Kolkata',
    'Pune',
    'Ahmedabad'
];

const Header = () => {
    const router = useRouter();
    const [isSearchVisible, setSearchVisible] = useState(false);
    const [isNavActive, setNavActive] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const [isLocationOpen, setLocationOpen] = useState(false);
    const [selectedCity, setSelectedCity] = useState('Mumbai');
    const locationRef = useRef<HTMLLIElement>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });

        // Close search when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setSearchVisible(false);
            }
            // Close location dropdown when clicking outside
            if (locationRef.current && !locationRef.current.contains(event.target as Node)) {
                setLocationOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            unsubscribe();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (searchQuery.length >= 2) {
            setIsLoading(true);
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
            searchTimeoutRef.current = setTimeout(() => {
                performSearch();
            }, 300);
        } else {
            setSearchResults([]);
        }
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery]);

    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY;
            setIsScrolled(scrollPosition > 10); // Hide after 10px scroll
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const performSearch = async () => {
        try {
            const results: SearchResult[] = [];
            const searchLower = searchQuery.toLowerCase();

            // Search Events
            const eventsQuery = query(
                collection(db, "events"),
                where("eventTitle", ">=", searchLower),
                where("eventTitle", "<=", searchLower + '\uf8ff'),
                limit(3)
            );
            const eventsSnapshot = await getDocs(eventsQuery);
            eventsSnapshot.forEach(doc => {
                const data = doc.data();
                results.push({
                    id: doc.id,
                    type: 'event',
                    title: data.eventTitle,
                    description: data.aboutEvent,
                    image: data.event_image,
                    location: data.eventVenue,
                    date: data.eventDateTime,
                    organizationName: data.hostingClub
                });
            });

            // Search Activities
            const activitiesQuery = query(
                collection(db, "activities"),
                where("activityName", ">=", searchLower),
                where("activityName", "<=", searchLower + '\uf8ff'),
                limit(3)
            );
            const activitiesSnapshot = await getDocs(activitiesQuery);
            activitiesSnapshot.forEach(doc => {
                const data = doc.data();
                results.push({
                    id: doc.id,
                    type: 'activity',
                    title: data.activityName,
                    description: data.aboutActivity,
                    image: data.activity_image,
                    location: data.activityLocation
                });
            });

            // Search Organizations (only public profiles)
            const orgsQuery = query(
                collection(db, "organizations"),
                where("organizationName", ">=", searchLower),
                where("organizationName", "<=", searchLower + '\uf8ff'),
                where("isPublic", "==", true),
                limit(3)
            );
            const orgsSnapshot = await getDocs(orgsQuery);
            orgsSnapshot.forEach(doc => {
                const data = doc.data();
                results.push({
                    id: doc.id,
                    type: 'organization',
                    title: data.organizationName,
                    description: data.aboutOrganization,
                    image: data.organization_image
                });
            });

            setSearchResults(results);
        } catch (error) {
            console.error('Error searching:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSearch = () => {
        setSearchVisible(!isSearchVisible);
        if (!isSearchVisible) {
            setNavActive(false);
            setTimeout(() => {
                const searchInput = document.querySelector(`.${styles.searchInput}`) as HTMLInputElement;
                if (searchInput) searchInput.focus();
            }, 100);
        }
    };

    const handleResultClick = (result: SearchResult) => {
        setSearchVisible(false);
        setSearchQuery('');
        switch (result.type) {
            case 'event':
                router.push(`/event-profile/${result.id}`);
                break;
            case 'activity':
                router.push(`/activity-profile/${result.id}`);
                break;
            case 'organization':
                router.push(`/organisation/${result.id}`);
                break;
        }
    };

    const getResultIcon = (type: SearchResult['type']) => {
        switch (type) {
            case 'event':
                return <Calendar className={styles.resultIcon} />;
            case 'activity':
                return <PartyPopper className={styles.resultIcon} />;
            case 'organization':
                return <Building2 className={styles.resultIcon} />;
        }
    };

    const isOrganization = () => {
        return user?.providerData[0]?.providerId === 'phone';
    };

    const handleNavItemClick = () => {
        setNavActive(false);
    };

    const toggleNav = () => {
        setNavActive(!isNavActive);
        if (isNavActive) {
            setSearchVisible(false);
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            performSearch();
        }
    };

    const handleCitySelect = (city: string) => {
        setSelectedCity(city);
        setLocationOpen(false);
        // Here you can add logic to update the city in your app's state/context
    };

    return (
        <>
            <div className={styles.globalStyles}>
                <div className={`${styles['nav-container']} ${isNavActive ? styles.active : ''}`}>
                    <nav>
                        <ul className={styles['mobile-nav']}>
                            <li className={styles.mobileLocationContainer} ref={locationRef}>
                                <button 
                                    className={styles.mobileLocationButton}
                                    onClick={() => setLocationOpen(!isLocationOpen)}
                                >
                                    <MapPin className={styles.mobileLocationIcon} />
                                    <span className={styles.mobileLocationText}>{selectedCity}</span>
                                    <ChevronDown className={`${styles.mobileChevronIcon} ${isLocationOpen ? styles.rotate : ''}`} />
                                </button>
                                {isLocationOpen && (
                                    <div className={styles.mobileLocationDropdown}>
                                        <div className={styles.locationSearch}>
                                            <input 
                                                type="text"
                                                placeholder="Search city..."
                                                className={styles.locationInput}
                                            />
                                        </div>
                                        <div className={styles.popularCities}>
                                            <h3>Popular Cities</h3>
                                            <ul>
                                                {POPULAR_CITIES.map((city) => (
                                                    <li 
                                                        key={city}
                                                        className={city === selectedCity ? styles.selected : ''}
                                                        onClick={() => handleCitySelect(city)}
                                                    >
                                                        {city}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </li>
                            <li>
                                <Link href="/" className={styles['link-logo']}>
                                    <img src={logo.src} alt="Zest Logo" />
                                </Link>
                            </li>
                            <li>
                                <button 
                                    className={styles.mobileSearchButton}
                                    onClick={toggleSearch}
                                    aria-label="Search"
                                >
                                    <Search className={styles.mobileSearchIcon} />
                                </button>
                            </li>
                            <li>
                                <a className={styles['link-Profile-logo']}><PersonLogo /></a>
                            </li>
                        </ul>
                        <ul className={`${styles['mobile-nav-secondary']} ${isScrolled ? styles.hide : ''}`}>
                            <li className={styles.navItemWithIcon}>
                                <Link href="/events" className={styles.navLinkWithIcon}>
                                    <Ticket className={styles.navIcon} />
                                    <span>Events</span>
                                </Link>
                            </li>
                            <li className={styles.navItemWithIcon}>
                                <Link href="/activities" className={styles.navLinkWithIcon}>
                                    <Sparkles className={styles.navIcon} />
                                    <span>Activities</span>
                                </Link>
                            </li>
                        </ul>

                        <ul className={`${styles['desktop-nav']} ${isNavActive ? styles.show : ''}`}>
                            <li>
                                <Link href="/" className={styles['link-logo']} onClick={handleNavItemClick}>
                                    <img src={logo.src} alt="Zest Logo" />
                                </Link>
                            </li>
                            <li className={styles.locationContainer}>
                                <button 
                                    className={styles.locationButton}
                                    onClick={() => setLocationOpen(!isLocationOpen)}
                                >
                                    <MapPin className={styles.locationIcon} />
                                    <span>{selectedCity}</span>
                                    <ChevronDown className={`${styles.chevronIcon} ${isLocationOpen ? styles.rotate : ''}`} />
                                </button>
                                {isLocationOpen && (
                                    <div className={styles.locationDropdown}>
                                        <div className={styles.locationSearch}>
                                            <input 
                                                type="text"
                                                placeholder="Search city..."
                                                className={styles.locationInput}
                                            />
                                        </div>
                                        <div className={styles.popularCities}>
                                            <h3>Popular Cities</h3>
                                            <ul>
                                                {POPULAR_CITIES.map((city) => (
                                                    <li 
                                                        key={city}
                                                        className={city === selectedCity ? styles.selected : ''}
                                                        onClick={() => handleCitySelect(city)}
                                                    >
                                                        {city}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </li>
                            <li className={styles.navItemWithIcon}>
                                <Link href="/events" onClick={handleNavItemClick} className={styles.navLinkWithIcon}>
                                    <Ticket className={styles.navIcon} />
                                    <span>Events</span>
                                </Link>
                            </li>
                            <li className={styles.navItemWithIcon}>
                                <Link href="/activities" onClick={handleNavItemClick} className={styles.navLinkWithIcon}>
                                    <Sparkles className={styles.navIcon} />
                                    <span>Activities</span>
                                </Link>
                            </li>
                            {isOrganization() && (
                                <li>
                                    <Link href="/create" onClick={handleNavItemClick}>Create</Link>
                                </li>
                            )}
                            <li>
                                <button 
                                    className={styles.searchNavButton}
                                    onClick={toggleSearch}
                                    aria-label="Search"
                                >
                                    <Search className={styles.searchNavIcon} />
                                </button>
                            </li>
                            <li>
                                <a className={styles['link-Profile-logo']} onClick={handleNavItemClick}><PersonLogo /></a>
                            </li>
                        </ul>
                    </nav>
                </div>
            </div>

            {isSearchVisible && (
                <>
                    <div className={styles.searchBackground} onClick={() => setSearchVisible(false)} />
                    <div 
                        ref={searchContainerRef}
                        className={styles['search-container']}
                    >
                        <form onSubmit={handleSearchSubmit}>
                            <Search className={styles.searchIcon} />
                            <input 
                                type="text"
                                className={styles.searchInput}
                                placeholder="Search events, activities, and organizations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <>
                                    <button 
                                        type="button" 
                                        className={styles.clearButton}
                                        onClick={() => setSearchQuery('')}
                                    >
                                        <X className={styles.clearIcon} />
                                    </button>
                                    <button 
                                        type="submit" 
                                        className={styles.searchButton}
                                        disabled={!searchQuery.trim()}
                                    >
                                        <ArrowRight className={styles.searchButtonIcon} />
                                    </button>
                                </>
                            )}
                        </form>

                        {searchQuery.length >= 2 && (
                            <div className={styles.searchResults}>
                                {isLoading ? (
                                    <div className={styles.loadingResults}>
                                        <div className={styles.loadingSpinner}></div>
                                        <span>Searching...</span>
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <>
                                        {searchResults.map((result) => (
                                            <div
                                                key={`${result.type}-${result.id}`}
                                                className={styles.searchResult}
                                                onClick={() => handleResultClick(result)}
                                            >
                                                <div className={styles.resultIconContainer}>
                                                    {getResultIcon(result.type)}
                                                </div>
                                                <div className={styles.resultContent}>
                                                    <h3>{result.title}</h3>
                                                    {result.description && (
                                                        <p className={styles.resultDescription}>
                                                            {truncateText(result.description, 50)}
                                                        </p>
                                                    )}
                                                    <div className={styles.resultMeta}>
                                                        {result.location && (
                                                            <span className={styles.resultMetaItem}>
                                                                <MapPin className={styles.metaIcon} />
                                                                {result.location}
                                                            </span>
                                                        )}
                                                        {result.date && (
                                                            <span className={styles.resultMetaItem}>
                                                                <Clock className={styles.metaIcon} />
                                                                {formatDate(result.date)}
                                                            </span>
                                                        )}
                                                        {result.organizationName && (
                                                            <span className={styles.resultMetaItem}>
                                                                <Building2 className={styles.metaIcon} />
                                                                {result.organizationName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div className={styles.noResults}>
                                        <p>No results found for "{searchQuery}"</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {!searchQuery && (
                            <div className={styles.quickLinks}>
                                <h2>Quick Links</h2>
                                <div className={styles.quickLinksGrid}>
                                    <Link href="/events" className={styles.quickLink}>
                                        <Calendar className={styles.quickLinkIcon} />
                                        <span>Events</span>
                                    </Link>
                                    <Link href="/activities" className={styles.quickLink}>
                                        <PartyPopper className={styles.quickLinkIcon} />
                                        <span>Activities</span>
                                    </Link>
                                    <Link href="/organizations" className={styles.quickLink}>
                                        <Building2 className={styles.quickLinkIcon} />
                                        <span>Organizations</span>
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </>
    );
};

const truncateText = (text: string, maxLength: number): string => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
};

const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

export default Header;