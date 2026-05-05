import { supabase } from '../config/supabase.js';
import { UserProfile } from '../models/types.js';

function toUserProfile(id: string, data: Record<string, unknown>): UserProfile {
  return { uid: id, ...data } as UserProfile;
}

function fromUserProfile(data: UserProfile): Record<string, unknown> {
  return {
    id: data.uid,
    display_name: data.displayName,
    email: data.email,
    mobile_number: data.mobileNumber,
    nin: data.nin,
    company: data.company,
    is_verified: data.isVerified,
    rating: data.rating,
    role: data.role,
    photo_url: data.photoURL,
    verification_status: data.verificationStatus,
    employment_letter_url: data.employmentLetterUrl,
    id_card_url: data.idCardUrl,
    pay_stub_url: data.payStubUrl,
    car_make: data.carMake,
    car_model: data.carModel,
    car_year: data.carYear,
    plate_number: data.plateNumber,
  };
}

export class PostgresUserService {
  async getUser(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;
    return toUserProfile(data.id, data);
  }

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) return null;
    return toUserProfile(data.id, data);
  }

  async createUser(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const userData = {
      id: userId,
      display_name: data.displayName,
      email: data.email,
      mobile_number: data.mobileNumber,
      nin: data.nin,
      company: data.company,
      is_verified: false,
      rating: 5.0,
      role: 'executive',
      verification_status: 'unverified',
    };

    const { data: created, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw error;
    return toUserProfile(created.id, created);
  }

  async updateUser(userId: string, data: Partial<UserProfile>): Promise<UserProfile | null> {
    const updateData: Record<string, unknown> = {};
    if (data.displayName !== undefined) updateData.display_name = data.displayName;
    if (data.mobileNumber !== undefined) updateData.mobile_number = data.mobileNumber;
    if (data.company !== undefined) updateData.company = data.company;

    const { data: updated, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error || !updated) return null;
    return toUserProfile(updated.id, updated);
  }

  async updateVerificationStatus(
    userId: string,
    status: 'pending' | 'verified' | 'rejected',
    documents?: { employmentLetterUrl?: string; idCardUrl?: string; payStubUrl?: string }
  ): Promise<UserProfile | null> {
    const updateData: Record<string, unknown> = {
      verification_status: status,
    };

    if (documents) {
      if (documents.employmentLetterUrl) updateData.employment_letter_url = documents.employmentLetterUrl;
      if (documents.idCardUrl) updateData.id_card_url = documents.idCardUrl;
      if (documents.payStubUrl) updateData.pay_stub_url = documents.payStubUrl;
    }

    if (status === 'verified') {
      updateData.is_verified = true;
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error || !updated) return null;
    return toUserProfile(updated.id, updated);
  }

  async updateVehicle(
    userId: string,
    vehicle: { carMake?: string; carModel?: string; carYear?: string; plateNumber?: string }
  ): Promise<UserProfile | null> {
    const updateData: Record<string, unknown> = {};
    if (vehicle.carMake) updateData.car_make = vehicle.carMake;
    if (vehicle.carModel) updateData.car_model = vehicle.carModel;
    if (vehicle.carYear) updateData.car_year = vehicle.carYear;
    if (vehicle.plateNumber) updateData.plate_number = vehicle.plateNumber;

    const { data: updated, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error || !updated) return null;
    return toUserProfile(updated.id, updated);
  }

  async getVerifiedExecutives(excludeUid?: string): Promise<UserProfile[]> {
    let query = supabase
      .from('users')
      .select('*')
      .eq('role', 'executive')
      .eq('is_verified', true)
      .order('rating', { ascending: false })
      .limit(20);

    const { data, error } = await query;

    if (error || !data) return [];

    let users = data.map((d) => toUserProfile(d.id, d));

    if (excludeUid) {
      users = users.filter((u: UserProfile) => u.uid !== excludeUid);
    }

    return users;
  }

  async checkIsAdmin(uid: string): Promise<boolean> {
    const user = await this.getUser(uid);
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.email === 'ChimeO81@gmail.com' && user.verificationStatus === 'verified') return true;
    return false;
  }
}
