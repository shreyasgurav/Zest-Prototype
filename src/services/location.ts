/**
 * Location service for managing city-based filtering and location data
 */

import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { 
    extractCityFromVenue, 
    getStandardCityName, 
    MAJOR_CITIES, 
    isVenueInCity 
} from '@/lib/utils/location';
import { 
    matchVenueToCity, 
    getAllCities,
    getCityInfo,
    CITY_BOUNDARIES 
} from '@/lib/utils/cityBoundaries';

export interface CityData {
    name: string;
    count: number;
    eventIds: string[];
}

export interface LocationServiceCache {
    cities: CityData[];
    lastUpdated: number;
    ttl: number; // Time to live in milliseconds
}

// Cache duration: 1 hour
const CACHE_TTL = 60 * 60 * 1000;
const CACHE_KEY = 'location_service_cache';

/**
 * Get available cities from actual event data
 */
export async function getAvailableCities(): Promise<CityData[]> {
    try {
        // Check cache first
        const cached = getCachedCities();
        if (cached) {
            console.log('Using cached cities data');
            return cached;
        }

        console.log('Fetching cities from database...');
        
        // Check if db is available
        if (!db || typeof db !== 'function') {
            throw new Error('Database not initialized');
        }
        
        const eventsRef = collection(db(), 'events');
        // Remove orderBy to avoid index issues - we'll sort in memory instead
        let snapshot;
        try {
            snapshot = await getDocs(eventsRef);
        } catch (error) {
            console.error('Error fetching events collection:', error);
            throw error;
        }
        
        const cityMap = new Map<string, { count: number; eventIds: string[] }>();
        
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const venue = data.event_venue || data.eventVenue || '';
            const venueCoords = data.venue_coordinates;
            
            if (venue || venueCoords) {
                let city: string | null = null;
                
                // Try coordinate-based city detection first (most accurate)
                if (venueCoords && venueCoords.lat && venueCoords.lng) {
                    // Check all city boundaries to see which one contains this coordinate
                    for (const [cityName, cityBoundary] of Object.entries(CITY_BOUNDARIES)) {
                        if (matchVenueToCity(venueCoords, venue, cityName)) {
                            city = cityName;
                            break;
                        }
                    }
                }
                
                // Fallback to text-based extraction
                if (!city && venue) {
                    city = extractCityFromVenue(venue);
                    if (city) {
                        city = getStandardCityName(city);
                    }
                }
                
                // If we found a city, add it to the map
                if (city) {
                    const existing = cityMap.get(city) || { count: 0, eventIds: [] };
                    cityMap.set(city, {
                        count: existing.count + 1,
                        eventIds: [...existing.eventIds, doc.id]
                    });
                }
            }
        });
        
        // Convert to array and sort by count
        const cities: CityData[] = Array.from(cityMap.entries())
            .map(([name, data]) => ({
                name,
                count: data.count,
                eventIds: data.eventIds
            }))
            .sort((a, b) => b.count - a.count);
        
        // Cache the results
        setCachedCities(cities);
        
        console.log(`Found ${cities.length} cities with events`);
        return cities;
        
    } catch (error) {
        console.error('Error fetching available cities:', error);
        // Return major cities as fallback
        return MAJOR_CITIES.slice(0, 8).map(city => ({
            name: city,
            count: 0,
            eventIds: []
        }));
    }
}

/**
 * Get popular cities (top cities by event count)
 */
export async function getPopularCities(limit: number = 8): Promise<CityData[]> {
    const allCities = await getAvailableCities();
    return allCities.slice(0, limit);
}

/**
 * Search cities by name
 */
export async function searchCities(query: string): Promise<CityData[]> {
    if (!query || query.length < 2) return [];
    
    const allCities = await getAvailableCities();
    const searchLower = query.toLowerCase();
    
    return allCities.filter(city => 
        city.name.toLowerCase().includes(searchLower)
    ).slice(0, 10);
}

/**
 * Check if a city has events
 */
export async function cityHasEvents(cityName: string): Promise<boolean> {
    const cities = await getAvailableCities();
    const standardCity = getStandardCityName(cityName);
    return cities.some(city => city.name === standardCity && city.count > 0);
}

/**
 * Get event count for a specific city
 */
export async function getCityEventCount(cityName: string): Promise<number> {
    const cities = await getAvailableCities();
    const standardCity = getStandardCityName(cityName);
    const city = cities.find(c => c.name === standardCity);
    return city?.count || 0;
}

/**
 * Filter events by city using coordinate-based matching
 */
export function filterEventsByCity(events: any[], cityName: string): any[] {
    if (!cityName || cityName === 'All Cities') return events;
    
    return events.filter(event => {
        const venue = event.event_venue || event.eventVenue || '';
        const venueCoords = event.venue_coordinates;
        
        // Use the new coordinate-based matching
        return matchVenueToCity(venueCoords, venue, cityName);
    });
}

/**
 * Get similar cities (nearby or related cities)
 */
export async function getSimilarCities(cityName: string): Promise<CityData[]> {
    const allCities = await getAvailableCities();
    const standardCity = getStandardCityName(cityName);
    
    // For now, return cities from the same state/region
    // This can be enhanced with actual geographic data
    const similarCities = allCities.filter(city => {
        const name = city.name.toLowerCase();
        const target = standardCity.toLowerCase();
        
        // Basic similarity matching - can be improved
        if (name.includes(target.substring(0, 3)) || target.includes(name.substring(0, 3))) {
            return city.name !== standardCity;
        }
        
        return false;
    });
    
    return similarCities.slice(0, 5);
}

/**
 * Cache management functions
 */
function getCachedCities(): CityData[] | null {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;
        
        const data: LocationServiceCache = JSON.parse(cached);
        const now = Date.now();
        
        if (now - data.lastUpdated > data.ttl) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }
        
        return data.cities;
    } catch (error) {
        console.error('Error reading cached cities:', error);
        localStorage.removeItem(CACHE_KEY);
        return null;
    }
}

function setCachedCities(cities: CityData[]): void {
    try {
        const cacheData: LocationServiceCache = {
            cities,
            lastUpdated: Date.now(),
            ttl: CACHE_TTL
        };
        
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
        console.error('Error caching cities:', error);
    }
}

/**
 * Clear location cache (useful for admin operations)
 */
export function clearLocationCache(): void {
    localStorage.removeItem(CACHE_KEY);
    console.log('Location cache cleared');
}

/**
 * Get location insights for analytics
 */
export async function getLocationInsights(): Promise<{
    totalCities: number;
    totalEvents: number;
    topCities: CityData[];
    coverage: { [state: string]: number };
}> {
    const cities = await getAvailableCities();
    const totalEvents = cities.reduce((sum, city) => sum + city.count, 0);
    
    // Basic state coverage calculation
    const stateCoverage: { [state: string]: number } = {};
    
    // This is a simplified mapping - in reality you'd want a proper city-to-state mapping
    cities.forEach(city => {
        const cityName = city.name.toLowerCase();
        let state = 'Other';
        
        if (['mumbai', 'pune', 'nashik', 'aurangabad'].includes(cityName)) {
            state = 'Maharashtra';
        } else if (['delhi', 'gurgaon', 'noida', 'faridabad'].includes(cityName)) {
            state = 'Delhi NCR';
        } else if (['bangalore', 'mysore'].includes(cityName)) {
            state = 'Karnataka';
        } else if (['chennai', 'coimbatore', 'madurai'].includes(cityName)) {
            state = 'Tamil Nadu';
        } else if (['hyderabad', 'visakhapatnam', 'warangal'].includes(cityName)) {
            state = 'Telangana/Andhra Pradesh';
        } else if (['kolkata', 'howrah'].includes(cityName)) {
            state = 'West Bengal';
        }
        
        stateCoverage[state] = (stateCoverage[state] || 0) + city.count;
    });
    
    return {
        totalCities: cities.length,
        totalEvents,
        topCities: cities.slice(0, 10),
        coverage: stateCoverage
    };
} 