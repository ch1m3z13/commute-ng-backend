import { getDb } from '../config/database.js';
import { ChatMessage } from '../models/types.js';
import { randomUUID } from 'node:crypto';

function toMessage(row: Record<string, unknown>): ChatMessage {
  return {
    ...row,
    body: row.text as string,
  } as unknown as ChatMessage;
}

export class ChatService {
  async getMessages(rideId: string): Promise<ChatMessage[]> {
    const rows = await getDb().prepare('SELECT * FROM chat_messages WHERE rideId = ? ORDER BY createdAt ASC').all(rideId) as Record<string, unknown>[];
    return rows.map(toMessage);
  }

  async sendMessage(
    rideId: string,
    senderUid: string,
    senderName: string,
    senderPhoto: string | null,
    text: string
  ): Promise<ChatMessage> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const messageData = {
      id,
      rideId,
      senderUid,
      senderName,
      senderPhoto: senderPhoto ?? null,
      text,
      createdAt: now,
    };

    await getDb().prepare(`
      INSERT INTO chat_messages (id, rideId, senderUid, senderName, senderPhoto, text, createdAt)
      VALUES (@id, @rideId, @senderUid, @senderName, @senderPhoto, @text, @createdAt)
    `).run(messageData);

    return messageData as unknown as ChatMessage;
  }

  async canAccessChat(rideId: string, uid: string): Promise<boolean> {
    const ride = await getDb().prepare('SELECT driverUid, passengerUid FROM rides WHERE id = ?').get(rideId) as { driverUid: string; passengerUid: string } | undefined;
    if (!ride) return false;
    return ride.driverUid === uid || ride.passengerUid === uid;
  }

  async getConversations(uid: string): Promise<Array<{ rideId: string; otherUser: { uid: string; displayName: string; photoURL: string | null }; lastMessage: ChatMessage | null; unreadCount: number }>> {
    const rows = await getDb().prepare(`
      SELECT DISTINCT r.id as rideId,
        CASE WHEN r.driverUid = ? THEN r.passengerUid ELSE r.driverUid END as otherUid,
        r.status as rideStatus
      FROM rides r
      WHERE (r.driverUid = ? OR r.passengerUid = ?)
        AND r.status IN ('accepted', 'pending', 'auto_suggested')
      ORDER BY r.updatedAt DESC
    `).all(uid, uid, uid) as Array<{ rideId: string; otherUid: string; rideStatus: string }>;

    const conversations = await Promise.all(rows.map(async (row) => {
      const otherUser = await getDb().prepare('SELECT uid, displayName, photoURL FROM users WHERE uid = ?').get(row.otherUid) as { uid: string; displayName: string; photoURL: string | null } | undefined;

      const lastMsg = await getDb().prepare('SELECT * FROM chat_messages WHERE rideId = ? ORDER BY createdAt DESC LIMIT 1').get(row.rideId) as Record<string, unknown> | undefined;

      const unreadRow = await getDb().prepare('SELECT COUNT(*) as count FROM chat_messages WHERE rideId = ? AND senderUid != ?').get(row.rideId, uid) as { count: number } | undefined;

      return {
        rideId: row.rideId,
        otherUser: otherUser || { uid: row.otherUid, displayName: 'Unknown', photoURL: null },
        lastMessage: lastMsg ? toMessage(lastMsg) : null,
        unreadCount: unreadRow?.count || 0,
      };
    }));

    return conversations;
  }
}

export const chatService = new ChatService();
