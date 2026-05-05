import { supabase } from '../config/supabase.js';
import { Commute } from '../models/types.js';
import { PostgresUserService } from './userService.postgres.js';

const userService = new PostgresUserService();

function toCommute(id: string, data: Record<string, unknown>): Commute {
  return { id, ...data } as Commute;
}

function fromCommute(data: Commute): Record<string, unknown> {
  return {
    author_uid: data.authorUid,
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
    type: data.type,
    status: data.status,
    shift: data.shift,
    recurring: data.recurring,
    days_of_week: data.daysOfWeek,
    requests: data.requests,
  };
}

export class PostgresCommuteService {
  async getCommute(commuteId: string): Promise<Commute | null> {
    const { data, error } = await supabase
      .from('commutes')
      .select('*')
      .eq('id', commuteId)
      .single();

    if (error || !data) return null;
    return toCommute(data.id, data);
  }

  async getCommutes(filters: {
    authorUid?: string;
    type?: 'offer' | 'request';
    status?: 'active' | 'completed' | 'cancelled';
    startPoint?: string;
    destination?: string;
  }): Promise<Commute[]> {
    let query = supabase
      .from('commutes')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.authorUid) {
      query = query.eq('author_uid', filters.authorUid);
    }
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    let commutes = data.map((d) => toCommute(d.id, d));

    if (filters.startPoint) {
      commutes = commutes.filter((c: Commute) =>
        c.startPoint?.toLowerCase().includes(filters.startPoint!.toLowerCase())
      );
    }

    if (filters.destination) {
      commutes = commutes.filter((c: Commute) =>
        c.destination?.toLowerCase().includes(filters.destination!.toLowerCase())
      );
    }

    return commutes;
  }

  async createCommute(authorUid: string, data: Omit<Commute, 'id' | 'authorUid' | 'createdAt'>): Promise<Commute> {
    const commuteData = {
      author_uid: authorUid,
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
      type: data.type || 'offer',
      status: data.status || 'active',
      shift: data.shift,
      recurring: data.recurring,
      days_of_week: data.daysOfWeek,
      requests: data.requests || [],
    };

    const { data: created, error } = await supabase
      .from('commutes')
      .insert(commuteData)
      .select()
      .single();

    if (error) throw error;
    return toCommute(created.id, created);
  }

  async updateCommute(commuteId: string, uid: string, data: Partial<Commute>): Promise<Commute | null> {
    const commute = await this.getCommute(commuteId);
    if (!commute) return null;

    const isAdmin = await userService.checkIsAdmin(uid);
    if (commute.authorUid !== uid && !isAdmin) {
      throw new Error('Unauthorized: You can only update your own commutes');
    }

    const updateData: Record<string, unknown> = {};
    if (data.startPoint !== undefined) updateData.start_point = data.startPoint;
    if (data.destination !== undefined) updateData.destination = data.destination;
    if (data.departureTime !== undefined) updateData.departure_time = data.departureTime;
    if (data.seatsAvailable !== undefined) updateData.seats_available = data.seatsAvailable;
    if (data.carMake !== undefined) updateData.car_make = data.carMake;
    if (data.carModel !== undefined) updateData.car_model = data.carModel;
    if (data.carYear !== undefined) updateData.car_year = data.carYear;
    if (data.plateNumber !== undefined) updateData.plate_number = data.plateNumber;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.shift !== undefined) updateData.shift = data.shift;
    if (data.recurring !== undefined) updateData.recurring = data.recurring;
    if (data.daysOfWeek !== undefined) updateData.days_of_week = data.daysOfWeek;
    if (data.requests !== undefined) updateData.requests = data.requests;

    const { data: updated, error } = await supabase
      .from('commutes')
      .update(updateData)
      .eq('id', commuteId)
      .select()
      .single();

    if (error || !updated) return null;
    return toCommute(updated.id, updated);
  }

  async deleteCommute(commuteId: string, uid: string): Promise<boolean> {
    const commute = await this.getCommute(commuteId);
    if (!commute) return false;

    const isAdmin = await userService.checkIsAdmin(uid);
    if (commute.authorUid !== uid && !isAdmin) {
      throw new Error('Unauthorized: You can only delete your own commutes');
    }

    const { error } = await supabase
      .from('commutes')
      .delete()
      .eq('id', commuteId);

    return !error;
  }

  async searchCommutes(startPoint: string, destination: string): Promise<Commute[]> {
    const { data, error } = await supabase
      .from('commutes')
      .select('*')
      .eq('type', 'offer')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data
      .map((d) => toCommute(d.id, d))
      .filter((c: Commute) => {
        const startMatch = startPoint
          ? c.startPoint?.toLowerCase().includes(startPoint.toLowerCase())
          : true;
        const destMatch = destination
          ? c.destination?.toLowerCase().includes(destination.toLowerCase())
          : true;
        return startMatch && destMatch;
      });
  }
}
