'use client';

import React, { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import GuideBox from "@/components/GuidesSection/GuideBox/GuideBox";
import styles from './AllGuides.module.css';
import { FiSearch, FiX } from 'react-icons/fi';

interface Guide {
  id: string;
  name: string;
  cover_image?: string;
  slug?: string;
  createdBy?: string;
}

export default function AllGuides() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchGuides = async () => {
      try {
        const guidesCollectionRef = collection(db, "guides");
        const q = query(guidesCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        const guidesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Guide[];
        
        setGuides(guidesData);
        setError(null);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred while fetching guides');
        setGuides([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGuides();
  }, []);

  const filteredGuides = guides.filter(guide =>
    guide.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  if (error) {
    return (
      <div className={styles.allGuidesContainer}>
        <div className={styles.errorMessage}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.allGuidesPage}>
      <div className={styles.allGuidesContainer}>
        <div className={styles.allGuidesContent}>
          <div className={styles.allGuidesHeader}>
            <h1 className={styles.allGuidesTitle}>The Bombay Guide</h1>
            <span className={styles.guidesCount}>
              {guides.length} {guides.length === 1 ? 'Guide' : 'Guides'}
            </span>
          </div>

          <div className={styles.allGuidesSearchContainer}>
            <div className={styles.searchInputWrapper}>
              <FiSearch className={styles.searchIcon} />
              <input
                type="text"
                className={styles.allGuidesSearch}
                placeholder="Search guides..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searchQuery && (
                <button className={styles.clearSearch} onClick={clearSearch}>
                  <FiX />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className={styles.guidesGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
                <div key={index} className={styles.guideItem}>
                  <div className={styles.skeletonLoading}>
                    <div className={styles.skeletonBackground}></div>
                    <div className={styles.skeletonLine}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredGuides.length === 0 ? (
            <div className={styles.noResults}>
              <p>No guides found matching your search.</p>
              {searchQuery && (
                <button className={styles.clearFiltersBtn} onClick={clearSearch}>
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className={styles.guidesGrid}>
              {filteredGuides.map((guide) => (
                <div key={guide.id} className={styles.guideItem}>
                  <GuideBox guide={guide} onDelete={() => {}} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 