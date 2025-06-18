import React, { useState } from "react";
import SignInwithGoogle from "../../GoogleSignin/SignInwithGoogle";
import UserPhoneLogin from "../../PhoneLogin/UserPhoneLogin";
import styles from "./LoginPopup.module.css";

interface LoginPopupProps {
    onClose: () => void;
}

function LoginPopup({ onClose }: LoginPopupProps) {
    const [showPhoneLogin, setShowPhoneLogin] = useState(false);

    const handlePhoneLoginClick = () => {
        setShowPhoneLogin(true);
    };

    const handleBackToOptions = () => {
        setShowPhoneLogin(false);
    };

    const handleLoginSuccess = () => {
        onClose();
    };

    return (
        <div className={styles.signinModalWrapper}>
            <div className={styles.signinModalInner}>
                <button className={styles.signinCloseBtn} onClick={onClose}>×</button>
                <h1 className={styles.signinHeading}>Welcome to Zest</h1>
                
                {!showPhoneLogin ? (
                    <>
                        <SignInwithGoogle />
                        
                        <div className={styles.signinDivider}>
                            <div className={styles.signinDividerLine}></div>
                            <span className={styles.signinDividerText}>OR</span>
                            <div className={styles.signinDividerLine}></div>
                        </div>
                        
                        <div className={styles.phoneLoginContainer}>
                            <button 
                                className={styles.phoneLoginButton}
                                onClick={handlePhoneLoginClick}
                            >
                                Continue with Phone Number
                            </button>
                            
                            <div className={styles.organizationLink}>
                                <p className={styles.organizationText}>Are you an organizer?</p>
                                <a href="/organization/login" className={styles.organizationLinkBtn}>
                                    Organization Login
                                </a>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className={styles.phoneLoginContainer}>
                        <div className={styles.phoneLoginHeader}>
                            <button 
                                className={styles.backButton}
                                onClick={handleBackToOptions}
                            >
                                ← Back
                            </button>
                            <h2 className={styles.phoneLoginTitle}>Phone Login</h2>
                        </div>
                        <UserPhoneLogin onSuccess={handleLoginSuccess} />
                    </div>
                )}
            </div>
        </div>
    );
}

export default LoginPopup; 