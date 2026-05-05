import { supabase } from '../config/supabase.js';
import { Ride } from '../models/types.js';
import { PostgresUserService } from './userService.postgres.js';

const userService = new PostgresUserService();

function toRide(id: string, data: Record<string, unknown>): Ride {
  return { id, ...data } as Ride;
}

export class PostgresRideService {
  async getRide(rideId: string): Promise<Ride | null> {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .single();

    if (error || !data) return null;
    return toRide(data.id, data);
  }

  async getRidesForPassenger(passengerUid: string): Promise<Ride[]> {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('passenger_uid', passengerUid)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((d) => toRide(d.id, d));
  }

  async getRidesForDriver(driverUid: string): Promise<Ride[]> {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('driver_uid', driverUid)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((d) => toRide(d.id, d));
  }

  async getRidesForCommute(commuteId: string): Promise<Ride[]> {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('commute_id', commuteId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((d) => toRide(d.id, d));
  }

  async createRide(data: Omit<Ride, 'id' | 'createdAt'>): Promise<Ride> {
    const rideData = {
      commute_id: data.commuteId,
      driver_uid: data.driverUid,
      passenger_uid: data.passengerUid,
      passenger_name: data.passengerName,
      passenger_photo: data.passengerPhoto,
      author_name: data.authorName,
      author_photo: data.authorPhoto,
      start_point: data.startPoint,
      destination: data.destination,
      departure_time: data.departureTime,
      seats_available: data.seatsAvailable,
      car_make: data.carMake,
      car_model: data.carModel,
      car_year: data.carYear,
      plate_number: data.plateNumber,
      status: 'pending',
    };

    const { data: created, error } = await supabase
      .from('rides')
      .insert(rideData)
      .select()
      .single();

    if (error) throw error;
    return toRide(created.id, created);
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

    const { data: updated, error } = await supabase
      .from('rides')
      .update({ status })
      .eq('id', rideId)
      .select()
      .single();

    if (error || !updated) return null;
    return toRide(updated.id, updated);
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

    const { data: updated, error } = await supabase
      .from('rides')
      .update({ status: 'accepted' })
      .eq('id', rideId)
      .select()
      .single();

    if (error || !updated) return null;
    return toRide(updated.id, updated);
  }

  async rejectRide(rideId: string, uid: string): Promise<Ride | null> {
    const ride = await this.getRide(rideId);
    if (!ride) return null;

    if (ride.driverUid !== uid) {
      throw new Error('Only the driver can reject rides');
    }

    const { data: updated, error } = await supabase
      .from('rides')
      .update({ status: 'rejected' })
      .eq('id', rideId)
      .select()
      .single();

    if (error || !updated) return null;
    return toRide(updated.id, updated);
  }

  async completeRide(rideId: string, uid: string): Promise<Ride | null> {
    const ride = await this.getRide(rideId);
    if (!ride) return null;

    if (ride.driverUid !== uid && ride.passengerUid !== uid) {
      throw new Error('Only participants can mark ride as complete');
    }

    const { data: updated, error } = await supabase
      .from('rides')
      .update({ status: 'completed' })
      .eq('id', rideId)
      .select()
      .single();

    if (error || !updated) return null;
    return toRide(updated.id, updated);
  }

  async cancelRide(rideId: string, uid: string): Promise<Ride | null> {
    const ride = await this.getRide(rideId);
    if (!ride) return null;

    const isAdmin = await userService.checkIsAdmin(uid);
    if (ride.driverUid !== uid && ride.passengerUid !== uid && !isAdmin) {
      throw new Error('Unauthorized to cancel this ride');
    }

    const { data: updated, error } = await supabase
      .from('rides')
      .update({ status: 'cancelled' })
      .eq('id', rideId)
      .select()
      .single();

    if (error || !updated) return null;
    return toRide(updated.id, updated);
  }

  async deleteRide(rideId: string, uid: string): Promise<boolean> {
    const ride = await this.getRide(rideId);
    if (!ride) return false;

    const isAdmin = await userService.checkIsAdmin(uid);
    if (ride.driverUid !== uid && !isAdmin) {
      throw new Error('Unauthorized to delete this ride');
    }

    const { error } = await supabase
      .from('rides')
      .delete()
      .eq('id', rideId);

    return !error;
  }
}
