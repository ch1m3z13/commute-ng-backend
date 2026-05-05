import { supabase } from '../config/supabase.js';
import { Notification } from '../models/types.js';

function toNotification(id: string, data: Record<string, unknown>): Notification {
  return { id, ...data } as Notification;
}

export class PostgresNotificationService {
  async getNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_uid', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((d) => toNotification(d.id, d));
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_uid', userId)
      .eq('read', false);

    if (error) return 0;
    return count || 0;
  }

  async createNotification(
    recipientUid: string,
    data: Omit<Notification, 'id' | 'createdAt' | 'read'>
  ): Promise<Notification> {
    const notifData = {
      recipient_uid: recipientUid,
      type: data.type,
      ride_id: data.rideId,
      commute_id: data.commuteId,
      actor_uid: data.actorUid,
      actor_name: data.actorName,
      actor_photo: data.actorPhoto,
      start_point: data.startPoint,
      destination: data.destination,
      departure_time: data.departureTime,
      read: false,
      scheduled_for: data.scheduledFor,
    };

    const { data: created, error } = await supabase
      .from('notifications')
      .insert(notifData)
      .select()
      .single();

    if (error) throw error;
    return toNotification(created.id, created);
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('recipient_uid', userId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_uid', userId)
      .eq('read', false);
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('recipient_uid', userId);
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    await supabase
      .from('notifications')
      .delete()
      .eq('recipient_uid', userId);
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
