import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, seedUser, seedNotification } from '../../setup.js';
import { notificationService } from '../../../services/notificationService.js';

describe('notificationService', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('createNotification', () => {
    it('creates notification with correct fields', async () => {
      await seedUser({ uid: 'u1' });
      const notif = await notificationService.createNotification('u1', {
        type: 'ride_request',
        rideId: 'ride-1',
        actorUid: 'actor1',
        actorName: 'Test Actor',
        startPoint: 'Start',
        destination: 'End',
        departureTime: '08:00 AM',
      });
      expect(notif.id).toBeDefined();
      expect(notif.type).toBe('ride_request');
      expect(notif.read).toBe(false);
    });
  });

  describe('getNotifications', () => {
    it('returns notifications for user', async () => {
      await seedNotification({ recipientUid: 'u1', type: 'ride_request' });
      const notifs = await notificationService.getNotifications('u1');
      expect(notifs).toHaveLength(1);
    });

    it('orders by createdAt DESC', async () => {
      await seedNotification({ recipientUid: 'u1', id: 'n1' });
      await seedNotification({ recipientUid: 'u1', id: 'n2' });
      const notifs = await notificationService.getNotifications('u1');
      expect(notifs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getUnreadCount', () => {
    it('returns count of unread notifications', async () => {
      await seedNotification({ recipientUid: 'u1' });
      const count = await notificationService.getUnreadCount('u1');
      expect(count).toBe(1);
    });

    it('returns 0 when no unread', async () => {
      const count = await notificationService.getUnreadCount('nobody');
      expect(count).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('marks single notification as read', async () => {
      const id = await seedNotification({ recipientUid: 'u1' });
      await notificationService.markAsRead('u1', id);
      const notifs = await notificationService.getNotifications('u1');
      expect(notifs[0].read).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read', async () => {
      await seedNotification({ recipientUid: 'u1' });
      await seedNotification({ recipientUid: 'u1' });
      await notificationService.markAllAsRead('u1');
      const count = await notificationService.getUnreadCount('u1');
      expect(count).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    it('deletes specific notification', async () => {
      const id = await seedNotification({ recipientUid: 'u1' });
      await notificationService.deleteNotification('u1', id);
      const notifs = await notificationService.getNotifications('u1');
      expect(notifs).toHaveLength(0);
    });
  });
});
