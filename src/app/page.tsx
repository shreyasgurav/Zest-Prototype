import React from 'react';
import EventsSection from '@/domains/events/components/EventsSection/EventsSection';
import ActivitySection from '@/domains/activities/components/ActivitySection/ActivitySection';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center">
      <EventsSection />
      <ActivitySection />
    </div>
  );
} 