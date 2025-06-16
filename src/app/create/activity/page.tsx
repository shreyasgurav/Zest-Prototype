'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import styles from "./CreateActivity.module.css";

interface TimeSlot {
  startTime: string;
  endTime: string;
  capacity: number;
}

interface DaySchedule {
  day: string;
  isOpen: boolean;
  timeSlots: TimeSlot[];
}

const CreateActivity = () => {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [activityName, setActivityName] = useState<string>("");
  const [activityLocation, setActivityLocation] = useState<string>("");
  const [aboutActivity, setAboutActivity] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("");
  const [activityImage, setActivityImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [activityCategory, setActivityCategory] = useState<string>("");
  const [activityLanguages, setActivityLanguages] = useState<string>("");
  const [activityDuration, setActivityDuration] = useState<string>("");
  const [activityAgeLimit, setActivityAgeLimit] = useState<string>("");
  const [pricePerSlot, setPricePerSlot] = useState<string>("");
  
  // Weekly schedule - default to all days open with one time slot
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>([
    { day: 'Monday', isOpen: true, timeSlots: [{ startTime: '09:00', endTime: '10:00', capacity: 10 }] },
    { day: 'Tuesday', isOpen: true, timeSlots: [{ startTime: '09:00', endTime: '10:00', capacity: 10 }] },
    { day: 'Wednesday', isOpen: true, timeSlots: [{ startTime: '09:00', endTime: '10:00', capacity: 10 }] },
    { day: 'Thursday', isOpen: true, timeSlots: [{ startTime: '09:00', endTime: '10:00', capacity: 10 }] },
    { day: 'Friday', isOpen: true, timeSlots: [{ startTime: '09:00', endTime: '10:00', capacity: 10 }] },
    { day: 'Saturday', isOpen: true, timeSlots: [{ startTime: '09:00', endTime: '10:00', capacity: 10 }] },
    { day: 'Sunday', isOpen: false, timeSlots: [] }
  ]);

  // Specific closed dates
  const [closedDates, setClosedDates] = useState<string[]>([]);
  const [newClosedDate, setNewClosedDate] = useState<string>("");
  
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

  useEffect(() => {
    const storedOrgName = localStorage.getItem('orgName');
    if (storedOrgName) {
      setOrgName(storedOrgName);
    }
  }, []);

  if (!isAuthorized) {
    return (
      <div className={styles.unauthorizedMessageContainer}>
        <div className={styles.unauthorizedMessage}>
          <h1>Unauthorized Access</h1>
          <p>Only organizations can create activities. Please login as an organization to continue.</p>
          <button onClick={() => router.push("/")} className={styles.backButton}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5242880) {
        setMessage("Image size should be less than 5MB");
        return;
      }
      setActivityImage(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  // Day schedule management
  const toggleDayOpen = (dayIndex: number) => {
    const updatedSchedule = [...weeklySchedule];
    updatedSchedule[dayIndex].isOpen = !updatedSchedule[dayIndex].isOpen;
    if (!updatedSchedule[dayIndex].isOpen) {
      updatedSchedule[dayIndex].timeSlots = [];
    } else if (updatedSchedule[dayIndex].timeSlots.length === 0) {
      updatedSchedule[dayIndex].timeSlots = [{ startTime: '09:00', endTime: '10:00', capacity: 10 }];
    }
    setWeeklySchedule(updatedSchedule);
  };

  const addTimeSlot = (dayIndex: number) => {
    const updatedSchedule = [...weeklySchedule];
    updatedSchedule[dayIndex].timeSlots.push({ startTime: '09:00', endTime: '10:00', capacity: 10 });
    setWeeklySchedule(updatedSchedule);
  };

  const removeTimeSlot = (dayIndex: number, slotIndex: number) => {
    const updatedSchedule = [...weeklySchedule];
    updatedSchedule[dayIndex].timeSlots.splice(slotIndex, 1);
    setWeeklySchedule(updatedSchedule);
  };

  const updateTimeSlot = (dayIndex: number, slotIndex: number, field: keyof TimeSlot, value: string | number) => {
    const updatedSchedule = [...weeklySchedule];
    (updatedSchedule[dayIndex].timeSlots[slotIndex] as any)[field] = value;
    setWeeklySchedule(updatedSchedule);
  };

  // Closed dates management
  const addClosedDate = () => {
    if (newClosedDate && !closedDates.includes(newClosedDate)) {
      setClosedDates([...closedDates, newClosedDate]);
      setNewClosedDate("");
    }
  };

  const removeClosedDate = (date: string) => {
    setClosedDates(closedDates.filter(d => d !== date));
  };

  const validateSchedule = (): boolean => {
    const openDays = weeklySchedule.filter(day => day.isOpen);
    if (openDays.length === 0) {
      setMessage("At least one day must be open");
      return false;
    }

    for (const day of openDays) {
      if (day.timeSlots.length === 0) {
        setMessage(`${day.day} is marked as open but has no time slots`);
        return false;
      }
      
      for (const slot of day.timeSlots) {
        if (!slot.startTime || !slot.endTime || slot.capacity <= 0) {
          setMessage(`Invalid time slot on ${day.day}`);
          return false;
        }
        
        const startTime = new Date(`2000-01-01 ${slot.startTime}`);
        const endTime = new Date(`2000-01-01 ${slot.endTime}`);
        if (endTime <= startTime) {
          setMessage(`End time must be after start time on ${day.day}`);
          return false;
        }
      }
    }
    return true;
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!file) return null;
    const fileExtension = file.name.split('.').pop();
    const fileName = `activities/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log("Form submitted");
    
    if (!activityName.trim() || !activityLocation.trim() || !activityCategory.trim() || !pricePerSlot.trim()) {
      setMessage("Please fill in all required fields");
      return;
    }

    if (!validateSchedule()) {
      return;
    }

    if (parseFloat(pricePerSlot) < 0) {
      setMessage("Price must be non-negative");
      return;
    }

    console.log("Validation passed, starting creation");
    setLoading(true);
    setMessage("");

    try {
      console.log("Starting upload process");
      let imageUrl: string | null = null;
      if (activityImage) {
        try {
          console.log("Uploading image...");
          imageUrl = await uploadImage(activityImage);
          console.log("Image uploaded:", imageUrl);
        } catch (uploadError) {
          console.warn("Image upload failed, continuing without image:", uploadError);
          setMessage("Note: Image upload failed, activity created without image");
          // Continue without image
        }
      }

      console.log("Creating activity data");
      const activityData = {
        name: activityName.trim(),
        activity_type: "activity",
        weekly_schedule: weeklySchedule.map(day => ({
          day: day.day,
          is_open: day.isOpen,
          time_slots: day.timeSlots.map(slot => ({
            start_time: slot.startTime,
            end_time: slot.endTime,
            capacity: slot.capacity,
            available_capacity: slot.capacity
          }))
        })),
        closed_dates: closedDates,
        price_per_slot: parseFloat(pricePerSlot),
        location: activityLocation.trim(),
        about_activity: aboutActivity.trim(),
        activity_image: imageUrl,
        organizationId: auth.currentUser?.uid,
        hosting_organization: orgName,
        activity_category: activityCategory.trim(),
        activity_languages: activityLanguages.trim(),
        activity_duration: activityDuration.trim(),
        activity_age_limit: activityAgeLimit.trim(),
        createdAt: new Date().toISOString(),
      };

      console.log("Activity data prepared:", activityData);
      const activitiesCollectionRef = collection(db, "activities");
      console.log("Adding document to Firestore...");
      await addDoc(activitiesCollectionRef, activityData);
      console.log("Activity created successfully in Firestore");
      
      setMessage("Activity created successfully!");
      setTimeout(() => router.push('/'), 2000);
    } catch (error: any) {
      console.error("Error creating activity:", error);
      setMessage(`Failed to create activity: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.createActivityPage}>
      <div className={styles.createActivityContainer}>
        <h1 className={styles.pageTitle}>Create Activity</h1>
        <form onSubmit={handleSubmit} className={styles.createActivityForm}>
          {/* Image Upload Section */}
          <div className={styles.formSection}>
            <h2>Activity Image (Optional)</h2>
            <p className={styles.imageTip}>Please upload a square image for best results (max 5MB). You can skip this if experiencing upload issues.</p>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className={styles.fileInput}
            />
            {imagePreview && (
              <div className={styles.imagePreview}>
                <img src={imagePreview} alt="Preview" />
              </div>
            )}
          </div>

          {/* Activity Details */}
          <div className={styles.formSection}>
            <h2>Activity Details</h2>
            <div className={styles.formGroup}>
              <label>Activity Name</label>
              <input
                type="text"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder="Enter activity name"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Activity Category</label>
              <input
                type="text"
                value={activityCategory}
                onChange={(e) => setActivityCategory(e.target.value)}
                placeholder="e.g., Fitness, Art, Music, Sports"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Price per Slot (₹)</label>
              <input
                type="number"
                value={pricePerSlot}
                onChange={(e) => setPricePerSlot(e.target.value)}
                placeholder="Price per slot"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          {/* Closed Dates Section */}
          <div className={styles.formSection}>
            <h2>Closed Dates (Optional)</h2>
            <p className={styles.sectionDescription}>Add specific dates when your activity will be closed</p>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Add Closed Date</label>
                <input
                  type="date"
                  value={newClosedDate}
                  onChange={(e) => setNewClosedDate(e.target.value)}
                />
              </div>
              <button
                type="button"
                className={styles.addDateButton}
                onClick={addClosedDate}
                disabled={!newClosedDate}
              >
                Add Date
              </button>
            </div>
            {closedDates.length > 0 && (
              <div className={styles.closedDatesList}>
                {closedDates.map((date, index) => (
                  <div key={index} className={styles.closedDateItem}>
                    <span>{date}</span>
                    <button
                      type="button"
                      className={styles.removeDateButton}
                      onClick={() => removeClosedDate(date)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weekly Schedule Section */}
          <div className={styles.formSection}>
            <h2>Weekly Schedule</h2>
            <p className={styles.sectionDescription}>Set your weekly availability and time slots</p>
            {weeklySchedule.map((daySchedule, dayIndex) => (
              <div key={daySchedule.day} className={styles.daySchedule}>
                <div className={styles.dayHeader}>
                  <h3>{daySchedule.day}</h3>
                  <label className={styles.toggleSwitch}>
                    <input
                      type="checkbox"
                      checked={daySchedule.isOpen}
                      onChange={() => toggleDayOpen(dayIndex)}
                    />
                    <span className={styles.slider}></span>
                    <span className={styles.toggleLabel}>
                      {daySchedule.isOpen ? 'Open' : 'Closed'}
                    </span>
                  </label>
                </div>
                
                {daySchedule.isOpen && (
                  <div className={styles.timeSlotsContainer}>
                    {daySchedule.timeSlots.map((slot, slotIndex) => (
                      <div key={slotIndex} className={styles.timeSlot}>
                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label>Start Time</label>
                            <input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) => updateTimeSlot(dayIndex, slotIndex, 'startTime', e.target.value)}
                              required
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label>End Time</label>
                            <input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) => updateTimeSlot(dayIndex, slotIndex, 'endTime', e.target.value)}
                              required
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label>Capacity</label>
                            <input
                              type="number"
                              value={slot.capacity}
                              onChange={(e) => updateTimeSlot(dayIndex, slotIndex, 'capacity', parseInt(e.target.value))}
                              min="1"
                              required
                            />
                          </div>
                          {daySchedule.timeSlots.length > 1 && (
                            <button
                              type="button"
                              className={styles.removeSlotButton}
                              onClick={() => removeTimeSlot(dayIndex, slotIndex)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={styles.addSlotButton}
                      onClick={() => addTimeSlot(dayIndex)}
                    >
                      Add Time Slot
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Location */}
          <div className={styles.formSection}>
            <h2>Location</h2>
            <div className={styles.formGroup}>
              <label>Location</label>
              <input
                type="text"
                value={activityLocation}
                onChange={(e) => setActivityLocation(e.target.value)}
                placeholder="Enter activity location"
                required
              />
            </div>
          </div>

          {/* About Activity */}
          <div className={styles.formSection}>
            <h2>About Activity</h2>
            <div className={styles.formGroup}>
              <textarea
                value={aboutActivity}
                onChange={(e) => setAboutActivity(e.target.value)}
                placeholder="Enter activity description"
                rows={4}
                required
              />
            </div>
          </div>

          {/* Activity Guide */}
          <div className={styles.formSection}>
            <h2>Activity Guide</h2>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Duration per Slot</label>
                <input
                  type="text"
                  value={activityDuration}
                  onChange={(e) => setActivityDuration(e.target.value)}
                  placeholder="e.g., 1 Hour"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Age Requirement</label>
                <input
                  type="text"
                  value={activityAgeLimit}
                  onChange={(e) => setActivityAgeLimit(e.target.value)}
                  placeholder="e.g., 16+ years"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Languages</label>
                <input
                  type="text"
                  value={activityLanguages}
                  onChange={(e) => setActivityLanguages(e.target.value)}
                  placeholder="e.g., English, Hindi"
                  required
                />
              </div>
            </div>
          </div>

          {message && (
            <div className={`${styles.message} ${message.includes("success") ? styles.success : styles.error}`}>
              {message}
            </div>
          )}

          <div className={styles.formActions}>
            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? "Creating Activity..." : "Create Activity"}
            </button>
            <button 
              type="button" 
              className={styles.cancelButton} 
              onClick={() => router.push('/')}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateActivity; 