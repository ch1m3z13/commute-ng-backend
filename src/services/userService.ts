import { featureFlags } from '../config/featureFlags.js';
import { UserService as FirestoreUserService, userService as firestoreUserService } from './userService.firestore.js';
import { PostgresUserService } from './userService.postgres.js';

function createUserService() {
  if (featureFlags.database.provider === 'postgres') {
    return new PostgresUserService();
  }
  return new FirestoreUserService();
}

export const userService = createUserService();
export { UserService } from './userService.firestore.js';
