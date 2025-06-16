'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getAuth } from "firebase/auth";
import styles from "./EditEvent.module.css";

interface EventSlot {
  date: string;
  startTime: string;
  endTime: string;
}

interface Ticket {
  name: string;
  capacity: string;
  price: string;
}

const EditEvent = () => {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = params?.id;
  const auth = getAuth();

  const [eventTitle, setEventTitle] = useState<string>("");
  const [eventVenue, setEventVenue] = useState<string>("");
  const [aboutEvent, setAboutEvent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("");
  const [orgUsername, setOrgUsername] = useState<string>("");
  const [eventImage, setEventImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [eventCategory, setEventCategory] = useState<string>("");
  const [eventLanguages, setEventLanguages] = useState<string>("");
  const [eventDuration, setEventDuration] = useState<string>("");
  const [eventAgeLimit, setEventAgeLimit] = useState<string>("");
  const [eventSlots, setEventSlots] = useState<EventSlot[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  useEffect(() => {
    if (!eventId || !auth.currentUser) {
      router.push('/');
      return;
    }

    fetchEventData();
  }, [eventId, auth.currentUser]);

  const fetchEventData = async () => {
    if (!eventId || !auth.currentUser) return;

    try {
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      
      if (!eventDoc.exists()) {
        setMessage("Event not found");
        return;
      }

      const eventData = eventDoc.data();
      
      // Check authorization
      if (eventData.organizationId !== auth.currentUser.uid) {
        setMessage("You are not authorized to edit this event");
        return;
      }

      setIsAuthorized(true);

      // Set form data
      setEventTitle(eventData.title || eventData.eventTitle || "");
      setEventVenue(eventData.event_venue || "");
      setAboutEvent(eventData.about_event || "");
      setEventCategory(eventData.event_category || "");
      setEventLanguages(eventData.event_languages || "");
      setEventDuration(eventData.event_duration || "");
      setEventAgeLimit(eventData.event_age_limit || "");
      setOrgName(eventData.hosting_club || "");
      setOrgUsername(eventData.organization_username || "");
      
      if (eventData.event_image) {
        setCurrentImageUrl(eventData.event_image);
        setImagePreview(eventData.event_image);
      }

      // Set time slots
      if (eventData.time_slots) {
        setEventSlots(eventData.time_slots.map((slot: any) => ({
          date: slot.date,
          startTime: slot.start_time,
          endTime: slot.end_time
        })));
      }

      // Set tickets
      if (eventData.tickets) {
        setTickets(eventData.tickets.map((ticket: any) => ({
          name: ticket.name,
          capacity: ticket.capacity.toString(),
          price: ticket.price.toString()
        })));
      }

    } catch (err) {
      console.error("Error fetching event data:", err);
      setMessage("Failed to load event data");
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5242880) {
        setMessage("Image size should be less than 5MB");
        return;
      }
      setEventImage(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  // Ticket management functions
  const addTicketType = () => {
    setTickets([...tickets, { name: '', capacity: '', price: '' }]);
  };

  const removeTicketType = (index: number) => {
    const newTickets = tickets.filter((_, i) => i !== index);
    setTickets(newTickets);
  };

  const handleTicketChange = (index: number, field: keyof Ticket, value: string) => {
    const newTickets = [...tickets];
    newTickets[index][field] = value;
    setTickets(newTickets);
  };

  const validateTickets = (): boolean => {
    return tickets.every(ticket => 
      ticket.name && 
      ticket.capacity && 
      ticket.price && 
      parseInt(ticket.capacity) > 0 && 
      parseFloat(ticket.price) >= 0
    );
  };

  // Time slot functions
  const addTimeSlot = () => {
    setEventSlots([...eventSlots, { date: '', startTime: '', endTime: '' }]);
  };

  const removeTimeSlot = (index: number) => {
    const newSlots = eventSlots.filter((_, i) => i !== index);
    setEventSlots(newSlots);
  };

  const handleSlotChange = (index: number, field: keyof EventSlot, value: string) => {
    const newSlots = [...eventSlots];
    newSlots[index][field] = value;
    setEventSlots(newSlots);
  };

  const validateSlots = (): boolean => {
    return eventSlots.every(slot => 
      slot.date && slot.startTime && slot.endTime && 
      new Date(`${slot.date} ${slot.endTime}`) > new Date(`${slot.date} ${slot.startTime}`)
    );
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!file) return null;
    
    try {
      // Delete old image if exists
      if (currentImageUrl) {
        try {
          const oldImageRef = ref(storage, currentImageUrl);
          await deleteObject(oldImageRef);
        } catch (err) {
          console.error("Error deleting old image:", err);
        }
      }

      // Create a unique filename
      const fileExtension = file.name.split('.').pop();
      const fileName = `events/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const storageRef = ref(storage, fileName);

      // Set metadata
      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedBy: auth.currentUser?.uid || 'unknown',
          uploadTime: new Date().toISOString()
        }
      };

      // Upload new image
      const uploadResult = await uploadBytes(storageRef, file, metadata);
      const downloadURL = await getDownloadURL(uploadResult.ref);
      
      return downloadURL;
    } catch (error: any) {
      console.error('Error in uploadImage:', error);
      throw new Error(`Image upload failed: ${error.message}`);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!auth.currentUser || !eventId) {
      setMessage("Please sign in to edit the event");
      return;
    }

    if (!eventTitle.trim() || !eventVenue.trim() || !validateSlots() || !validateTickets()) {
      setMessage("Please fill in all required fields and ensure valid time slots and tickets");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      let imageUrl: string | null = currentImageUrl;
      let imageUploadError = false;
      let imageUploadErrorMessage = '';

      // Upload new image if one is selected
      if (eventImage) {
        try {
          imageUrl = await uploadImage(eventImage);
        } catch (uploadError: any) {
          console.error('Image upload failed:', uploadError);
          imageUploadError = true;
          imageUploadErrorMessage = uploadError.message;
        }
      }

      // Check if any attendees exist for the event
      const attendeesRef = collection(db, 'eventAttendees');
      const attendeesQuery = query(attendeesRef, where('eventId', '==', eventId));
      const attendeesSnapshot = await getDocs(attendeesQuery);
      const hasAttendees = !attendeesSnapshot.empty;

      // Prepare event data
      const eventData = {
        title: eventTitle.trim(),
        time_slots: eventSlots.map(slot => ({
          date: slot.date,
          start_time: slot.startTime,
          end_time: slot.endTime,
          available: true
        })),
        tickets: tickets.map(ticket => ({
          name: ticket.name.trim(),
          capacity: parseInt(ticket.capacity),
          price: parseFloat(ticket.price),
          // If there are attendees, maintain the current available capacity
          available_capacity: hasAttendees ? 
            (() => {
              const existingTicket = attendeesSnapshot.docs
                .flatMap(doc => Object.entries(doc.data().tickets || {}))
                .find(([name]) => name === ticket.name) as [string, number] | undefined;
              return existingTicket ? 
                parseInt(ticket.capacity) - existingTicket[1] : 
                parseInt(ticket.capacity);
            })() : 
            parseInt(ticket.capacity)
        })),
        event_venue: eventVenue.trim(),
        about_event: aboutEvent.trim(),
        event_image: imageUrl,
        event_category: eventCategory.trim(),
        event_languages: eventLanguages.trim(),
        event_duration: eventDuration.trim(),
        event_age_limit: eventAgeLimit.trim(),
        updatedAt: serverTimestamp(),
        image_upload_status: imageUploadError ? 'failed' : (imageUrl ? 'success' : 'none')
      };

      // Update event document
      await updateDoc(doc(db, 'events', eventId), eventData);
      
      if (imageUploadError) {
        setMessage(`Event updated successfully! Note: ${imageUploadErrorMessage} You can try uploading the image again later.`);
      } else {
        setMessage("Event updated successfully!");
      }

      // Redirect after a short delay
      setTimeout(() => {
        router.push(`/event-dashboard/${eventId}`);
        router.refresh();
      }, 2000);

    } catch (error: any) {
      console.error("Error updating event:", error);
      setMessage(`Failed to update event: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.editEventPage}>
        <div className={styles.editEventContainer}>
          <div className={styles.loadingState}>Loading event data...</div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className={styles.editEventPage}>
        <div className={styles.editEventContainer}>
          <div className={styles.unauthorizedMessage}>
            <h1>Unauthorized</h1>
            <p>{message || "You are not authorized to edit this event."}</p>
            <button 
              className={styles.backButton}
              onClick={() => router.push('/')}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.editEventPage}>
      <div className={styles.editEventContainer}>
        <h1 className={styles.pageTitle}>Edit Event</h1>
        <form onSubmit={handleSubmit} className={styles.editEventForm}>
          {/* Image Upload Section */}
          <div className={styles.formSection}>
            <h2>Event Image</h2>
            <p className={styles.imageTip}>Please upload a square image for best results (max 5MB)</p>
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

          {/* Event Details */}
          <div className={styles.formSection}>
            <h2>Event Details</h2>
            <div className={styles.formGroup}>
              <label>Event Name</label>
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Enter event name"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Event Category</label>
              <input
                type="text"
                value={eventCategory}
                onChange={(e) => setEventCategory(e.target.value)}
                placeholder="e.g., Music, Comedy, Tech"
                required
              />
            </div>
          </div>

          {/* Tickets Section */}
          <div className={styles.formSection}>
            <h2>Edit Tickets</h2>
            {tickets.map((ticket, index) => (
              <div key={index} className={styles.ticketSlot}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Ticket Name</label>
                    <input
                      type="text"
                      value={ticket.name}
                      onChange={(e) => handleTicketChange(index, 'name', e.target.value)}
                      placeholder="e.g., General, VIP, Fan Pit"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Capacity</label>
                    <input
                      type="number"
                      value={ticket.capacity}
                      onChange={(e) => handleTicketChange(index, 'capacity', e.target.value)}
                      placeholder="Number of tickets"
                      min="1"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Price (₹)</label>
                    <input
                      type="number"
                      value={ticket.price}
                      onChange={(e) => handleTicketChange(index, 'price', e.target.value)}
                      placeholder="Ticket price"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  {tickets.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeDateButton}
                      onClick={() => removeTicketType(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              className={styles.addDateButton}
              onClick={addTicketType}
            >
              Add Another Ticket Type
            </button>
          </div>

          {/* Time Slots Section */}
          <div className={styles.formSection}>
            <h2>Event Schedule</h2>
            {eventSlots.map((slot, index) => (
              <div key={index} className={styles.dateSlot}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Date</label>
                    <input
                      type="date"
                      value={slot.date}
                      onChange={(e) => handleSlotChange(index, 'date', e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Start Time</label>
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => handleSlotChange(index, 'startTime', e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>End Time</label>
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) => handleSlotChange(index, 'endTime', e.target.value)}
                      required
                    />
                  </div>
                  {eventSlots.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeDateButton}
                      onClick={() => removeTimeSlot(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              className={styles.addDateButton}
              onClick={addTimeSlot}
            >
              Add Another Time Slot
            </button>
          </div>

          {/* Location */}
          <div className={styles.formSection}>
            <h2>Location</h2>
            <div className={styles.formGroup}>
              <label>Venue</label>
              <input
                type="text"
                value={eventVenue}
                onChange={(e) => setEventVenue(e.target.value)}
                placeholder="Enter event venue"
                required
              />
            </div>
          </div>

          {/* About Event */}
          <div className={styles.formSection}>
            <h2>About Event</h2>
            <div className={styles.formGroup}>
              <textarea
                value={aboutEvent}
                onChange={(e) => setAboutEvent(e.target.value)}
                placeholder="Enter event description"
                rows={4}
                required
              />
            </div>
          </div>

          {/* Event Guide */}
          <div className={styles.formSection}>
            <h2>Event Guide</h2>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Duration</label>
                <input
                  type="text"
                  value={eventDuration}
                  onChange={(e) => setEventDuration(e.target.value)}
                  placeholder="e.g., 2 Hours"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Age Requirement</label>
                <input
                  type="text"
                  value={eventAgeLimit}
                  onChange={(e) => setEventAgeLimit(e.target.value)}
                  placeholder="e.g., 16+ years"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Event Languages</label>
                <input
                  type="text"
                  value={eventLanguages}
                  onChange={(e) => setEventLanguages(e.target.value)}
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
            <button type="submit" className={styles.submitButton} disabled={saving}>
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
            <button 
              type="button" 
              className={styles.cancelButton} 
              onClick={() => router.push(`/event-dashboard/${eventId}`)}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEvent; 