export type VerificationTier = 'basic' | 'standard' | 'full';

export interface VerificationStatus {
  tier: VerificationTier;
  phoneVerified: boolean;
  ninVerified: boolean;
  idCardVerified: boolean;
  idCardStatus: 'not_submitted' | 'pending_review' | 'approved' | 'rejected';
  rejectionReason?: string;
  isVerified: boolean; // alias for idCardVerified — preserved for backward compat
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  mobileNumber?: string;
  nin?: string;
  company?: string;
  isVerified: boolean | number;
  rating: number;
  role: 'executive' | 'admin';
  photoURL?: string;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  employmentLetterUrl?: string;
  idCardUrl?: string;
  payStubUrl?: string;
  phoneVerified?: boolean | number;
  ninVerified?: boolean | number;
  idCardVerified?: boolean | number;
  rejectionReason?: string;
  carMake?: string;
  carModel?: string;
  carYear?: string;
  plateNumber?: string;
  provider?: 'google' | 'linkedin' | 'tiktok';
  providerId?: string;
  passwordHash?: string;
  homeAddress?: string;
  homeLat?: number;
  homeLng?: number;
  officeAddress?: string;
  officeLat?: number;
  officeLng?: number;
  matchingPreferences?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MatchingPreferences {
  autoAccept: boolean;
  maxPickupDetourMeters: number;
  timeFlexibilityMinutes: number;
  preferredShift: 'morning' | 'evening' | 'any';
}

export const DEFAULT_MATCHING_PREFERENCES: MatchingPreferences = {
  autoAccept: false,
  maxPickupDetourMeters: 2000,
  timeFlexibilityMinutes: 30,
  preferredShift: 'any',
};

export interface Commute {
  id?: string;
  authorUid: string;
  authorName?: string;
  authorPhoto?: string;
  startPoint: string;
  startLat?: number;
  startLng?: number;
  destination: string;
  destLat?: number;
  destLng?: number;
  departureTime: string;
  seatsAvailable: number;
  seatsRemaining?: number;
  carMake?: string;
  carModel?: string;
  carYear?: string;
  plateNumber?: string;
  type?: 'offer' | 'request';
  status?: 'active' | 'completed' | 'cancelled';
  shift?: 'morning' | 'evening';
  recurring?: boolean;
  daysOfWeek?: string[];
  pickupRadiusMeters?: number;
  timeFlexibilityMinutes?: number;
  authorRating?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Ride {
  id?: string;
  commuteId: string;
  driverUid: string;
  passengerUid: string;
  passengerName?: string;
  passengerPhoto?: string;
  authorName?: string;
  authorPhoto?: string;
  startPoint: string;
  destination: string;
  departureTime: string;
  seatsAvailable: number;
  carMake?: string;
  carModel?: string;
  carYear?: string;
  plateNumber?: string;
  status: 'auto_suggested' | 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  matchScore?: number;
  detourMeters?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MatchResult {
  commute: Commute;
  matchScore: number;
  pickupDetourMeters: number;
  dropoffDetourMeters: number;
  totalDetourMeters: number;
  timeDeltaMinutes: number;
  seatsRemaining: number;
}

export interface Notification {
  id?: string;
  type: 'ride_request' | 'request_accepted' | 'request_rejected' | 'ride_reminder' | 'match_suggested' | 'auto_accepted' | 'capacity_update' | 'ride_completed' | 'ride_cancelled';
  rideId: string;
  commuteId?: string;
  actorUid: string;
  actorName: string;
  actorPhoto?: string;
  startPoint: string;
  destination: string;
  departureTime: string;
  read: boolean | number;
  createdAt?: string;
  scheduledFor?: string;
  title?: string;
  body?: string;
}

export interface ChatMessage {
  id?: string;
  rideId?: string;
  senderUid: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  body?: string;
  createdAt?: string;
}
