import { featureFlags } from '../config/featureFlags.js';
import { CommuteService as FirestoreCommuteService, commuteService as firestoreCommuteService } from './commuteService.firestore.js';
import { PostgresCommuteService } from './commuteService.postgres.js';

function createCommuteService() {
  if (featureFlags.database.provider === 'postgres') {
    return new PostgresCommuteService();
  }
  return new FirestoreCommuteService();
}

export const commuteService = createCommuteService();
export { CommuteService } from './commuteService.firestore.js';
