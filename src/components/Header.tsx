'use client';

import logo from './header-images/zest-logo.png';
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import PersonLogo from "./PersonLogo/PersonLogo";
import styles from "./header.module.css";
import Link from 'next/link';

const Header = () => {
    const [isSearchVisible, setSearchVisible] = useState(false);
    const [isNavActive, setNavActive] = useState(false);
    const [isEventFormVisible, setEventFormVisible] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
            if (user && user.providerData[0].providerId === 'google.com') {
                setUserEmail(user.email);
            } else {
                setUserEmail(null);
            }
        });

        return () => unsubscribe();
    }, []);

    const toggleSearch = () => {
        setSearchVisible(!isSearchVisible);
        if (!isSearchVisible) {
            setNavActive(false);
        }
    };

    const toggleNav = () => {
        setNavActive(!isNavActive);
        if (isNavActive) {
            setSearchVisible(false);
        }
    };

    const toggleEventForm = () => {
        setEventFormVisible(!isEventFormVisible);
    };

    const isAuthorizedUser = () => {
        return userEmail === "shrreyasgurav@gmail.com";
    };

    const handleNavItemClick = () => {
        setNavActive(false);
    };

    return (
        <div className={`${styles['nav-container']} ${isNavActive ? styles.active : ''}`}>
            <nav className={styles.nav}>
                <ul className={styles['mobile-nav']}>
                    <li>
                        <div className={styles['menu-icon-container']} onClick={toggleNav}>
                            <div className={styles['menu-icon']}>
                                <span className={styles['line-1']}></span>
                                <span className={styles['line-2']}></span>
                            </div>
                        </div>
                    </li>
                    <li>
                        <Link href="/" className={styles['link-logo']}>
                            <img className={styles['link-logo']} src={logo.src} alt="Zest Logo" />
                        </Link>
                    </li>
                    <li>
                        <a className={styles['link-Profile-logo']}><PersonLogo /></a>
                    </li>
                </ul>

                <ul className={`${styles['desktop-nav']} ${isNavActive ? styles.show : ''}`}>
                    <li>
                        <Link href="/" className={styles['link-logo']} onClick={handleNavItemClick}>
                            <img className={styles['link-logo']} src={logo.src} alt="Zest Logo" />
                        </Link>
                    </li>
                    <li><Link href="/about" onClick={handleNavItemClick}>About</Link></li>
                    <li><Link href="/guides" onClick={handleNavItemClick}>Guides</Link></li>
                    {isAuthorizedUser() && (
                        <li>
                            <Link href="/create" onClick={handleNavItemClick}>Create</Link>
                        </li>
                    )}
                    <li>
                       {/* <a href="#" className={styles['link-search']} onClick={toggleSearch}></a> */}
                    </li>
                    <li>
                        <a className={styles['link-Profile-logo']} onClick={handleNavItemClick}><PersonLogo /></a>
                    </li>
                </ul>
            </nav>
        </div>
    );
};

export default Header; 