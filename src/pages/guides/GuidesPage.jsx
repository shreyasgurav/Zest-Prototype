import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import GuideBox from '@/components/GuidesSection/GuideBox/GuideBox';
import styles from './Guides.module.css';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { FiSearch, FiX } from 'react-icons/fi';
import Footer from '@/components/Footer';

const GuideBoxSkeleton = () => (
  <div className={`${styles.guidesBoxWrapper} ${styles.skeletonLoading}`}>
    <div className={styles.guidesBoxCard}>
      <div className={styles.skeletonBackground}></div>
      <div className={styles.guidesBoxInfo}>
        <div className={styles.skeletonLine}></div>
      </div>
    </div>
  </div>
);

const AllGuidesSkeleton = () => (
  <div className={styles.allGuidesContainer}>
    <div className={styles.allGuidesContent}>
      <div className={styles.allGuidesTitle}></div>
      <div className={styles.guidesGrid}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
          <div key={index} className={styles.guideItem}>
            <GuideBoxSkeleton />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const GuidesPage = () => {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [animationReady, setAnimationReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchGuides = async () => {
      try {
        const guidesCollectionRef = collection(db, "guides");
        const q = query(guidesCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        const guidesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setGuides(guidesData);
        setAnimationReady(true);
      } catch (error) {
        console.error("Error fetching guides:", error);
        setGuides([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGuides();
  }, []);

  const handleGuideClick = (guide) => {
    router.push(`/guides/${guide.slug}`);
  };

  const filteredGuides = guides.filter(guide =>
    guide.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Adventure Activities & Entertainment in Mumbai - Zest",
    "description": "Explore Mumbai's best adventure activities and entertainment venues. Find go-karting tracks, bowling alleys, paintball arenas, laser tag, and more with prices and locations.",
    "url": "https://zestlive.in/guides",
    "hasPart": guides.map(guide => ({
      "@type": "WebPage",
      "name": `Best ${guide.name} in Mumbai`,
      "url": `https://zestlive.in/guides/${guide.slug}`,
      "description": `Find the best ${guide.name.toLowerCase()} venues in Mumbai with prices and locations.`
    }))
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>All Guides - Zest</title>
        </Head>
        <AllGuidesSkeleton />
        <Footer />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>All Guides - Zest | Adventure Activities in Mumbai</title>
        <meta name="description" content="Explore Mumbai's best adventure activities and entertainment venues. Find go-karting tracks, bowling alleys, paintball arenas, laser tag, trampoline parks with prices and locations." />
        <meta name="keywords" content="adventure activities mumbai, entertainment mumbai, go-karting mumbai, bowling mumbai, paintball mumbai, laser tag mumbai, trampoline parks mumbai, zest mumbai" />
        <meta name="author" content="Zest Mumbai" />
        <meta property="og:title" content="Adventure Activities & Entertainment in Mumbai - Zest" />
        <meta property="og:description" content="Explore Mumbai's best adventure activities. Find go-karting, bowling, paintball, and more with prices." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://zestlive.in/guides" />
        <meta property="og:site_name" content="Zest Mumbai" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Adventure Activities in Mumbai - Zest" />
        <meta name="twitter:description" content="Find the best adventure activities in Mumbai with Zest." />
        <link rel="canonical" href="https://zestlive.in/guides" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Head>
      <div className={styles.guidesPage}>
        <div className={styles.guidesContainer}>
          <div className={styles.guidesHeader}>
            <h1 className={styles.guidesTitle}>All Guides</h1>
            <div className={styles.guidesCount}>{filteredGuides.length} Activities</div>
          </div>
          <div className={styles.guidesSearchContainer}>
            <div className={styles.searchInputWrapper}>
              <FiSearch className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchQuery}
                onChange={handleSearchChange}
                className={styles.guidesSearch}
              />
              {searchQuery && (
                <button 
                  className={styles.clearSearch}
                  onClick={clearSearch}
                >
                  <FiX />
                </button>
              )}
            </div>
          </div>
          <div className={`${styles.guidesGrid} ${animationReady ? styles.animateIn : ''}`}>
            {filteredGuides.length > 0 ? (
              filteredGuides.map((guide, index) => (
                <div 
                  key={guide.id} 
                  className={styles.guideItem}
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => handleGuideClick(guide)}
                >
                  <GuideBox guide={guide} onDelete={() => {}} />
                </div>
              ))
            ) : (
              <div className={styles.noResults}>
                <p>No activities found matching "{searchQuery}"</p>
                <button className={styles.clearFiltersBtn} onClick={clearSearch}>Clear Search</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default GuidesPage; 