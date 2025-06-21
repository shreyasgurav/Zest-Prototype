import React, { useState, useEffect, useRef } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { toast } from "react-toastify";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { handleAuthenticationFlow } from '../../../utils/authHelpers';
import styles from "./LoginPopup.module.css";

// Extend Window interface for reCAPTCHA
declare global {
    interface Window {
        loginPopupRecaptchaVerifier: RecaptchaVerifier | null;
        loginPopupConfirmationResult: ConfirmationResult | null;
    }
}

interface LoginPopupProps {
    onClose: () => void;
}

function LoginPopup({ onClose }: LoginPopupProps) {
    const [currentStep, setCurrentStep] = useState<'input' | 'verification'>('input');
    const [phoneNumber, setPhoneNumber] = useState<string>("");
    const [otp, setOtp] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [recaptchaReady, setRecaptchaReady] = useState<boolean>(false);
    const [isInitializingRecaptcha, setIsInitializingRecaptcha] = useState<boolean>(false);

    // Timer countdown
    useEffect(() => {
        if (timeLeft > 0) {
            const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timerId);
        }
    }, [timeLeft]);

    // Initialize reCAPTCHA
    useEffect(() => {
        if (!window.loginPopupRecaptchaVerifier) {
            initializeRecaptcha();
        }
        return () => {
            cleanupRecaptcha();
        };
    }, []);

    const cleanupRecaptcha = () => {
        if (window.loginPopupRecaptchaVerifier) {
            try {
                window.loginPopupRecaptchaVerifier.clear();
            } catch (error) {
                console.log("Error clearing popup reCAPTCHA:", error);
            }
            window.loginPopupRecaptchaVerifier = null;
        }
    };

    const initializeRecaptcha = async () => {
        try {
            setIsInitializingRecaptcha(true);
            
            // Clean up any existing reCAPTCHA
            cleanupRecaptcha();
            
            // Wait for DOM to be ready
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (!document.getElementById('popup-recaptcha-container')) {
                console.error("Popup reCAPTCHA container not found");
                return;
            }

            window.loginPopupRecaptchaVerifier = new RecaptchaVerifier(
                auth,
                'popup-recaptcha-container',
                {
                    size: 'invisible',
                    callback: () => {
                        console.log("Popup reCAPTCHA verified");
                        setRecaptchaReady(true);
                        setIsInitializingRecaptcha(false);
                    },
                    'expired-callback': () => {
                        console.log("Popup reCAPTCHA expired");
                        setRecaptchaReady(false);
                        toast.error("Verification expired. Please try again.");
                    },
                    'error-callback': (error: any) => {
                        console.error("Popup reCAPTCHA error:", error);
                        setRecaptchaReady(false);
                        setIsInitializingRecaptcha(false);
                        toast.error("Verification error. Please try again.");
                    }
                }
            );

            await window.loginPopupRecaptchaVerifier.render();
            setIsInitializingRecaptcha(false);
            setRecaptchaReady(true);
        } catch (error) {
            console.error("Popup reCAPTCHA initialization error:", error);
            setIsInitializingRecaptcha(false);
            setRecaptchaReady(false);
            toast.error("Unable to initialize phone verification. Please try again.");
        }
    };

    const handlePhoneContinue = async () => {
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
            
            // Ensure reCAPTCHA is initialized
            if (!window.loginPopupRecaptchaVerifier) {
                console.log("Initializing popup reCAPTCHA...");
                await initializeRecaptcha();
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            if (!window.loginPopupRecaptchaVerifier) {
                throw new Error("reCAPTCHA initialization failed");
            }

            const confirmationResult = await signInWithPhoneNumber(
                auth,
                formattedPhone,
                window.loginPopupRecaptchaVerifier
            );

            window.loginPopupConfirmationResult = confirmationResult;
            setCurrentStep('verification');
            setTimeLeft(30);
            toast.success("OTP sent successfully!");
        } catch (error: any) {
            console.error("Error sending OTP:", error);
            
            if (error.code === 'auth/too-many-requests') {
                toast.error("Too many attempts. Please try again later.");
                setTimeLeft(60);
            } else if (error.code === 'auth/invalid-phone-number') {
                toast.error("Please enter a valid phone number.");
            } else if (error.code === 'auth/captcha-check-failed') {
                toast.error("Verification failed. Please try again.");
                cleanupRecaptcha();
                await initializeRecaptcha();
            } else {
                toast.error("Error sending OTP. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOtpVerification = async () => {
        if (!otp || otp.length !== 6) {
            toast.error("Please enter a valid 6-digit OTP");
            return;
        }

        if (!window.loginPopupConfirmationResult) {
            toast.error("Session expired. Please request a new OTP.");
            setCurrentStep('input');
            return;
        }

        setLoading(true);
        try {
            const result = await window.loginPopupConfirmationResult.confirm(otp);
            
            if (result.user) {
                await handleSuccessfulAuth(result.user, 'phone');
            }
        } catch (error: any) {
            console.error("Error verifying OTP:", error);
            if (error.code === 'auth/invalid-verification-code') {
                toast.error("Invalid OTP. Please check and try again.");
            } else if (error.code === 'auth/code-expired') {
                toast.error("OTP has expired. Please request a new one.");
                setCurrentStep('input');
            } else {
                toast.error("Invalid OTP. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSuccessfulAuth = async (user: any, provider: 'phone') => {
        try {
            const additionalData = { phone: phoneNumber };
            
            const { userData, navigationPath } = await handleAuthenticationFlow(user, provider, additionalData);
            
            if (userData.username && userData.phone) {
                toast.success("Welcome back!");
            } else if (userData.providers && Object.keys(userData.providers).length > 1) {
                toast.success("Account linked successfully!");
            } else {
                toast.success("Account created successfully!");
            }
            
            onClose();
        } catch (error) {
            console.error("Error handling successful auth:", error);
            toast.error("Error completing login. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleBackToInput = () => {
        setCurrentStep('input');
        setOtp('');
    };

    return (
        <div className={styles.signinModalWrapper}>
            <div className={styles.signinModalInner}>
                <button className={styles.signinCloseBtn} onClick={onClose}>×</button>
                
                {currentStep === 'input' ? (
                    <>
                        <h1 className={styles.signinHeading}>Welcome to Zest</h1>
                        <p className={styles.signinSubtext}>Sign in to discover amazing events and activities</p>
                        
                        <div className={styles.phoneLoginContainer}>
                            <div className={styles.inputGroup}>
                                <label className={styles.phoneLabel}>Phone Number</label>
                                <PhoneInput
                                    international
                                    defaultCountry="IN"
                                    value={phoneNumber}
                                    onChange={(value) => setPhoneNumber(value || "")}
                                    className={styles.phoneNumberInput}
                                    disabled={loading}
                                />
                            </div>

                            {/* Hidden reCAPTCHA Container */}
                            <div id="popup-recaptcha-container" style={{ display: 'none' }}></div>

                            <button 
                                className={styles.sendOtpButton}
                                onClick={handlePhoneContinue}
                                disabled={loading || timeLeft > 0 || isInitializingRecaptcha}
                            >
                                {loading ? "Sending..." : 
                                 isInitializingRecaptcha ? "Initializing..." :
                                 timeLeft > 0 ? `Wait ${timeLeft}s` : 
                                 "Send OTP"}
                            </button>
                        </div>
                        
                        <div className={styles.organizationLink}>
                            <p className={styles.organizationText}>Are you an organizer?</p>
                            <a href="/login/organisation" className={styles.organizationLinkBtn}>
                                Organization Login
                            </a>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={styles.verificationHeader}>
                            <button 
                                className={styles.backButton}
                                onClick={handleBackToInput}
                            >
                                ← Back
                            </button>
                            <h1 className={styles.signinHeading}>Enter Verification Code</h1>
                        </div>
                        
                        <p className={styles.verificationText}>
                            We've sent a 6-digit code to <strong>{phoneNumber}</strong>
                        </p>
                        
                        <div className={styles.otpContainer}>
                            <input
                                type="text"
                                className={styles.otpInput}
                                placeholder="Enter 6-digit code"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                maxLength={6}
                                disabled={loading}
                            />
                            <button 
                                className={styles.verifyOtpButton}
                                onClick={handleOtpVerification}
                                disabled={loading || otp.length !== 6}
                            >
                                {loading ? "Verifying..." : "Verify Code"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default LoginPopup; 