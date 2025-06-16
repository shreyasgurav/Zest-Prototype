import React, { useState } from "react";
import SignInwithGoogle from "../../GoogleSignin/SignInwithGoogle";
import Login from "../../PhoneLogin/Login";
import styles from "./LoginPopup.module.css";

interface LoginPopupProps {
    onClose: () => void;
}

function LoginPopup({ onClose }: LoginPopupProps) {
    const [showPhoneLogin, setShowPhoneLogin] = useState(false);

    // Show phone login directly when clicking organiser button
    const handleOrgClick = () => {
        setShowPhoneLogin(true);
    };

    // Simplified render content function
    const renderContent = () => {
        if (showPhoneLogin) {
            return (
                <div className={styles.phoneLoginContainer}>
                    <Login />
                </div>
            );
        }
        
        return (
            <div className={styles.orgQuestionContainer}>
                <p className={styles.orgQuestionText}>Organiser?</p>
                <button 
                    className={styles.continueOrgBtn}
                    onClick={handleOrgClick}
                >
                    Continue as Organiser
                </button>
            </div>
        );
    };

    return (
        <div className={styles.signinModalWrapper}>
            <div className={styles.signinModalInner}>
                <button className={styles.signinCloseBtn} onClick={onClose}>×</button>
                <h1 className={styles.signinHeading}>Welcome to Zest</h1>
                
                {!showPhoneLogin && <SignInwithGoogle />}
                
                <div className={styles.signinDivider}>
                    <div className={styles.signinDividerLine}></div>
                </div>
                
                {renderContent()}
            </div>
        </div>
    );
}

export default LoginPopup; 