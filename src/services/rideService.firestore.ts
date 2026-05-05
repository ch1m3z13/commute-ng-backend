import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { Ride } from '../models/types.js';
import { userService } from './userService.js';

let db: Firestore;

function getDb(): Firestore {
  if (!db) {
    db = getFirestore();
  }
  return db;
}

function toRide(id: string, data: Record<string, unknown>): Ride {
  return { id, ...data } as Ride;
}

export class RideService {
  async getRide(rideId: string): Promise<Ride | null> {
    const rideDoc = await getDb().collection('rides').doc(rideId).get();
    if (!rideDoc.exists) return null;
    return toRide(rideDoc.id, rideDoc.data() as Record<string, unknown>);
  }

  async getRidesForPassenger(passengerUid: string): Promise<Ride[]> {
    const snapshot = await getDb().collection('rides')
      .where('passengerUid', '==', passengerUid)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map((d) => toRide(d.id, d.data() as Record<string, unknown>));
  }

  async getRidesForDriver(driverUid: string): Promise<Ride[]> {
    const snapshot = await getDb().collection('rides')
      .where('driverUid', '==', driverUid)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map((d) => toRide(d.id, d.data() as Record<string, unknown>));
  }

  async getRidesForCommute(commuteId: string): Promise<Ride[]> {
    const snapshot = await getDb().collection('rides')
      .where('commuteId', '==', commuteId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map((d) => toRide(d.id, d.data() as Record<string, unknown>));
  }

  async createRide(data: Omit<Ride, 'id' | 'createdAt'>): Promise<Ride> {
    const rideData = {
      ...data,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };

    const docRef = await getDb().collection('rides').add(rideData);
    return { id: docRef.id, ...rideData } as Ride;
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
    }
  ): Promise<Ride> {
    const ride = await this.createRide({
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
    });

    return ride;
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

    await getDb().collection('rides').doc(rideId).update({
      status,
      updatedAt: new Date().toISOString(),
    });

    return this.getRide(rideId);
  }

  async acceptRide(rideId: string, uid: string): Promise<Ride | null> {
    const ride = await this.getRide(rideId);
    if (!ride) return null;

    if (ride.driverUid !== uid) {
      throw new Error('Only the driver can accept rides');
    }

    if (ride.seatsAvailable <= 0) {
      throw new Error('No seats available');
    }

    await getDb().collection('rides').doc(rideId).update({
      status: 'accepted',
      updatedAt: new Date().toISOString(),
    });

    return this.getRide(rideId);
  }

  async rejectRide(rideId: string, uid: string): Promise<Ride | null> {
    const ride = await this.getRide(rideId);
    if (!ride) return null;

    if (ride.driverUid !== uid) {
      throw new Error('Only the driver can reject rides');
    }

    await getDb().collection('rides').doc(rideId).update({
      status: 'rejected',
      updatedAt: new Date().toISOString(),
    });

    return this.getRide(rideId);
  }

  async completeRide(rideId: string, uid: string): Promise<Ride | null> {
    const ride = await this.getRide(rideId);
    if (!ride) return null;

    if (ride.driverUid !== uid && ride.passengerUid !== uid) {
      throw new Error('Only participants can mark ride as complete');
    }

    await getDb().collection('rides').doc(rideId).update({
      status: 'completed',
      updatedAt: new Date().toISOString(),
    });

    return this.getRide(rideId);
  }

  async cancelRide(rideId: string, uid: string): Promise<Ride | null> {
    const ride = await this.getRide(rideId);
    if (!ride) return null;

    const isAdmin = await userService.checkIsAdmin(uid);
    if (ride.driverUid !== uid && ride.passengerUid !== uid && !isAdmin) {
      throw new Error('Unauthorized to cancel this ride');
    }

    await getDb().collection('rides').doc(rideId).update({
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    });

    return this.getRide(rideId);
  }

  async deleteRide(rideId: string, uid: string): Promise<boolean> {
    const ride = await this.getRide(rideId);
    if (!ride) return false;

    const isAdmin = await userService.checkIsAdmin(uid);
    if (ride.driverUid !== uid && !isAdmin) {
      throw new Error('Unauthorized to delete this ride');
    }

    await getDb().collection('rides').doc(rideId).delete();
    return true;
  }
}

export const rideService = new RideService();
