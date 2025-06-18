import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth, db } from "@/lib/firebase";
import { toast } from "react-toastify";
import { setDoc, doc, getDoc } from "firebase/firestore";
import GoogleSignInButton from "./GoogleButton";
import { useRouter } from 'next/navigation';
import styles from './SignInwithGoogle.module.css';

interface SignInwithGoogleProps {
  onSuccess?: () => void;
}

function SignInwithGoogle({ onSuccess }: SignInwithGoogleProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function googleLogin() {
    if (isLoading) return;
    setIsLoading(true);

    try {
      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      if (user) {
        const userRef = doc(db, "Users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          // Create new user document
          const userData = {
            uid: user.uid,
            email: user.email,
            photo: user.photoURL,
            name: user.displayName || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            providers: {
              google: true
            }
          };
          
          await setDoc(userRef, userData);
          toast.success("Account created successfully!");
          router.push('/postlogin');
        } else {
          const userData = userSnap.data();
          
          // Update providers info
          await setDoc(userRef, {
            ...userData,
            providers: {
              ...(userData.providers || {}),
              google: true
            },
            updatedAt: new Date().toISOString()
          }, { merge: true });
          
          if (!userData.username || !userData.phone) {
            toast.success("Welcome back! Please complete your profile.");
            router.push('/postlogin');
          } else {
            toast.success("Welcome back!");
            router.push('/profile');
          }
        }

        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/popup-closed-by-user') {
          toast.info("Sign-in cancelled");
        } else if (error.code === 'auth/popup-blocked') {
          toast.error("Popup was blocked. Please allow popups for this site.");
        } else if (error.code === 'auth/account-exists-with-different-credential') {
          toast.error("An account already exists with this email using a different sign-in method.");
        } else {
          toast.error("Login failed. Please try again.");
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <p className={styles.loginContinueText}>Continue with Google</p>
      <div
        style={{ 
          display: "flex", 
          justifyContent: "center", 
          cursor: isLoading ? "not-allowed" : "pointer",
          opacity: isLoading ? 0.7 : 1
        }}
      >
        <GoogleSignInButton disabled={isLoading} onClick={googleLogin} />
      </div>
    </div>
  );
}

export default SignInwithGoogle; 