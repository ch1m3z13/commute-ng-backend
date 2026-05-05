import { featureFlags } from '../config/featureFlags.js';
import { NotificationService as FirestoreNotificationService, notificationService as firestoreNotificationService } from './notificationService.firestore.js';
import { PostgresNotificationService } from './notificationService.postgres.js';

function createNotificationService() {
  if (featureFlags.database.provider === 'postgres') {
    return new PostgresNotificationService();
  }
  return new FirestoreNotificationService();
}

export const notificationService = createNotificationService();
export { NotificationService } from './notificationService.firestore.js';
