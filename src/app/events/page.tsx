"use client"

import React, { useState, useEffect } from "react"
import { collection, query, getDocs, orderBy, limit, where } from "firebase/firestore"
import { db } from "../../lib/firebase"
import { Music, Smile, Palette, PartyPopper, Mountain, Trophy, Calendar, MapPin, Users, Mic } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import styles from "./events.module.css"
import EventBox from "@/components/EventsSection/EventBox/EventBox"

interface Event {
  id: string
  eventTitle: string
  aboutEvent: string
  event_image: string
  eventVenue: string
  eventDateTime: string
  eventType: string
  hostingClub: string
  isEventBox: boolean
  eventRegistrationLink?: string
  organizationId: string
  title?: string
  hosting_club?: string
  event_venue?: string
  about_event?: string
  time_slots?: Array<{
    date: string
    start_time: string
    end_time: string
    available: boolean
  }>
  createdAt: any
}

const EVENT_TYPES = [
  { id: "music", label: "Music", icon: Music, color: "from-purple-500 to-pink-500" },
  { id: "comedy", label: "Comedy", icon: Smile, color: "from-yellow-500 to-orange-500" },
  { id: "art", label: "Art", icon: Palette, color: "from-blue-500 to-cyan-500" },
  { id: "clubbing", label: "Clubbing", icon: PartyPopper, color: "from-pink-500 to-red-500" },
  { id: "adventure", label: "Adventure", icon: Mountain, color: "from-green-500 to-emerald-500" },
  { id: "sports", label: "Sports", icon: Trophy, color: "from-amber-500 to-yellow-500" },
]

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedType, setSelectedType] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        if (!db) throw new Error("Firebase is not initialized")

        const eventsCollectionRef = collection(db, "events")
        const q = query(eventsCollectionRef, orderBy("createdAt", "desc"))
        const querySnapshot = await getDocs(q)
        
        const eventsData = querySnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            eventTitle: data.title || data.eventTitle || "",
            eventType: data.event_type || data.eventType || "event",
            hostingClub: data.hosting_club || data.hostingClub || "",
            eventDateTime: data.event_date_time || data.eventDateTime,
            eventVenue: data.event_venue || data.eventVenue || "",
            eventRegistrationLink: data.event_registration_link || data.eventRegistrationLink,
            aboutEvent: data.about_event || data.aboutEvent || "",
            event_image: data.event_image || "",
            organizationId: data.organizationId || "",
            time_slots: data.time_slots || [],
            createdAt: data.createdAt
          }
        }) as Event[]
        
        setEvents(eventsData)
        setError(null)
      } catch (error) {
        console.error("Error fetching events:", error)
        setError(error instanceof Error ? error.message : "Failed to fetch events")
      } finally {
        setIsLoading(false)
      }
    }

    fetchEvents()
  }, [])

  const filteredEvents = selectedType === "all" ? events : events.filter((event) => event.eventType.toLowerCase() === selectedType)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getEventTypeInfo = (eventType: string) => {
    return (
      EVENT_TYPES.find((type) => type.id === eventType.toLowerCase()) || {
        id: eventType.toLowerCase(),
        label: eventType,
        icon: Calendar,
        color: "from-gray-500 to-gray-600",
      }
    )
  }

  const getEventTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "music":
        return <Music className={styles.filterIcon} />
      case "comedy":
        return <Mic className={styles.filterIcon} />
      case "party":
      case "clubbing":
        return <PartyPopper className={styles.filterIcon} />
      case "art":
        return <Palette className={styles.filterIcon} />
      case "adventure":
        return <Mountain className={styles.filterIcon} />
      case "sports":
        return <Trophy className={styles.filterIcon} />
      default:
        return <PartyPopper className={styles.filterIcon} />
    }
  }

  const eventTypes = [
    { id: "all", label: "All Events" },
    { id: "music", label: "Music" },
    { id: "comedy", label: "Comedy" },
    { id: "clubbing", label: "Clubbing" },
    { id: "party", label: "Party" },
    { id: "art", label: "Art" },
    { id: "adventure", label: "Adventure" },
    { id: "sports", label: "Sports" }
  ]

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <div className={styles.spinnerSecondary}></div>
        </div>
        <p className={styles.loadingText}>Loading events...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.noEvents}>
        <div className={styles.noEventsIcon}>
          <MapPin className={styles.noEventsIconSvg} />
        </div>
        <h2 className={styles.noEventsTitle}>Error Loading Events</h2>
        <p className={styles.noEventsText}>{error}</p>
      </div>
    )
  }

  if (!events.length) {
    return (
      <div className={styles.noEvents}>
        <div className={styles.noEventsIcon}>
          <PartyPopper className={styles.noEventsIconSvg} />
        </div>
        <h2 className={styles.noEventsTitle}>No Events Found</h2>
        <p className={styles.noEventsText}>There are no events available at the moment. Check back later!</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <header className={styles.header}>
          <h1 className={styles.title}>All Events</h1>
          <p className={styles.subtitle}>Discover and join exciting events happening around you</p>
        </header>

        <div className={styles.filters}>
          {eventTypes.map((type) => (
            <button
              key={type.id}
              className={`${styles.filterButton} ${selectedType === type.id ? styles[`${type.id}Active`] : ""}`}
              onClick={() => setSelectedType(type.id)}
            >
              {getEventTypeIcon(type.id)}
              <span>{type.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.eventsGrid}>
          {filteredEvents.map((event) => (
            <EventBox 
              key={event.id} 
              event={event}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
