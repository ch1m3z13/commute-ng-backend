import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { UserProfile } from '../models/types.js';

let _db: Firestore;

function getDb(): Firestore {
  if (!_db) {
    _db = getFirestore();
  }
  return _db;
}

function toUserProfile(id: string, data: Record<string, unknown>): UserProfile {
  return { uid: id, ...data } as UserProfile;
}

export class UserService {
  async getUser(userId: string): Promise<UserProfile | null> {
    const userDoc = await getDb().collection('users').doc(userId).get();
    if (!userDoc.exists) return null;
    return toUserProfile(userDoc.id, userDoc.data() as Record<string, unknown>);
  }

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    const snapshot = await getDb().collection('users').where('email', '==', email).get();
    if (snapshot.empty) return null;
    const docData = snapshot.docs[0];
    return toUserProfile(docData.id, docData.data() as Record<string, unknown>);
  }

  async createUser(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const userData = {
      uid: userId,
      ...data,
      isVerified: false,
      rating: 5.0,
      role: 'executive',
      verificationStatus: 'unverified',
      createdAt: new Date().toISOString(),
    };

    await getDb().collection('users').doc(userId).set(userData, { merge: true });
    return userData as UserProfile;
  }

  async updateUser(userId: string, data: Partial<UserProfile>): Promise<UserProfile | null> {
    await getDb().collection('users').doc(userId).update({
      ...data,
      updatedAt: new Date().toISOString(),
    });
    return this.getUser(userId);
  }

  async updateVerificationStatus(
    userId: string,
    status: 'pending' | 'verified' | 'rejected',
    documents?: { employmentLetterUrl?: string; idCardUrl?: string; payStubUrl?: string }
  ): Promise<UserProfile | null> {
    const updateData: Record<string, unknown> = {
      verificationStatus: status,
      updatedAt: new Date().toISOString(),
    };

    if (documents) {
      if (documents.employmentLetterUrl) updateData.employmentLetterUrl = documents.employmentLetterUrl;
      if (documents.idCardUrl) updateData.idCardUrl = documents.idCardUrl;
      if (documents.payStubUrl) updateData.payStubUrl = documents.payStubUrl;
    }

    if (status === 'verified') {
      updateData.isVerified = true;
    }

    await getDb().collection('users').doc(userId).update(updateData);
    return this.getUser(userId);
  }

  async updateVehicle(
    userId: string,
    vehicle: { carMake?: string; carModel?: string; carYear?: string; plateNumber?: string }
  ): Promise<UserProfile | null> {
    await getDb().collection('users').doc(userId).update({
      ...vehicle,
      updatedAt: new Date().toISOString(),
    });
    return this.getUser(userId);
  }

  async getVerifiedExecutives(excludeUid?: string): Promise<UserProfile[]> {
    const snapshot = await getDb().collection('users')
      .where('role', '==', 'executive')
      .where('isVerified', '==', true)
      .get();

    let users: UserProfile[] = snapshot.docs.map((d) => toUserProfile(d.id, d.data() as Record<string, unknown>));

    if (excludeUid) {
      users = users.filter((u: UserProfile) => u.uid !== excludeUid);
    }

    users.sort((a: UserProfile, b: UserProfile) => (b.rating || 0) - (a.rating || 0));
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

export const userService = new UserService();
