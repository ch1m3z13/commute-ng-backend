import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { Commute } from '../models/types.js';
import { userService } from './userService.js';

let db: Firestore;

function getDb(): Firestore {
  if (!db) {
    db = getFirestore();
  }
  return db;
}

function toCommute(id: string, data: Record<string, unknown>): Commute {
  return { id, ...data } as Commute;
}

export class CommuteService {
  async getCommute(commuteId: string): Promise<Commute | null> {
    const commuteDoc = await getDb().collection('commutes').doc(commuteId).get();
    if (!commuteDoc.exists) return null;
    return toCommute(commuteDoc.id, commuteDoc.data() as Record<string, unknown>);
  }

  async getCommutes(filters: {
    authorUid?: string;
    type?: 'offer' | 'request';
    status?: 'active' | 'completed' | 'cancelled';
    startPoint?: string;
    destination?: string;
  }): Promise<Commute[]> {
    let query: FirebaseFirestore.Query = getDb().collection('commutes');

    if (filters.authorUid) {
      query = query.where('authorUid', '==', filters.authorUid);
    }
    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    query = query.orderBy('createdAt', 'desc');

    const snapshot = await query.get();
    let commutes: Commute[] = snapshot.docs.map((d) => toCommute(d.id, d.data() as Record<string, unknown>));

    if (filters.startPoint) {
      commutes = commutes.filter((c: Commute) =>
        c.startPoint.toLowerCase().includes(filters.startPoint!.toLowerCase())
      );
    }

    if (filters.destination) {
      commutes = commutes.filter((c: Commute) =>
        c.destination.toLowerCase().includes(filters.destination!.toLowerCase())
      );
    }

    return commutes;
  }

  async createCommute(authorUid: string, data: Omit<Commute, 'id' | 'authorUid' | 'createdAt'>): Promise<Commute> {
    const commuteData = {
      authorUid,
      ...data,
      type: data.type || 'offer',
      status: data.status || 'active',
      createdAt: new Date().toISOString(),
    };

    const docRef = await getDb().collection('commutes').add(commuteData);
    return { id: docRef.id, ...commuteData } as Commute;
  }

  async updateCommute(commuteId: string, uid: string, data: Partial<Commute>): Promise<Commute | null> {
    const commute = await this.getCommute(commuteId);
    if (!commute) return null;

    const isAdmin = await userService.checkIsAdmin(uid);
    if (commute.authorUid !== uid && !isAdmin) {
      throw new Error('Unauthorized: You can only update your own commutes');
    }

    await getDb().collection('commutes').doc(commuteId).update({
      ...data,
      updatedAt: new Date().toISOString(),
    });

    return this.getCommute(commuteId);
  }

  async deleteCommute(commuteId: string, uid: string): Promise<boolean> {
    const commute = await this.getCommute(commuteId);
    if (!commute) return false;

    const isAdmin = await userService.checkIsAdmin(uid);
    if (commute.authorUid !== uid && !isAdmin) {
      throw new Error('Unauthorized: You can only delete your own commutes');
    }

    await getDb().collection('commutes').doc(commuteId).delete();
    return true;
  }

  async searchCommutes(startPoint: string, destination: string): Promise<Commute[]> {
    const snapshot = await getDb().collection('commutes')
      .where('type', '==', 'offer')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .get();

    const commutes: Commute[] = snapshot.docs.map((d) => toCommute(d.id, d.data() as Record<string, unknown>));

    return commutes.filter((c: Commute) => {
      const startMatch = startPoint
        ? c.startPoint.toLowerCase().includes(startPoint.toLowerCase())
        : true;
      const destMatch = destination
        ? c.destination.toLowerCase().includes(destination.toLowerCase())
        : true;
      return startMatch && destMatch;
    });
  }
}

export const commuteService = new CommuteService();
