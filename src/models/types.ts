export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  mobileNumber?: string;
  nin?: string;
  company?: string;
  isVerified: boolean;
  rating: number;
  role: 'executive' | 'admin';
  photoURL?: string;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  employmentLetterUrl?: string;
  idCardUrl?: string;
  payStubUrl?: string;
  carMake?: string;
  carModel?: string;
  carYear?: string;
  plateNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Commute {
  id?: string;
  authorUid: string;
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
  type?: 'offer' | 'request';
  status?: 'active' | 'completed' | 'cancelled';
  shift?: 'morning' | 'evening';
  recurring?: boolean;
  daysOfWeek?: string[];
  requests?: string[];
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
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  createdAt?: string;
  updatedAt?: string;
}

export interface Notification {
  id?: string;
  type: 'ride_request' | 'request_accepted' | 'request_rejected' | 'ride_reminder';
  rideId: string;
  commuteId?: string;
  actorUid: string;
  actorName: string;
  actorPhoto?: string;
  startPoint: string;
  destination: string;
  departureTime: string;
  read: boolean;
  createdAt?: string;
  scheduledFor?: string;
}

export interface ChatMessage {
  id?: string;
  senderUid: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  createdAt?: string;
}
