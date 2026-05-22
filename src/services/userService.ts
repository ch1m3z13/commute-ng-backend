import { getDb } from '../config/database.js';
import { UserProfile, MatchingPreferences, DEFAULT_MATCHING_PREFERENCES } from '../models/types.js';
import { randomUUID } from 'node:crypto';

function toUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    ...row,
    isVerified: Boolean(row.isVerified),
    homeLat: row.homeLat != null ? Number(row.homeLat) : undefined,
    homeLng: row.homeLng != null ? Number(row.homeLng) : undefined,
    officeLat: row.officeLat != null ? Number(row.officeLat) : undefined,
    officeLng: row.officeLng != null ? Number(row.officeLng) : undefined,
  } as unknown as UserProfile;
}

export class UserService {
  async getUser(userId: string): Promise<UserProfile | null> {
    const row = getDb().prepare('SELECT * FROM users WHERE uid = ?').get(userId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return toUserProfile(row);
  }

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;
    if (!row) return null;
    return toUserProfile(row);
  }

  async createUser(userId: string, data: Partial<UserProfile> & { passwordHash?: string }): Promise<UserProfile> {
    const now = new Date().toISOString();
    const userData = {
      uid: userId,
      displayName: data.displayName || '',
      email: data.email || '',
      mobileNumber: data.mobileNumber || null,
      nin: data.nin || null,
      company: data.company || null,
      isVerified: 0,
      rating: 5.0,
      role: 'executive',
      photoURL: data.photoURL || null,
      verificationStatus: 'unverified',
      employmentLetterUrl: data.employmentLetterUrl || null,
      idCardUrl: data.idCardUrl || null,
      payStubUrl: data.payStubUrl || null,
      carMake: data.carMake || null,
      carModel: data.carModel || null,
      carYear: data.carYear || null,
      plateNumber: data.plateNumber || null,
      passwordHash: data.passwordHash || null,
      homeAddress: data.homeAddress || null,
      homeLat: data.homeLat ?? null,
      homeLng: data.homeLng ?? null,
      officeAddress: data.officeAddress || null,
      officeLat: data.officeLat ?? null,
      officeLng: data.officeLng ?? null,
      matchingPreferences: data.matchingPreferences || JSON.stringify(DEFAULT_MATCHING_PREFERENCES),
      createdAt: now,
      updatedAt: now,
    };

    getDb().prepare(`
      INSERT INTO users (uid, displayName, email, mobileNumber, nin, company, isVerified, rating, role, photoURL, verificationStatus, employmentLetterUrl, idCardUrl, payStubUrl, carMake, carModel, carYear, plateNumber, passwordHash, homeAddress, homeLat, homeLng, officeAddress, officeLat, officeLng, matchingPreferences, createdAt, updatedAt)
      VALUES (@uid, @displayName, @email, @mobileNumber, @nin, @company, @isVerified, @rating, @role, @photoURL, @verificationStatus, @employmentLetterUrl, @idCardUrl, @payStubUrl, @carMake, @carModel, @carYear, @plateNumber, @passwordHash, @homeAddress, @homeLat, @homeLng, @officeAddress, @officeLat, @officeLng, @matchingPreferences, @createdAt, @updatedAt)
    `).run(userData);

    return userData as unknown as UserProfile;
  }

  async updateUser(userId: string, data: Partial<UserProfile>): Promise<UserProfile | null> {
    const sets: string[] = [];
    const values: Record<string, unknown> = { uid: userId };

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'uid' && key !== 'isVerified') {
        sets.push(`${key} = @${key}`);
        values[key] = value;
      }
    }

    if (sets.length === 0) return this.getUser(userId);

    sets.push('updatedAt = @updatedAt');
    values.updatedAt = new Date().toISOString();

    getDb().prepare(`UPDATE users SET ${sets.join(', ')} WHERE uid = @uid`).run(values);
    return this.getUser(userId);
  }

  async updateVerificationStatus(
    userId: string,
    status: 'pending' | 'verified' | 'rejected',
    documents?: { employmentLetterUrl?: string; idCardUrl?: string; payStubUrl?: string }
  ): Promise<UserProfile | null> {
    const sets = ['verificationStatus = @status', 'updatedAt = @updatedAt'];
    const values: Record<string, unknown> = {
      uid: userId,
      status,
      updatedAt: new Date().toISOString(),
    };

    if (documents?.employmentLetterUrl) {
      sets.push('employmentLetterUrl = @employmentLetterUrl');
      values.employmentLetterUrl = documents.employmentLetterUrl;
    }
    if (documents?.idCardUrl) {
      sets.push('idCardUrl = @idCardUrl');
      values.idCardUrl = documents.idCardUrl;
    }
    if (documents?.payStubUrl) {
      sets.push('payStubUrl = @payStubUrl');
      values.payStubUrl = documents.payStubUrl;
    }
    if (status === 'verified') {
      sets.push('isVerified = 1');
    }

    getDb().prepare(`UPDATE users SET ${sets.join(', ')} WHERE uid = @uid`).run(values);
    return this.getUser(userId);
  }

  async updateVehicle(
    userId: string,
    vehicle: { carMake?: string; carModel?: string; carYear?: string; plateNumber?: string }
  ): Promise<UserProfile | null> {
    const sets: string[] = [];
    const values: Record<string, unknown> = { uid: userId, updatedAt: new Date().toISOString() };

    for (const [key, value] of Object.entries(vehicle)) {
      if (value !== undefined) {
        sets.push(`${key} = @${key}`);
        values[key] = value;
      }
    }

    if (sets.length === 0) return this.getUser(userId);

    sets.push('updatedAt = @updatedAt');
    getDb().prepare(`UPDATE users SET ${sets.join(', ')} WHERE uid = @uid`).run(values);
    return this.getUser(userId);
  }

  async updateAddresses(
    userId: string,
    addresses: {
      homeAddress?: string;
      homeLat?: number;
      homeLng?: number;
      officeAddress?: string;
      officeLat?: number;
      officeLng?: number;
    }
  ): Promise<UserProfile | null> {
    const sets: string[] = [];
    const values: Record<string, unknown> = { uid: userId, updatedAt: new Date().toISOString() };

    for (const [key, value] of Object.entries(addresses)) {
      if (value !== undefined) {
        sets.push(`${key} = @${key}`);
        values[key] = value;
      }
    }

    if (sets.length === 0) return this.getUser(userId);

    sets.push('updatedAt = @updatedAt');
    getDb().prepare(`UPDATE users SET ${sets.join(', ')} WHERE uid = @uid`).run(values);
    return this.getUser(userId);
  }

  async updateMatchingPreferences(
    userId: string,
    prefs: Partial<MatchingPreferences>
  ): Promise<UserProfile | null> {
    const user = await this.getUser(userId);
    if (!user) return null;

    const current: MatchingPreferences = user.matchingPreferences
      ? JSON.parse(user.matchingPreferences)
      : DEFAULT_MATCHING_PREFERENCES;

    const updated = { ...current, ...prefs };

    getDb().prepare('UPDATE users SET matchingPreferences = ?, updatedAt = ? WHERE uid = ?')
      .run(JSON.stringify(updated), new Date().toISOString(), userId);

    return this.getUser(userId);
  }

  async getMatchingPreferences(userId: string): Promise<MatchingPreferences> {
    const user = await this.getUser(userId);
    if (!user || !user.matchingPreferences) return DEFAULT_MATCHING_PREFERENCES;
    try {
      return JSON.parse(user.matchingPreferences) as MatchingPreferences;
    } catch {
      return DEFAULT_MATCHING_PREFERENCES;
    }
  }

  async getVerifiedExecutives(excludeUid?: string): Promise<UserProfile[]> {
    let query = "SELECT * FROM users WHERE role = 'executive' AND isVerified = 1";
    const params: Record<string, unknown> = {};

    if (excludeUid) {
      query += ' AND uid != @excludeUid';
      params.excludeUid = excludeUid;
    }

    query += ' ORDER BY rating DESC';

    const rows = getDb().prepare(query).all(params) as Record<string, unknown>[];
    return rows.map(toUserProfile);
  }

  async checkIsAdmin(uid: string): Promise<boolean> {
    const user = await this.getUser(uid);
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.email === 'ChimeO81@gmail.com' && user.verificationStatus === 'verified') return true;
    return false;
  }
}

export const userService = new UserService();
