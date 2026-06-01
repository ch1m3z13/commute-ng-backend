import { getDb } from '../config/database.js';
import { ChatMessage } from '../models/types.js';
import { randomUUID } from 'node:crypto';

function toMessage(row: Record<string, unknown>): ChatMessage {
  return row as unknown as ChatMessage;
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
}

export const chatService = new ChatService();
