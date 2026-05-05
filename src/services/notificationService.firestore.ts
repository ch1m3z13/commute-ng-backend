import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { Notification } from '../models/types.js';

let db: Firestore;

function getDb(): Firestore {
  if (!db) {
    db = getFirestore();
  }
  return db;
}

function toNotification(id: string, data: Record<string, unknown>): Notification {
  return { id, ...data } as Notification;
}

export class NotificationService {
  async getNotifications(userId: string): Promise<Notification[]> {
    const snapshot = await getDb().collection('users').doc(userId).collection('notifications').get();
    return snapshot.docs.map((d) => toNotification(d.id, d.data() as Record<string, unknown>));
  }

  async getUnreadCount(userId: string): Promise<number> {
    const snapshot = await getDb().collection('users').doc(userId).collection('notifications')
      .where('read', '==', false)
      .get();
    return snapshot.size;
  }

  async createNotification(
    recipientUid: string,
    data: Omit<Notification, 'id' | 'createdAt' | 'read'>
  ): Promise<Notification> {
    const notifData = {
      ...data,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    };

    const docRef = await getDb().collection('users').doc(recipientUid).collection('notifications').add(notifData);
    return { id: docRef.id, ...notifData } as unknown as Notification;
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await getDb().collection('users').doc(userId).collection('notifications').doc(notificationId).update({
      read: true,
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    const snapshot = await getDb().collection('users').doc(userId).collection('notifications')
      .where('read', '==', false)
      .get();

    if (snapshot.empty) return;

    const batch = getDb().batch();
    snapshot.docs.forEach((d) => {
      batch.update(d.ref, { read: true });
    });

    await batch.commit();
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    await getDb().collection('users').doc(userId).collection('notifications').doc(notificationId).delete();
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    const snapshot = await getDb().collection('users').doc(userId).collection('notifications').get();

    if (snapshot.empty) return;

    const batch = getDb().batch();
    snapshot.docs.forEach((d) => {
      batch.delete(d.ref);
    });

    await batch.commit();
  }

  async createRideRequestNotification(
    driverUid: string,
    passengerUid: string,
    passengerName: string,
    passengerPhoto: string | null,
    rideId: string,
    commuteId: string,
    startPoint: string,
    destination: string,
    departureTime: string
  ): Promise<Notification> {
    return this.createNotification(driverUid, {
      type: 'ride_request',
      rideId,
      commuteId,
      actorUid: passengerUid,
      actorName: passengerName,
      actorPhoto: passengerPhoto ?? undefined,
      startPoint,
      destination,
      departureTime,
    });
  }

  async createRequestAcceptedNotification(
    passengerUid: string,
    driverUid: string,
    driverName: string,
    driverPhoto: string | null,
    rideId: string,
    startPoint: string,
    destination: string,
    departureTime: string
  ): Promise<Notification> {
    return this.createNotification(passengerUid, {
      type: 'request_accepted',
      rideId,
      actorUid: driverUid,
      actorName: driverName,
      actorPhoto: driverPhoto ?? undefined,
      startPoint,
      destination,
      departureTime,
    });
  }

  async createRequestRejectedNotification(
    passengerUid: string,
    driverUid: string,
    driverName: string,
    driverPhoto: string | null,
    rideId: string,
    startPoint: string,
    destination: string,
    departureTime: string
  ): Promise<Notification> {
    return this.createNotification(passengerUid, {
      type: 'request_rejected',
      rideId,
      actorUid: driverUid,
      actorName: driverName,
      actorPhoto: driverPhoto ?? undefined,
      startPoint,
      destination,
      departureTime,
    });
  }

  async createRideReminderNotification(
    userUid: string,
    commuteId: string,
    userName: string,
    userPhoto: string | null,
    startPoint: string,
    destination: string,
    departureTime: string
  ): Promise<Notification> {
    return this.createNotification(userUid, {
      type: 'ride_reminder',
      rideId: '',
      commuteId,
      actorUid: userUid,
      actorName: userName,
      actorPhoto: userPhoto ?? undefined,
      startPoint,
      destination,
      departureTime,
    });
  }
}

export const notificationService = new NotificationService();
