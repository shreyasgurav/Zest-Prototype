import React from 'react';
import styles from './ActivitySection.module.css';

const ActivityBoxSkeleton = () => {
  return (
    <div className={`${styles.activityBoxWrapper} ${styles.skeletonLoading}`}>
      <div className={styles.activityBoxCard}>
        <div className={styles.activityBoxImagePlaceholder}></div>
        <div className={styles.activityBoxInfo}>
          <div className={styles.skeletonLine}></div>
          <div className={styles.skeletonLine}></div>
          <div className={styles.skeletonLine}></div>
          <div className={styles.skeletonLine}></div>
        </div>
      </div>
    </div>
  );
};

const ActivitySectionSkeleton: React.FC = () => {
  return (
    <div className={`${styles.activitySection} ${styles.skeletonSection}`}>
      <div className={styles.activitySectionHeading}>
        <div className={`${styles.skeletonLine} ${styles.skeletonHeading}`}></div>
      </div>
      <div className={styles.embla}>
        <div className={styles.embla__viewport}>
          <div className={styles.embla__container}>
            {[1, 2, 3, 4].map((index) => (
              <div key={index} className={styles.embla__slide} style={{ opacity: 1 - (index * 0.2) }}>
                <ActivityBoxSkeleton />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivitySectionSkeleton; 