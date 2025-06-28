'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import VenueProfile from '@/components/VenueProfile/VenueProfile';
import RoleGuard from '@/components/RoleGuard/RoleGuard';

const VenuePage: React.FC = () => {
  const searchParams = useSearchParams();
  const pageId = searchParams?.get('page');

  return (
    <RoleGuard allowedRole="venue">
      <VenueProfile selectedPageId={pageId} />
    </RoleGuard>
  );
};

export default VenuePage; 