import React from 'react';
import styles from './About.module.css';

export default function AboutPage() {
  return (
    <div className={styles.aboutContainer}>
      <h1 className={styles.title}>About Zest</h1>
      <p className={styles.description}>
        Zest is your ultimate guide to discovering the best experiences in Mumbai.
        We curate and share the most exciting activities, events, and places to visit.
      </p>
    </div>
  );
} 