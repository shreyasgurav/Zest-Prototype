import React, { useState, useEffect, useRef } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { toast } from "react-toastify";
import styles from "./Login.module.css";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useRouter } from 'next/navigation';

// Extend the Window interface to include our custom properties
declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier | null;
    confirmationResult: ConfirmationResult | null;
  }
}

function Login() {
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [showOtp, setShowOtp] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [recaptchaReady, setRecaptchaReady] = useState<boolean>(false);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const initRecaptcha = async () => {
      try {
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        }

        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          {
            size: 'normal',
            callback: () => {
              console.log("reCAPTCHA verified");
              if (mounted) {
                setRecaptchaReady(true);
              }
            },
            'expired-callback': () => {
              if (mounted) {
                setRecaptchaReady(false);
                toast.error("reCAPTCHA expired. Please refresh.");
              }
            }
          }
        );

        await window.recaptchaVerifier.render();
      } catch (error) {
        console.error("reCAPTCHA initialization error:", error);
        if (mounted) {
          toast.error("Error initializing verification. Please refresh.");
        }
      }
    };

    const timer = setTimeout(() => {
      if (document.getElementById('recaptcha-container')) {
        initRecaptcha();
      }
    }, 1000);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  useEffect(() => {
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [timeLeft]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recaptchaReady) {
      toast.error("Please wait for verification to initialize");
      return;
    }

    if (timeLeft > 0) {
      toast.error(`Please wait ${timeLeft} seconds before trying again`);
      return;
    }

    if (!phoneNumber) {
      toast.error("Please enter a phone number");
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      
      if (!window.recaptchaVerifier) {
        throw new Error("Verification not initialized");
      }

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        window.recaptchaVerifier
      );

      window.confirmationResult = confirmationResult;
      setShowOtp(true);
      setTimeLeft(30);
      toast.success("OTP sent successfully!");
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      
      if (error.code === 'auth/too-many-requests') {
        toast.error("Too many attempts. Please try again later.");
        setTimeLeft(60);
      } else {
        toast.error("Error sending OTP. Please refresh and try again.");
      }

      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
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

    if (!window.confirmationResult) {
      toast.error("Session expired. Please request a new OTP.");
      setShowOtp(false);
      return;
    }

    setLoading(true);
    try {
      const result = await window.confirmationResult.confirm(otp);
      
      if (result.user) {
        // Check if organization document already exists
        const orgDoc = await getDoc(doc(db, "Organisations", result.user.uid));
        
        if (!orgDoc.exists()) {
          // Only create new document if it doesn't exist
          const orgData = {
            uid: result.user.uid,
            phoneNumber: phoneNumber,
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
        }
        
        toast.success("Login successful!");
        router.push('/organisation');
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      toast.error("Invalid OTP or session expired. Please try again.");
      setShowOtp(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginForm}>
      {!showOtp ? (
        <form onSubmit={handleSendOtp}>
          <div className={styles.phoneLogin}>
            <label className={styles.phoneNoText}>Phone Number</label>
            <PhoneInput
              international
              defaultCountry="IN"
              value={phoneNumber}
              onChange={(value) => setPhoneNumber(value || "")}
              className={styles.phoneNoInput}
              disabled={loading}
            />
            <div id="recaptcha-container" className={`${styles.mt3} ${styles.mb3}`}></div>
            <button 
              type="submit" 
              className={styles.sendOtpButton}
              disabled={loading || timeLeft > 0 || !recaptchaReady}
            >
              {loading ? "Sending..." : 
               !recaptchaReady ? "Verifying..." :
               timeLeft > 0 ? `Wait ${timeLeft}s` : "Send OTP"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={verifyOtp}>
          <div className={styles.otpSection}>
            <label className={styles.otpLabel}>Enter OTP</label>
            <input
              type="text"
              className={styles.otpInput} 
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              disabled={loading}
            />
            <button 
              type="submit" 
              className={styles.verifyOtpButton}
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default Login; 