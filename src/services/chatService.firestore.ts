import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { ChatMessage } from '../models/types.js';

let db: Firestore;

function getDb(): Firestore {
  if (!db) {
    db = getFirestore();
  }
  return db;
}

function toMessage(id: string, data: Record<string, unknown>): ChatMessage {
  return { id, ...data } as ChatMessage;
}

export class ChatService {
  async getMessages(rideId: string): Promise<ChatMessage[]> {
    const snapshot = await getDb().collection('rides').doc(rideId).collection('messages')
      .orderBy('createdAt', 'asc')
      .get();
    return snapshot.docs.map((d) => toMessage(d.id, d.data() as Record<string, unknown>));
  }

  async sendMessage(
    rideId: string,
    senderUid: string,
    senderName: string,
    senderPhoto: string | null,
    text: string
  ): Promise<ChatMessage> {
    const messageData = {
      senderUid,
      senderName,
      senderPhoto: senderPhoto ?? null,
      text,
      createdAt: FieldValue.serverTimestamp(),
    };

    const docRef = await getDb().collection('rides').doc(rideId).collection('messages').add(messageData);
    return { id: docRef.id, ...messageData } as unknown as ChatMessage;
  }

  async canAccessChat(rideId: string, uid: string): Promise<boolean> {
    const rideDoc = await getDb().collection('rides').doc(rideId).get();
    if (!rideDoc.exists) return false;

    const rideData = rideDoc.data() as Record<string, string>;
    return rideData.driverUid === uid || rideData.passengerUid === uid;
  }
}

export const chatService = new ChatService();
