import React, { useState, useEffect, useRef } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { handleOrganizationAuthenticationFlow } from "../../utils/authHelpers";
import { toast } from "react-toastify";
import styles from "./Login.module.css";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useRouter } from 'next/navigation';

// Extend the Window interface to include our custom properties
declare global {
  interface Window {
    orgRecaptchaVerifier: RecaptchaVerifier | null;
    orgConfirmationResult: ConfirmationResult | null;
  }
}

function OrganizationPhoneLogin() {
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
        console.log("Error clearing organization reCAPTCHA:", error);
      }
      window.orgRecaptchaVerifier = null;
    }
    
    // Also clear the container
    const container = document.getElementById('organization-recaptcha-container');
    if (container) {
      container.innerHTML = '';
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
        
        // Clean up any existing reCAPTCHA first
        cleanupRecaptcha();
        
        // Wait a bit for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const container = document.getElementById('organization-recaptcha-container');
        if (!container) {
          console.error("Organization reCAPTCHA container not found");
          setInitializingRecaptcha(false);
          return;
        }

        // Check if reCAPTCHA is already rendered in this container
        if (container.hasChildNodes()) {
          console.log("Organization reCAPTCHA container already has content, clearing...");
          container.innerHTML = '';
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('Initializing fresh organization reCAPTCHA...');
        
        // Create new reCAPTCHA with error handling for already rendered case
        try {
          window.orgRecaptchaVerifier = new RecaptchaVerifier(
            auth,
            'organization-recaptcha-container',
            {
              size: 'invisible',
              callback: () => {
                console.log("reCAPTCHA verified for organization");
                if (mounted) {
                  setRecaptchaReady(true);
                  setInitializingRecaptcha(false);
                }
              },
              'expired-callback': () => {
                console.log("Organization reCAPTCHA expired");
                if (mounted) {
                  setRecaptchaReady(false);
                  toast.error("Security verification expired. Please try again.");
                }
              },
              'error-callback': (error: any) => {
                console.error("Organization reCAPTCHA callback error:", error);
                if (mounted) {
                  setRecaptchaReady(false);
                  setInitializingRecaptcha(false);
                }
              }
            }
          );

          console.log('Rendering organization reCAPTCHA...');
          await window.orgRecaptchaVerifier.render();
          
          if (mounted) {
            setInitializingRecaptcha(false);
            setRecaptchaReady(true);
            console.log('Organization reCAPTCHA ready for phone authentication');
          }
        } catch (renderError: any) {
          if (renderError.message && renderError.message.includes('already been rendered')) {
            console.log('Organization reCAPTCHA already rendered, clearing and retrying...');
            cleanupRecaptcha();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Retry once more
            if (retryCount === 0) {
              retryCount++;
              setTimeout(() => {
                if (mounted) initRecaptcha();
              }, 1000);
              return;
            }
          }
          throw renderError;
        }
      } catch (error: any) {
        console.error("Organization reCAPTCHA initialization error:", error);
        if (mounted) {
          setInitializingRecaptcha(false);
          setRecaptchaReady(false);
          
          // Handle specific "already rendered" error
          if (error.message && error.message.includes('already been rendered')) {
            console.log('Handling already rendered error - refreshing page...');
            setTimeout(() => {
              window.location.reload();
            }, 1000);
            return;
          }
          
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying organization reCAPTCHA initialization (${retryCount}/${maxRetries})`);
            setTimeout(() => {
              if (mounted) initRecaptcha();
            }, 2000);
          } else {
            toast.error("Security verification setup failed. Please refresh the page.");
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
      
      // Extra cleanup for hot reloads
      setTimeout(() => {
        const container = document.getElementById('organization-recaptcha-container');
        if (container) {
          container.innerHTML = '';
        }
      }, 100);
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

    if (!phoneNumber) {
      toast.error("Please enter a phone number");
      return;
    }

    if (timeLeft > 0) {
      toast.error(`Please wait ${timeLeft} seconds before trying again`);
      return;
    }

    if (!recaptchaReady || !window.orgRecaptchaVerifier) {
      toast.error("Security verification not ready. Please wait or refresh the page.");
      return;
    }

    setLoading(true);
    try {
      // Better phone number formatting with validation
      let formattedPhone = phoneNumber;
      
      // Log original input for debugging
      console.log('Original phone input:', phoneNumber);
      
      // The react-phone-number-input should already format it properly, but let's ensure it
      if (!formattedPhone || formattedPhone.length < 8) {
        toast.error("Please enter a valid phone number");
        setLoading(false);
        return;
      }
      
      // Ensure it starts with + (react-phone-number-input should handle this)
      if (!formattedPhone.startsWith('+')) {
        // Clean the number first
        const cleanNumber = formattedPhone.replace(/\D/g, '');
        
        if (cleanNumber.length === 10) {
          // Indian number without country code
          formattedPhone = `+91${cleanNumber}`;
        } else if (cleanNumber.length === 12 && cleanNumber.startsWith('91')) {
          // Indian number with 91 prefix but no +
          formattedPhone = `+${cleanNumber}`;
        } else {
          // Other countries - let user add country code
          toast.error("Please include country code in your phone number");
          setLoading(false);
          return;
        }
      }

      console.log('Formatted phone for Firebase:', formattedPhone);
      
      // Additional validation
      if (formattedPhone.length < 10 || formattedPhone.length > 16) {
        toast.error("Invalid phone number format");
        setLoading(false);
        return;
      }

      console.log('Sending OTP to organization:', formattedPhone);
      
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        window.orgRecaptchaVerifier
      );

      window.orgConfirmationResult = confirmationResult;
      setShowOtp(true);
      setTimeLeft(30);
      toast.success("OTP sent successfully! Check your messages.");
      
      console.log('OTP sent successfully for organization');
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      
      if (error.code === 'auth/too-many-requests') {
        toast.error("Too many attempts. Please try again later.");
        setTimeLeft(60);
      } else if (error.code === 'auth/invalid-phone-number') {
        toast.error("Please enter a valid phone number with country code.");
      } else if (error.code === 'auth/invalid-app-credential') {
        toast.error("App configuration error. Please contact support.");
        console.error("Firebase app credential error - check Firebase Console configuration");
      } else if (error.code === 'auth/captcha-check-failed') {
        toast.error("Security verification failed. Please refresh and try again.");
        cleanupRecaptcha();
        setRecaptchaReady(false);
        setInitializingRecaptcha(true);
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error("Failed to send OTP. Please check your number and try again.");
      }

      // Reset reCAPTCHA on error
      cleanupRecaptcha();
      setRecaptchaReady(false);
      setInitializingRecaptcha(true);
      
      // Reinitialize reCAPTCHA after a delay
      setTimeout(() => {
        if (document.getElementById('organization-recaptcha-container')) {
          window.location.reload();
        }
      }, 2000);
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
        console.log('OTP verified successfully for organization:', result.user.uid);
        
        // Clear any user session markers to ensure clean organization session
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('authType');
          sessionStorage.removeItem('userLogin');
          // Mark this as an organization session
          sessionStorage.setItem('authType', 'organization');
          sessionStorage.setItem('organizationLogin', 'true');
        }
        
        // Use organization authentication flow to create organization profile
        const { organizationData, navigationPath } = await handleOrganizationAuthenticationFlow(
          result.user,
          { phoneNumber: phoneNumber }
        );

        toast.success("Organization login successful!");
        console.log("Organization profile created/loaded:", organizationData);
        router.push(navigationPath);
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
    <div className={styles.loginForm}>
      <div className={styles.organizationLoginHeader}>
        <h2 style={{ color: 'white', marginBottom: '10px' }}>Organization Login</h2>
        <p style={{ color: '#8899a6', marginBottom: '20px' }}>
          Login with your phone number to create or access your organization profile
        </p>
      </div>
      
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
              placeholder="Enter your phone number"
            />
            
            <div id="organization-recaptcha-container" className={`${styles.mt3} ${styles.mb3}`}></div>
            
            {initializingRecaptcha && (
              <div className={styles.initializingMessage}>
                <p>Setting up security verification...</p>
              </div>
            )}
            
            <button 
              type="submit" 
              className={styles.sendOtpButton}
              disabled={loading || timeLeft > 0 || initializingRecaptcha || !recaptchaReady}
            >
              {loading ? "Sending OTP..." : 
               initializingRecaptcha ? "Setting up..." :
               timeLeft > 0 ? `Wait ${timeLeft}s` : "Send OTP"}
            </button>
            
            {!recaptchaReady && !initializingRecaptcha && (
              <p style={{ color: 'red', fontSize: '14px', marginTop: '10px' }}>
                Security verification failed. Please refresh the page.
              </p>
            )}
          </div>
        </form>
      ) : (
        <form onSubmit={verifyOtp}>
          <div className={styles.otpSection}>
            <label className={styles.otpLabel}>Enter OTP</label>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
              We sent a 6-digit code to {phoneNumber}
            </p>
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
              disabled={loading || otp.length !== 6}
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <button 
              type="button" 
              className={styles.backButton}
              onClick={() => {
                setShowOtp(false);
                setOtp("");
              }}
              disabled={loading}
            >
              Back to Phone Number
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default OrganizationPhoneLogin; 