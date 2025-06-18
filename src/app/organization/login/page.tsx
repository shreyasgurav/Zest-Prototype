'use client';

import React, { useState, useEffect, useRef } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { doc, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import { toast } from "react-toastify";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './OrganizationLogin.module.css';

// Extend the Window interface to include our custom properties
declare global {
  interface Window {
    orgRecaptchaVerifier: RecaptchaVerifier | null;
    orgConfirmationResult: ConfirmationResult | null;
  }
}

function OrganizationLogin() {
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [showOtp, setShowOtp] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [recaptchaReady, setRecaptchaReady] = useState<boolean>(false);
  const [initializingRecaptcha, setInitializingRecaptcha] = useState<boolean>(true);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const cleanupRecaptcha = () => {
    if (window.orgRecaptchaVerifier) {
      try {
        window.orgRecaptchaVerifier.clear();
      } catch (error) {
        console.log("Error clearing reCAPTCHA:", error);
      }
      window.orgRecaptchaVerifier = null;
    }
  };

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const initRecaptcha = async () => {
      if (!mounted) return;
      
      try {
        setInitializingRecaptcha(true);
        
        // Clean up any existing reCAPTCHA
        cleanupRecaptcha();
        
        // Wait a bit for the DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!document.getElementById('org-recaptcha-container')) {
          console.error("reCAPTCHA container not found");
          return;
        }

        window.orgRecaptchaVerifier = new RecaptchaVerifier(
          auth,
          'org-recaptcha-container',
          {
            size: 'normal',
            callback: () => {
              console.log("reCAPTCHA verified for organization");
              if (mounted) {
                setRecaptchaReady(true);
                setInitializingRecaptcha(false);
              }
            },
            'expired-callback': () => {
              console.log("reCAPTCHA expired");
              if (mounted) {
                setRecaptchaReady(false);
                toast.error("reCAPTCHA expired. Please refresh.");
              }
            },
            'error-callback': (error: any) => {
              console.error("reCAPTCHA error:", error);
              if (mounted) {
                setRecaptchaReady(false);
                setInitializingRecaptcha(false);
                toast.error("reCAPTCHA error. Please refresh the page.");
              }
            }
          }
        );

        await window.orgRecaptchaVerifier.render();
        
        if (mounted) {
          setInitializingRecaptcha(false);
          // Auto-verify reCAPTCHA for better UX
          setTimeout(() => {
            if (mounted && !recaptchaReady) {
              setRecaptchaReady(true);
            }
          }, 1000);
        }
      } catch (error: any) {
        console.error("reCAPTCHA initialization error:", error);
        if (mounted) {
          setInitializingRecaptcha(false);
          setRecaptchaReady(false);
          
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying reCAPTCHA initialization (${retryCount}/${maxRetries})`);
            setTimeout(() => {
              if (mounted) initRecaptcha();
            }, 2000);
          } else {
            toast.error("Unable to initialize phone verification. Please check your internet connection and refresh the page.");
          }
        }
      }
    };

    // Initialize reCAPTCHA with a delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initRecaptcha();
    }, 1000);

    return () => {
      mounted = false;
      clearTimeout(timer);
      cleanupRecaptcha();
    };
  }, []);

  useEffect(() => {
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [timeLeft]);

  const checkPhoneNumberConflict = async (phone: string) => {
    try {
      // Check if phone number is already used by an organization
      const orgQuery = query(
        collection(db, "Organisations"),
        where("phoneNumber", "==", phone)
      );
      const orgSnapshot = await getDocs(orgQuery);
      
      if (!orgSnapshot.empty) {
        return { conflict: true, type: 'organization' };
      }

      // Check if phone number is used by a user (this is allowed)
      const userQuery = query(
        collection(db, "Users"),
        where("phone", "==", phone)
      );
      const userSnapshot = await getDocs(userQuery);
      
      if (!userSnapshot.empty) {
        return { conflict: false, type: 'user' };
      }

      return { conflict: false, type: 'none' };
    } catch (error) {
      console.error("Error checking phone number:", error);
      return { conflict: false, type: 'error' };
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber) {
      toast.error("Please enter a phone number");
      return;
    }

    if (timeLeft > 0) {
      toast.error(`Please wait ${timeLeft} seconds before trying again`);
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      
      // Check for phone number conflicts
      const conflictCheck = await checkPhoneNumberConflict(formattedPhone);
      
      if (conflictCheck.conflict && conflictCheck.type === 'organization') {
        toast.error("This phone number is already registered as an organization. Please login instead.");
        setLoading(false);
        return;
      }

      if (!window.orgRecaptchaVerifier) {
        throw new Error("reCAPTCHA not initialized. Please refresh the page.");
      }

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        window.orgRecaptchaVerifier
      );

      window.orgConfirmationResult = confirmationResult;
      setShowOtp(true);
      setTimeLeft(30);
      toast.success("OTP sent successfully!");
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      
      if (error.code === 'auth/too-many-requests') {
        toast.error("Too many attempts. Please try again later.");
        setTimeLeft(60);
      } else if (error.code === 'auth/invalid-phone-number') {
        toast.error("Please enter a valid phone number.");
      } else if (error.code === 'auth/invalid-app-credential') {
        toast.error("Phone verification is currently unavailable. Please try again later or contact support.");
      } else if (error.message.includes("reCAPTCHA")) {
        toast.error("Verification failed. Please refresh the page and try again.");
        // Reset reCAPTCHA
        cleanupRecaptcha();
        setRecaptchaReady(false);
        setInitializingRecaptcha(true);
        window.location.reload();
      } else {
        toast.error("Error sending OTP. Please refresh and try again.");
      }

      cleanupRecaptcha();
      setRecaptchaReady(false);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    if (!window.orgConfirmationResult) {
      toast.error("Session expired. Please request a new OTP.");
      setShowOtp(false);
      return;
    }

    setLoading(true);
    try {
      const result = await window.orgConfirmationResult.confirm(otp);
      
      if (result.user) {
        const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
        
        // Check if organization document already exists
        const orgDoc = await getDoc(doc(db, "Organisations", result.user.uid));
        
        if (!orgDoc.exists()) {
          // Create new organization document
          const orgData = {
            uid: result.user.uid,
            phoneNumber: formattedPhone,
            isActive: true,
            role: 'Organisation',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            settings: {
              notifications: true,
              emailUpdates: false,
              privacy: {
                profileVisibility: 'public',
                contactVisibility: 'followers'
              }
            }
          };

          await setDoc(doc(db, "Organisations", result.user.uid), orgData);
          toast.success("Organization account created successfully!");
        } else {
          toast.success("Login successful!");
        }
        
        router.push('/organisation');
      }
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      if (error.code === 'auth/invalid-verification-code') {
        toast.error("Invalid OTP. Please check and try again.");
      } else if (error.code === 'auth/code-expired') {
        toast.error("OTP has expired. Please request a new one.");
        setShowOtp(false);
      } else {
        toast.error("Invalid OTP or session expired. Please try again.");
        setShowOtp(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginPageContainer}>
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <Link href="/" className={styles.backToHome}>
            ← Back to Home
          </Link>
          <h1 className={styles.loginTitle}>Organization Login</h1>
          <p className={styles.loginSubtitle}>
            Join as an organization to create and manage events
          </p>
        </div>

        <div className={styles.loginForm}>
          {!showOtp ? (
            <form onSubmit={handleSendOtp}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Phone Number</label>
                <PhoneInput
                  international
                  defaultCountry="IN"
                  value={phoneNumber}
                  onChange={(value) => setPhoneNumber(value || "")}
                  className={styles.phoneInput}
                  disabled={loading}
                />
              </div>
              
              <div id="org-recaptcha-container" className={styles.recaptchaContainer}></div>
              
              {initializingRecaptcha && (
                <div className={styles.initializingMessage}>
                  <p>Initializing verification...</p>
                </div>
              )}
              
              <button 
                type="submit" 
                className={styles.submitButton}
                disabled={loading || timeLeft > 0 || initializingRecaptcha}
              >
                {loading ? "Sending..." : 
                 initializingRecaptcha ? "Initializing..." :
                 timeLeft > 0 ? `Wait ${timeLeft}s` : "Send OTP"}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Enter OTP</label>
                <input
                  type="text"
                  className={styles.otpInput} 
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  disabled={loading}
                />
              </div>
              
              <button 
                type="submit" 
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? "Verifying..." : "Verify OTP & Login"}
              </button>
              
              <button 
                type="button" 
                className={styles.backButton}
                onClick={() => setShowOtp(false)}
                disabled={loading}
              >
                Back to Phone Number
              </button>
            </form>
          )}
        </div>

        <div className={styles.loginFooter}>
          <p className={styles.userLoginText}>
            Looking for user login? 
            <Link href="/" className={styles.userLoginLink}>
              Go to User Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default OrganizationLogin; 