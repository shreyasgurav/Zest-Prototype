import React from 'react';
import styles from './EventsSection.module.css';

const EventsSectionSkeleton: React.FC = () => {
  return (
    <div className={styles.eventsSection}>
      {/* Header */}
      <div className={styles.eventsSectionHeading}>
        <div className={styles.skeletonHeading}>
          <div className={styles.skeletonTitle}></div>
        </div>
        <div className={styles.skeletonSeeAll}>
          <div className={styles.skeletonButton}></div>
        </div>
      </div>

      {/* Carousel */}
      <div className={styles.emblaContainer}>
        <div className={styles.embla}>
          <div className={styles.embla__viewport}>
            <div className={styles.embla__container}>
              {[1, 2, 3, 4].map((index) => (
                <div 
                  key={index} 
                  className={styles.embla__slide}
                >
                
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventsSectionSkeleton; 