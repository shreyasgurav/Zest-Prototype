"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import styles from "./create.module.css";

const CreateType = () => {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const auth = getAuth();

  useEffect(() => {
    const checkAuth = () => {
      const user = auth.currentUser;
      setIsAuthorized(user?.providerData[0]?.providerId === 'phone');
    };

    checkAuth();
    const unsubscribe = onAuthStateChanged(auth, checkAuth);
    return () => unsubscribe();
  }, [auth]);

  if (!isAuthorized) {
    return (
      <div className={styles.unauthorizedMessageContainer}>
        <div className={styles.unauthorizedMessage}>
          <h1>Unauthorized Access</h1>
          <p>Only organizations can create events and guides. Please login as an organization to continue.</p>
          <button onClick={() => router.push("/")} className={styles.backButton}>
            Back to Home
          </button>
        </div>
      </div>
    );
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