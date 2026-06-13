import { getDb } from '../config/database.js';
import { Notification } from '../models/types.js';
import { randomUUID } from 'node:crypto';
import { Response } from 'express';

function toNotification(row: Record<string, unknown>): Notification {
  const title = deriveTitle(row);
  const body = deriveBody(row);
  return {
    ...row,
    read: Boolean(row.read),
    title,
    body,
  } as unknown as Notification;
}

function deriveTitle(row: Record<string, unknown>): string {
  const actorName = (row.actorName as string) || 'Someone';
  switch (row.type) {
    case 'ride_request': return `${actorName} wants to join your ride`;
    case 'request_accepted': return `${actorName} accepted your ride request`;
    case 'request_rejected': return `${actorName} declined your ride request`;
    case 'ride_completed': return `${actorName} completed the ride`;
    case 'ride_cancelled': return `${actorName} cancelled the ride`;
    case 'ride_reminder': return 'Ride reminder';
    case 'match_suggested': return 'New ride match found';
    case 'auto_accepted': return 'Ride auto-accepted';
    case 'capacity_update': return 'Ride capacity updated';
    default: return 'Notification';
  }
}

function deriveBody(row: Record<string, unknown>): string {
  const startPoint = row.startPoint as string | null;
  const destination = row.destination as string | null;
  const departureTime = row.departureTime as string | null;
  const route = startPoint && destination ? `${startPoint} → ${destination}` : '';
  const time = departureTime ? ` at ${departureTime}` : '';

  switch (row.type) {
    case 'ride_request': return route ? `Route: ${route}${time}` : 'Tap to view details';
    case 'request_accepted': return route ? `Your ride on ${route}${time} is confirmed.` : 'Tap to view details';
    case 'request_rejected': return route ? `Your request for ${route} was declined.` : 'Tap to view details';
    case 'ride_completed': return route ? `${route} has been completed.` : 'Tap to view details';
    case 'ride_cancelled': return route ? `${route} has been cancelled.` : 'Tap to view details';
    case 'ride_reminder': return route ? `Reminder: ${route}${time}` : 'Tap to view details';
    default: return 'Tap to view details';
  }
}

type SSEConnection = {
  res: Response;
  uid: string;
};

export class NotificationService {
  private connections: Map<string, Set<Response>> = new Map();

  addConnection(uid: string, res: Response): void {
    if (!this.connections.has(uid)) {
      this.connections.set(uid, new Set());
    }
    this.connections.get(uid)!.add(res);

    // Remove on close
    res.on('close', () => {
      this.connections.get(uid)?.delete(res);
      if (this.connections.get(uid)?.size === 0) {
        this.connections.delete(uid);
      }
    });
  }

  private pushToUser(uid: string, notification: Notification): void {
    const conns = this.connections.get(uid);
    if (!conns) return;
    const data = JSON.stringify(notification);
    for (const res of conns) {
      res.write(`data: ${data}\n\n`);
    }
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    const rows = await getDb().prepare('SELECT * FROM notifications WHERE recipientUid = ? ORDER BY createdAt DESC').all(userId) as Record<string, unknown>[];
    return rows.map(toNotification);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const row = await getDb().prepare('SELECT COUNT(*) as count FROM notifications WHERE recipientUid = ? AND read = 0').get(userId) as { count: string | number };
    return Number(row.count);
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

    await getDb().prepare(`
      INSERT INTO notifications (id, recipientUid, type, rideId, commuteId, actorUid, actorName, actorPhoto, startPoint, destination, departureTime, read, createdAt)
      VALUES (@id, @recipientUid, @type, @rideId, @commuteId, @actorUid, @actorName, @actorPhoto, @startPoint, @destination, @departureTime, @read, @createdAt)
    `).run(notifData);

    const notification: Notification = { ...notifData, read: false } as unknown as Notification;

    // Push to SSE connections
    this.pushToUser(recipientUid, notification);

    return notification;
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await getDb().prepare('UPDATE notifications SET read = 1 WHERE id = ? AND recipientUid = ?').run(notificationId, userId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await getDb().prepare('UPDATE notifications SET read = 1 WHERE recipientUid = ? AND read = 0').run(userId);
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    await getDb().prepare('DELETE FROM notifications WHERE id = ? AND recipientUid = ?').run(notificationId, userId);
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    await getDb().prepare('DELETE FROM notifications WHERE recipientUid = ?').run(userId);
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
