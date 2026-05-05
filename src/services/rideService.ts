import { featureFlags } from '../config/featureFlags.js';
import { RideService as FirestoreRideService, rideService as firestoreRideService } from './rideService.firestore.js';
import { PostgresRideService } from './rideService.postgres.js';

function createRideService() {
  if (featureFlags.database.provider === 'postgres') {
    return new PostgresRideService();
  }
  return new FirestoreRideService();
}

export const rideService = createRideService();
export { RideService } from './rideService.firestore.js';
