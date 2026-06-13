import { getDb } from '../config/database.js';
import { Ride } from '../models/types.js';
import { userService } from './userService.js';
import { commuteService } from './commuteService.js';
import { notificationService } from './notificationService.js';
import { randomUUID } from 'node:crypto';

function toRide(row: Record<string, unknown>): Ride {
  return {
    ...row,
    matchScore: row.matchScore != null ? Number(row.matchScore) : undefined,
    detourMeters: row.detourMeters != null ? Number(row.detourMeters) : undefined,
    passengerPhotoURL: row.passengerPhoto ?? row.passengerPhotoURL ?? null,
  } as unknown as Ride;
}

export class RideService {
  async getRide(rideId: string): Promise<Ride | null> {
    const row = await getDb().prepare('SELECT * FROM rides WHERE id = ?').get(rideId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return toRide(row);
  }

  async getRidesForPassenger(passengerUid: string): Promise<Ride[]> {
    const rows = await getDb().prepare(`
      SELECT r.*, u.displayName as driverName, u.photoURL as driverPhotoURL
      FROM rides r
      LEFT JOIN users u ON r.driverUid = u.uid
      WHERE r.passengerUid = ? ORDER BY r.createdAt DESC
    `).all(passengerUid) as Record<string, unknown>[];
    return rows.map(toRide);
  }

  async getRidesForDriver(driverUid: string): Promise<Ride[]> {
    const rows = await getDb().prepare(`
      SELECT r.*, u.displayName as passengerName, u.photoURL as passengerPhotoURL
      FROM rides r
      LEFT JOIN users u ON r.passengerUid = u.uid
      WHERE r.driverUid = ? ORDER BY r.createdAt DESC
    `).all(driverUid) as Record<string, unknown>[];
    return rows.map(toRide);
  }

  async getRidesForCommute(commuteId: string): Promise<Ride[]> {
    const rows = await getDb().prepare('SELECT * FROM rides WHERE commuteId = ? ORDER BY createdAt DESC').all(commuteId) as Record<string, unknown>[];
    return rows.map(toRide);
  }

  async createRide(data: Omit<Ride, 'id' | 'createdAt'>): Promise<Ride> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const rideData = {
      id,
      commuteId: data.commuteId,
      driverUid: data.driverUid,
      passengerUid: data.passengerUid,
      passengerName: data.passengerName || null,
      passengerPhoto: data.passengerPhoto || null,
      startPoint: data.startPoint,
      destination: data.destination,
      departureTime: data.departureTime,
      seatsAvailable: data.seatsAvailable,
      carMake: data.carMake || null,
      carModel: data.carModel || null,
      carYear: data.carYear || null,
      plateNumber: data.plateNumber || null,
      status: 'pending',
      matchScore: data.matchScore ?? null,
      detourMeters: data.detourMeters ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await getDb().prepare(`
      INSERT INTO rides (id, commuteId, driverUid, passengerUid, passengerName, passengerPhoto, startPoint, destination, departureTime, seatsAvailable, carMake, carModel, carYear, plateNumber, status, matchScore, detourMeters, createdAt, updatedAt)
      VALUES (@id, @commuteId, @driverUid, @passengerUid, @passengerName, @passengerPhoto, @startPoint, @destination, @departureTime, @seatsAvailable, @carMake, @carModel, @carYear, @plateNumber, @status, @matchScore, @detourMeters, @createdAt, @updatedAt)
    `).run(rideData);

    return { ...rideData } as unknown as Ride;
  }

  async requestRide(
    passengerUid: string,
    passengerName: string,
    passengerPhoto: string | null,
    commuteId: string,
    commuteData: {
      driverUid: string;
      startPoint: string;
      destination: string;
      departureTime: string;
      seatsAvailable: number;
      carMake?: string;
      carModel?: string;
      carYear?: string;
      plateNumber?: string;
    },
    matchScore?: number,
    detourMeters?: number,
  ): Promise<Ride> {
    return this.createRide({
      commuteId,
      driverUid: commuteData.driverUid,
      passengerUid,
      passengerName,
      passengerPhoto: passengerPhoto ?? undefined,
      startPoint: commuteData.startPoint,
      destination: commuteData.destination,
      departureTime: commuteData.departureTime,
      seatsAvailable: commuteData.seatsAvailable,
      carMake: commuteData.carMake,
      carModel: commuteData.carModel,
      carYear: commuteData.carYear,
      plateNumber: commuteData.plateNumber,
      status: 'pending',
      matchScore,
      detourMeters,
    });
  }

  async updateRideStatus(
    rideId: string,
    uid: string,
    status: 'accepted' | 'rejected' | 'completed' | 'cancelled'
  ): Promise<Ride | null> {
    const ride = await this.getRide(rideId);
    if (!ride) return null;

    const isAdmin = await userService.checkIsAdmin(uid);
    if (ride.driverUid !== uid && ride.passengerUid !== uid && !isAdmin) {
      throw new Error('Unauthorized to update this ride');
    }

    await getDb().prepare('UPDATE rides SET status = ?, updatedAt = ? WHERE id = ?').run(status, new Date().toISOString(), rideId);

    // Capacity tracking: decrement on accept, increment on cancel
    if (status === 'accepted') {
      await commuteService.decrementSeats(ride.commuteId);
    } else if (status === 'cancelled') {
      await commuteService.incrementSeats(ride.commuteId);
    }

    return this.getRide(rideId);
  }

  async acceptRide(rideId: string, uid: string): Promise<Ride | null> {
    const ride = await this.getRide(rideId);
    if (!ride) return null;

    if (ride.driverUid !== uid) {
      throw new Error('Only the driver can accept rides');
    }

    // Check capacity
    const decremented = await commuteService.decrementSeats(ride.commuteId);
    if (!decremented) {
      throw new Error('No seats available');
    }

    await getDb().prepare('UPDATE rides SET status = ?, updatedAt = ? WHERE id = ?').run('accepted', new Date().toISOString(), rideId);
    return this.getRide(rideId);
  }

  async rejectRide(rideId: string, uid: string): Promise<Ride | null> {
    const ride = await this.getRide(rideId);
    if (!ride) return null;

    if (ride.driverUid !== uid) {
      throw new Error('Only the driver can reject rides');
    }

    await getDb().prepare('UPDATE rides SET status = ?, updatedAt = ? WHERE id = ?').run('rejected', new Date().toISOString(), rideId);
    return this.getRide(rideId);
  }

  async completeRide(rideId: string, uid: string): Promise<Ride | null> {
    const ride = await this.getRide(rideId);
    if (!ride) return null;

    if (ride.driverUid !== uid && ride.passengerUid !== uid) {
      throw new Error('Only participants can mark ride as complete');
    }

    await getDb().prepare('UPDATE rides SET status = ?, updatedAt = ? WHERE id = ?').run('completed', new Date().toISOString(), rideId);
    return this.getRide(rideId);
  }

  async cancelRide(rideId: string, uid: string): Promise<Ride | null> {
    const ride = await this.getRide(rideId);
    if (!ride) return null;

    const isAdmin = await userService.checkIsAdmin(uid);
    if (ride.driverUid !== uid && ride.passengerUid !== uid && !isAdmin) {
      throw new Error('Unauthorized to cancel this ride');
    }

    // Only increment seats back if the ride was previously accepted (seat was decremented)
    if (ride.status === 'accepted') {
      await commuteService.incrementSeats(ride.commuteId);
    }

    await getDb().prepare('UPDATE rides SET status = ?, updatedAt = ? WHERE id = ?').run('cancelled', new Date().toISOString(), rideId);
    return this.getRide(rideId);
  }

  async deleteRide(rideId: string, uid: string): Promise<boolean> {
    const ride = await this.getRide(rideId);
    if (!ride) return false;

    const isAdmin = await userService.checkIsAdmin(uid);
    if (ride.driverUid !== uid && !isAdmin) {
      throw new Error('Unauthorized to delete this ride');
    }

    await getDb().prepare('DELETE FROM rides WHERE id = ?').run(rideId);
    return true;
  }
}

export const rideService = new RideService();
