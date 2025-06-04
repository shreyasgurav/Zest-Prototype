import React from 'react';
import styles from './AboutUs.module.css';

function AboutUs() {
    return (
        <div className={styles["about-us-container"]}>
            <div className={styles["about-us-content"]}>
                <h2>WTF is Zest?</h2>
                <p>
                    Zest is all about making it easier to find fun things to do in Mumbai! Whether you're looking for the best go-karting tracks, bowling alleys, trampoline parks, or other exciting spots, we've got you covered with detailed guides to help you plan your outings.
                </p>
                <p>
                    Right now, Zest focuses on city guides, but soon, we'll also be adding updates on fun events, curated itineraries, and more ways to explore Mumbai. Stay tuned—there's a lot more coming!
                </p>
            </div>
        </div>
    );
}

export default AboutUs; 