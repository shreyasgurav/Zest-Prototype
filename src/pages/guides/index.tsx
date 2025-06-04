import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import GuideBox from '@/components/GuidesSection/GuideBox/GuidesBox';
import styles from '@/components/GuidesSection/AllGuides.module.css';
import Head from 'next/head';
import { useRouter } from 'next/router';

interface Guide {
  id: string;
  name: string;
  cover_image: string;
  slug: string;
}

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

const AllGuides = () => {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [animationReady, setAnimationReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchGuides = async () => {
      try {
        const guidesCollection = collection(db, "guides");
        const guidesSnapshot = await getDocs(guidesCollection);
        const guidesList: Guide[] = [];

        guidesSnapshot.forEach((doc) => {
          const guideData = doc.data();
          guidesList.push({
            id: doc.id,
            name: guideData.name,
            cover_image: guideData.cover_image,
            slug: guideData.slug || doc.id
          });
        });

        setGuides(guidesList);
        setTimeout(() => setAnimationReady(true), 100);
      } catch (error) {
        console.error("Error fetching guides:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGuides();
  }, []);

  const handleGuideClick = (guide: Guide) => {
    router.push(`/guides/${guide.slug}`);
  };

  const filteredGuides = guides.filter(guide =>
    guide.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className={styles.allGuidesPage}>
        <div className={styles.allGuidesContainer}>
          <div className={styles.allGuidesHeader}>
            <h1 className={styles.allGuidesTitle}>All Guides</h1>
            <div className={styles.guidesCount}>{filteredGuides.length} Activities</div>
          </div>
          <div className={styles.allGuidesSearchContainer}>
            <div className={styles.searchInputWrapper}>
              <svg className={styles.searchIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.allGuidesSearch}
              />
              {searchTerm && (
                <button 
                  className={styles.clearSearch}
                  onClick={() => setSearchTerm('')}
                >
                  ×
                </button>
              )}
            </div>
          </div>
          <div className={`${styles.allGuidesGrid} ${styles.guidesGrid} ${animationReady ? styles.animateIn : ''}`}>
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
                <p>No activities found matching "{searchTerm}"</p>
                <button className={styles.clearFiltersBtn} onClick={() => setSearchTerm('')}>Clear Search</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AllGuides; 