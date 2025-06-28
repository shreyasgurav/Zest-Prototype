// Main library exports
// Central export point for all library functionality

// Configuration and constants
export * from './config/constants';

// Type definitions
export * from './types';

// Utilities
export * from './utils';

// Re-export commonly used items for convenience
export {
  APP_CONFIG,
  EVENT_CONFIG,
  CITIES,
  GUIDE_OPTIONS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
} from './config/constants';

export type {
  Event,
  EventSession,
  EventAttendee,
  UserData,
  ArtistData,
  OrganizationData,
  VenueData,
  AuthSession,
  ApiResponse
} from './types'; 