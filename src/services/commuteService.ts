import { getDb } from '../config/database.js';
import { Commute } from '../models/types.js';
import { userService } from './userService.js';
import { randomUUID } from 'node:crypto';

function toCommute(row: Record<string, unknown>): Commute {
  return {
    ...row,
    recurring: Boolean(row.recurring),
    daysOfWeek: row.daysOfWeek ? JSON.parse(row.daysOfWeek as string) : undefined,
  } as unknown as Commute;
}

export class CommuteService {
  async getCommute(commuteId: string): Promise<Commute | null> {
    const row = getDb().prepare('SELECT * FROM commutes WHERE id = ?').get(commuteId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return toCommute(row);
  }

  async getCommutes(filters: {
    authorUid?: string;
    type?: 'offer' | 'request';
    status?: 'active' | 'completed' | 'cancelled';
    startPoint?: string;
    destination?: string;
  }): Promise<Commute[]> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (filters.authorUid) {
      conditions.push('authorUid = @authorUid');
      params.authorUid = filters.authorUid;
    }
    if (filters.type) {
      conditions.push('type = @type');
      params.type = filters.type;
    }
    if (filters.status) {
      conditions.push('status = @status');
      params.status = filters.status;
    }

    let query = 'SELECT * FROM commutes';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY createdAt DESC';

    const rows = getDb().prepare(query).all(params) as Record<string, unknown>[];
    let commutes = rows.map(toCommute);

    if (filters.startPoint) {
      const search = filters.startPoint.toLowerCase();
      commutes = commutes.filter((c) => c.startPoint.toLowerCase().includes(search));
    }
    if (filters.destination) {
      const search = filters.destination.toLowerCase();
      commutes = commutes.filter((c) => c.destination.toLowerCase().includes(search));
    }

    return commutes;
  }

  async createCommute(authorUid: string, data: Omit<Commute, 'id' | 'authorUid' | 'createdAt'>): Promise<Commute> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const commuteData = {
      id,
      authorUid,
      startPoint: data.startPoint,
      destination: data.destination,
      departureTime: data.departureTime,
      seatsAvailable: data.seatsAvailable,
      carMake: data.carMake || null,
      carModel: data.carModel || null,
      carYear: data.carYear || null,
      plateNumber: data.plateNumber || null,
      type: data.type || 'offer',
      status: data.status || 'active',
      shift: data.shift || null,
      recurring: data.recurring ? 1 : 0,
      daysOfWeek: data.daysOfWeek ? JSON.stringify(data.daysOfWeek) : null,
      createdAt: now,
      updatedAt: now,
    };

    getDb().prepare(`
      INSERT INTO commutes (id, authorUid, startPoint, destination, departureTime, seatsAvailable, carMake, carModel, carYear, plateNumber, type, status, shift, recurring, daysOfWeek, createdAt, updatedAt)
      VALUES (@id, @authorUid, @startPoint, @destination, @departureTime, @seatsAvailable, @carMake, @carModel, @carYear, @plateNumber, @type, @status, @shift, @recurring, @daysOfWeek, @createdAt, @updatedAt)
    `).run(commuteData);

    return { ...commuteData, id, recurring: Boolean(commuteData.recurring), daysOfWeek: data.daysOfWeek } as unknown as Commute;
  }

  async updateCommute(commuteId: string, uid: string, data: Partial<Commute>): Promise<Commute | null> {
    const commute = await this.getCommute(commuteId);
    if (!commute) return null;

    const isAdmin = await userService.checkIsAdmin(uid);
    if (commute.authorUid !== uid && !isAdmin) {
      throw new Error('Unauthorized: You can only update your own commutes');
    }

    const sets: string[] = [];
    const values: Record<string, unknown> = { id: commuteId, updatedAt: new Date().toISOString() };

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id' && key !== 'authorUid') {
        sets.push(`${key} = @${key}`);
        values[key] = value;
      }
    }

    if (sets.length === 0) return commute;

    sets.push('updatedAt = @updatedAt');
    getDb().prepare(`UPDATE commutes SET ${sets.join(', ')} WHERE id = @id`).run(values);
    return this.getCommute(commuteId);
  }

  async deleteCommute(commuteId: string, uid: string): Promise<boolean> {
    const commute = await this.getCommute(commuteId);
    if (!commute) return false;

    const isAdmin = await userService.checkIsAdmin(uid);
    if (commute.authorUid !== uid && !isAdmin) {
      throw new Error('Unauthorized: You can only delete your own commutes');
    }

    getDb().prepare('DELETE FROM commutes WHERE id = ?').run(commuteId);
    return true;
  }

  async searchCommutes(startPoint: string, destination: string): Promise<Commute[]> {
    const rows = getDb().prepare(
      "SELECT * FROM commutes WHERE type = 'offer' AND status = 'active' ORDER BY createdAt DESC"
    ).all() as Record<string, unknown>[];

    const commutes = rows.map(toCommute);

    return commutes.filter((c) => {
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
