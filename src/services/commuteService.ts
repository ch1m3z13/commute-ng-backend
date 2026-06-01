import { getDb } from '../config/database.js';
import { Commute, DEFAULT_MATCHING_PREFERENCES, MatchingPreferences } from '../models/types.js';
import { userService } from './userService.js';
import { geocodingService } from './geocodingService.js';
import { matchingService } from './matchingService.js';
import { notificationService } from './notificationService.js';
import { randomUUID } from 'node:crypto';

function toCommute(row: Record<string, unknown>): Commute {
  return {
    ...row,
    recurring: Boolean(row.recurring),
    daysOfWeek: row.daysOfWeek ? JSON.parse(row.daysOfWeek as string) : undefined,
    startLat: row.startLat != null ? Number(row.startLat) : undefined,
    startLng: row.startLng != null ? Number(row.startLng) : undefined,
    destLat: row.destLat != null ? Number(row.destLat) : undefined,
    destLng: row.destLng != null ? Number(row.destLng) : undefined,
    seatsRemaining: row.seatsRemaining != null ? Number(row.seatsRemaining) : undefined,
    pickupRadiusMeters: row.pickupRadiusMeters != null ? Number(row.pickupRadiusMeters) : 2000,
    timeFlexibilityMinutes: row.timeFlexibilityMinutes != null ? Number(row.timeFlexibilityMinutes) : 30,
  } as unknown as Commute;
}

export class CommuteService {
  async getCommute(commuteId: string): Promise<Commute | null> {
    const row = await getDb().prepare('SELECT * FROM commutes WHERE id = ?').get(commuteId) as Record<string, unknown> | undefined;
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

    const rows = await getDb().prepare(query).all(params) as Record<string, unknown>[];
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

    // Geocode start and destination
    let startLat: number | undefined, startLng: number | undefined;
    let destLat: number | undefined, destLng: number | undefined;

    if (data.startLat !== undefined && data.startLng !== undefined) {
      startLat = data.startLat;
      startLng = data.startLng;
    } else {
      const startGeo = await geocodingService.geocode(data.startPoint);
      startLat = startGeo.lat;
      startLng = startGeo.lng;
    }

    if (data.destLat !== undefined && data.destLng !== undefined) {
      destLat = data.destLat;
      destLng = data.destLng;
    } else {
      const destGeo = await geocodingService.geocode(data.destination);
      destLat = destGeo.lat;
      destLng = destGeo.lng;
    }

    const seatsAvailable = data.seatsAvailable;

    const commuteData = {
      id,
      authorUid,
      startPoint: data.startPoint,
      startLat,
      startLng,
      destination: data.destination,
      destLat,
      destLng,
      departureTime: data.departureTime,
      seatsAvailable,
      seatsRemaining: seatsAvailable,
      carMake: data.carMake || undefined,
      carModel: data.carModel || undefined,
      carYear: data.carYear || undefined,
      plateNumber: data.plateNumber || undefined,
      type: data.type || 'offer',
      status: data.status || 'active',
      shift: data.shift || undefined,
      recurring: data.recurring ? 1 : 0,
      daysOfWeek: data.daysOfWeek ? JSON.stringify(data.daysOfWeek) : null,
      pickupRadiusMeters: data.pickupRadiusMeters ?? 2000,
      timeFlexibilityMinutes: data.timeFlexibilityMinutes ?? 30,
      createdAt: now,
      updatedAt: now,
    };

    await getDb().prepare(`
      INSERT INTO commutes (id, authorUid, startPoint, startLat, startLng, destination, destLat, destLng, departureTime, seatsAvailable, seatsRemaining, carMake, carModel, carYear, plateNumber, type, status, shift, recurring, daysOfWeek, pickupRadiusMeters, timeFlexibilityMinutes, createdAt, updatedAt)
      VALUES (@id, @authorUid, @startPoint, @startLat, @startLng, @destination, @destLat, @destLng, @departureTime, @seatsAvailable, @seatsRemaining, @carMake, @carModel, @carYear, @plateNumber, @type, @status, @shift, @recurring, @daysOfWeek, @pickupRadiusMeters, @timeFlexibilityMinutes, @createdAt, @updatedAt)
    `).run(commuteData);

    const commute: Commute = {
      ...commuteData,
      id,
      recurring: Boolean(commuteData.recurring),
      daysOfWeek: data.daysOfWeek,
      startLat,
      startLng,
      destLat,
      destLng,
      seatsRemaining: seatsAvailable,
      pickupRadiusMeters: commuteData.pickupRadiusMeters,
      timeFlexibilityMinutes: commuteData.timeFlexibilityMinutes,
    };

    // Auto-match: if this is an offer, find matching rider requests
    if (commute.type === 'offer') {
      const matches = await matchingService.findRiderMatches(commute);
      for (const match of matches.slice(0, 5)) { // top 5 matches
        const rider = match.commute;
        // Create auto_suggested ride
        const rideId = randomUUID();
        await getDb().prepare(`
          INSERT INTO rides (id, commuteId, driverUid, passengerUid, passengerName, startPoint, destination, departureTime, seatsAvailable, carMake, carModel, carYear, plateNumber, status, matchScore, detourMeters, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto_suggested', ?, ?, ?, ?)
        `).run(
          rideId,
          commute.id,
          authorUid,
          rider.authorUid,
          null, // passengerName filled later
          rider.startPoint,
          rider.destination,
          commute.departureTime,
          commute.seatsAvailable,
          commute.carMake,
          commute.carModel,
          commute.carYear,
          commute.plateNumber,
          match.matchScore,
          match.totalDetourMeters,
          now,
          now
        );

        // Notify driver
        await notificationService.createNotification(authorUid, {
          type: 'match_suggested',
          rideId,
          commuteId: commute.id,
          actorUid: rider.authorUid,
          actorName: 'A rider',
          startPoint: rider.startPoint,
          destination: rider.destination,
          departureTime: commute.departureTime,
        });
      }
    }

    // Auto-match: if this is a request, find matching driver offers
    if (commute.type === 'request') {
      const matches = await matchingService.findDriverMatches(commute);
      const user = await userService.getUser(authorUid);
      for (const match of matches.slice(0, 5)) {
        const driver = match.commute;
        const rideId = randomUUID();
        await getDb().prepare(`
          INSERT INTO rides (id, commuteId, driverUid, passengerUid, passengerName, startPoint, destination, departureTime, seatsAvailable, carMake, carModel, carYear, plateNumber, status, matchScore, detourMeters, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto_suggested', ?, ?, ?, ?)
        `).run(
          rideId,
          driver.id,
          driver.authorUid,
          authorUid,
          user?.displayName || null,
          commute.startPoint,
          commute.destination,
          driver.departureTime,
          driver.seatsAvailable,
          driver.carMake,
          driver.carModel,
          driver.carYear,
          driver.plateNumber,
          match.matchScore,
          match.totalDetourMeters,
          now,
          now
        );

        // Notify rider
        await notificationService.createNotification(authorUid, {
          type: 'match_suggested',
          rideId,
          commuteId: commute.id,
          actorUid: driver.authorUid,
          actorName: 'A driver',
          startPoint: commute.startPoint,
          destination: commute.destination,
          departureTime: driver.departureTime,
        });
      }
    }

    return commute;
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
    await getDb().prepare(`UPDATE commutes SET ${sets.join(', ')} WHERE id = @id`).run(values);
    return this.getCommute(commuteId);
  }

  async deleteCommute(commuteId: string, uid: string): Promise<boolean> {
    const commute = await this.getCommute(commuteId);
    if (!commute) return false;

    const isAdmin = await userService.checkIsAdmin(uid);
    if (commute.authorUid !== uid && !isAdmin) {
      throw new Error('Unauthorized: You can only delete your own commutes');
    }

    await getDb().prepare('DELETE FROM commutes WHERE id = ?').run(commuteId);
    return true;
  }

  /**
   * Geospatial search — replaces the old searchCommutes.
   */
  async searchCommutes(params: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    desiredTime: string;
    shift: 'morning' | 'evening';
    maxResults?: number;
  }) {
    return matchingService.findMatches(params);
  }

  /**
   * Decrement seats remaining when a ride is accepted.
   */
  async decrementSeats(commuteId: string): Promise<boolean> {
    const commute = await this.getCommute(commuteId);
    if (!commute) return false;
    const current = commute.seatsRemaining ?? commute.seatsAvailable;
    if (current <= 0) return false;

    await getDb().prepare('UPDATE commutes SET seatsRemaining = seatsRemaining - 1, updatedAt = ? WHERE id = ?')
      .run(new Date().toISOString(), commuteId);
    return true;
  }

  /**
   * Increment seats remaining when a ride is cancelled.
   */
  async incrementSeats(commuteId: string): Promise<void> {
    await getDb().prepare('UPDATE commutes SET seatsRemaining = seatsRemaining + 1, updatedAt = ? WHERE id = ?')
      .run(new Date().toISOString(), commuteId);
  }
}

export const commuteService = new CommuteService();
