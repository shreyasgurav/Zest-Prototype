'use client';

import React, { useEffect, useState } from "react";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { isOrganizationSession } from '../../../utils/authHelpers';
import OrganizationPhoneLogin from '@/components/PhoneLogin/OrganizationPhoneLogin';
import styles from './OrganizationLogin.module.css';

function OrganizationLogin() {
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  // Client-side initialization
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Only run on client side when component is initialized
    if (!isClient) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Check if user has organization profile - redirect to organization page
          const orgRef = doc(db, "Organisations", user.uid);
          const orgSnap = await getDoc(orgRef);
          if (orgSnap.exists()) {
            console.log("🟠 Organization profile found, redirecting to organization page");
            router.push('/organisation');
            return;
          }

          // Check if user has user profile - redirect to user profile page
          const userRef = doc(db, "Users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            console.log("🔵 User profile found, redirecting to user profile page");
            router.push('/profile');
            return;
          }

          // User is authenticated but has no profile data - allow access to organization login
          console.log("⚪ Authenticated user with no profile data - allowing organization login");
          setIsLoading(false);
        } catch (error) {
          console.error("Error checking user profiles:", error);
          setIsLoading(false);
        }
      } else {
        // No user logged in, allow access to organization login
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, isClient]);

  if (isLoading) {
    return (
      <div className={styles.loginPageContainer}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <h1 className={styles.loginTitle}>Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginPageContainer}>
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <Link href="/" className={styles.backToHome}>
            ← Back to Home
          </Link>
          <h1 className={styles.loginTitle}>Organization Login</h1>
        </div>

        <div className={styles.loginFormContainer}>
          <OrganizationPhoneLogin />
        </div>

        <div className={styles.loginFooter}>
          <p className={styles.userLoginText}>
            Looking for user login? 
            <Link href="/login" className={styles.userLoginLink}>
              Go to User Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default OrganizationLogin; 