import { getDb } from '../config/database.js';
import { Notification } from '../models/types.js';
import { randomUUID } from 'node:crypto';

function toNotification(row: Record<string, unknown>): Notification {
  return {
    ...row,
    read: Boolean(row.read),
  } as unknown as Notification;
}

export class NotificationService {
  async getNotifications(userId: string): Promise<Notification[]> {
    const rows = getDb().prepare('SELECT * FROM notifications WHERE recipientUid = ? ORDER BY createdAt DESC').all(userId) as Record<string, unknown>[];
    return rows.map(toNotification);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const row = getDb().prepare('SELECT COUNT(*) as count FROM notifications WHERE recipientUid = ? AND read = 0').get(userId) as { count: number };
    return row.count;
  }

  async createNotification(
    recipientUid: string,
    data: Omit<Notification, 'id' | 'createdAt' | 'read'>
  ): Promise<Notification> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const notifData = {
      id,
      recipientUid,
      type: data.type,
      rideId: data.rideId || null,
      commuteId: data.commuteId || null,
      actorUid: data.actorUid,
      actorName: data.actorName,
      actorPhoto: data.actorPhoto || null,
      startPoint: data.startPoint || null,
      destination: data.destination || null,
      departureTime: data.departureTime || null,
      read: 0,
      createdAt: now,
    };

    getDb().prepare(`
      INSERT INTO notifications (id, recipientUid, type, rideId, commuteId, actorUid, actorName, actorPhoto, startPoint, destination, departureTime, read, createdAt)
      VALUES (@id, @recipientUid, @type, @rideId, @commuteId, @actorUid, @actorName, @actorPhoto, @startPoint, @destination, @departureTime, @read, @createdAt)
    `).run(notifData);

    return { ...notifData, read: false } as unknown as Notification;
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    getDb().prepare('UPDATE notifications SET read = 1 WHERE id = ? AND recipientUid = ?').run(notificationId, userId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    getDb().prepare('UPDATE notifications SET read = 1 WHERE recipientUid = ? AND read = 0').run(userId);
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    getDb().prepare('DELETE FROM notifications WHERE id = ? AND recipientUid = ?').run(notificationId, userId);
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    getDb().prepare('DELETE FROM notifications WHERE recipientUid = ?').run(userId);
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
