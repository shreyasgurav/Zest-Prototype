"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { isOrganizationSession } from "../../utils/authHelpers";
import styles from "./create.module.css";

const CreateType = () => {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const checkAuth = async (user: any) => {
      if (!user) {
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      try {
        // Check if this is an organization session
        const isOrgSession = isOrganizationSession();
        
        if (isOrgSession) {
          // Check if organization profile exists
          const orgDoc = await getDoc(doc(db, "Organisations", user.uid));
          if (orgDoc.exists()) {
            console.log("✅ Organization profile found, allowing access to create page");
            setIsAuthorized(true);
          } else {
            console.log("❌ Organization session but no organization profile found");
            setIsAuthorized(false);
          }
        } else {
          // Not an organization session, check if they have organization profile anyway
          const orgDoc = await getDoc(doc(db, "Organisations", user.uid));
          if (orgDoc.exists()) {
            console.log("✅ Organization profile found, allowing access to create page");
            setIsAuthorized(true);
          } else {
            console.log("❌ Not an organization, denying access to create page");
            setIsAuthorized(false);
          }
        }
      } catch (error) {
        console.error("Error checking organization authorization:", error);
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    };

    // Check current user first
    const currentUser = auth.currentUser;
    if (currentUser) {
      checkAuth(currentUser);
    } else {
      setIsLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, checkAuth);
    return () => unsubscribe();
  }, [auth]);

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        color: 'white'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    // Redirect to organization landing page instead of showing unauthorized message
    router.push("/listevents");
    return null;
  }

  const handleTypeSelection = (type: string) => {
    switch (type) {
      case "event":
        router.push("/create/event");
        break;
      case "workshop":
        router.push("/create/guide");
        break;
      case "experience":
        router.push("/create-experience");
        break;
      case "service":
        router.push("/create/activity");
        break;
      default:
        break;
    }
  };

  return (
    <div className={styles["type-selection-page"]}>
      <div className={styles["type-selection-container"]}>
        <h1 className={styles["page-title"]}>What would you like to create?</h1>
        <div className={styles["type-grid"]}>
          <div
            className={styles["type-card"]}
            onClick={() => handleTypeSelection("event")}
          >
            <div className={styles["type-icon"]}>🎉</div>
            <h2>Event</h2>
            <p>Create a one-time or recurring event</p>
          </div>

          <div
            className={styles["type-card"]}
            onClick={() => handleTypeSelection("service")}
          >
            <div className={styles["type-icon"]}>🎮</div>
            <h2>Activities</h2>
            <p>Offer fun activities</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateType; 