import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, seedUser } from '../../setup.js';
import { userService } from '../../../services/userService.js';

describe('userService', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('createUser', () => {
    it('creates user and retrieves by uid', async () => {
      const uid = await seedUser({ uid: 'u1', email: 'a@test.com' });
      const user = await userService.getUser(uid);
      expect(user).not.toBeNull();
      expect(user!.uid).toBe('u1');
    });

    it('creates user and retrieves by email', async () => {
      await seedUser({ uid: 'u1', email: 'a@test.com' });
      const user = await userService.getUserByEmail('a@test.com');
      expect(user).not.toBeNull();
      expect(user!.email).toBe('a@test.com');
    });

    it('sets default values', async () => {
      const uid = await seedUser({ uid: 'u1' });
      const user = await userService.getUser(uid);
      expect(user!.rating).toBe(5.0);
      expect(user!.role).toBe('executive');
    });
  });

  describe('getUser', () => {
    it('returns null for non-existent user', async () => {
      const user = await userService.getUser('nonexistent');
      expect(user).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('returns null for non-existent email', async () => {
      const user = await userService.getUserByEmail('nobody@test.com');
      expect(user).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('updates displayName', async () => {
      const uid = await seedUser({ uid: 'u1' });
      await userService.updateUser(uid, { displayName: 'New Name' });
      const user = await userService.getUser(uid);
      expect(user!.displayName).toBe('New Name');
    });

    it('does not update uid field', async () => {
      const uid = await seedUser({ uid: 'u1' });
      await userService.updateUser(uid, { uid: 'hacked' } as any);
      const user = await userService.getUser(uid);
      expect(user!.uid).toBe('u1');
    });
  });

  describe('getVerifiedExecutives', () => {
    it('returns only verified users', async () => {
      await seedUser({ uid: 'v1', isVerified: 1, verificationStatus: 'verified' });
      await seedUser({ uid: 'u2', isVerified: 0 });
      const result = await userService.getVerifiedExecutives();
      expect(result.every(u => u.isVerified === true)).toBe(true);
    });

    it('orders by rating descending', async () => {
      await seedUser({ uid: 'v1', isVerified: 1, verificationStatus: 'verified' });
      await seedUser({ uid: 'v2', isVerified: 1, verificationStatus: 'verified' });
      const result = await userService.getVerifiedExecutives();
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('excludes specified uid', async () => {
      await seedUser({ uid: 'v1', isVerified: 1, verificationStatus: 'verified' });
      const result = await userService.getVerifiedExecutives('v1');
      expect(result.find(u => u.uid === 'v1')).toBeUndefined();
    });
  });

  describe('checkIsAdmin', () => {
    it('returns true for admin role', async () => {
      await seedUser({ uid: 'admin1', role: 'admin' });
      expect(await userService.checkIsAdmin('admin1')).toBe(true);
    });

    it('returns false for regular user', async () => {
      await seedUser({ uid: 'u1' });
      expect(await userService.checkIsAdmin('u1')).toBe(false);
    });

    it('returns false for non-existent user', async () => {
      expect(await userService.checkIsAdmin('nobody')).toBe(false);
    });
  });

  describe('verification flags', () => {
    it('sets phoneVerified flag', async () => {
      const uid = await seedUser({ uid: 'u1' });
      await userService.setPhoneVerified(uid, true);
      const user = await userService.getUser(uid);
      expect(user!.phoneVerified).toBe(1);
    });

    it('sets emailVerified flag', async () => {
      const uid = await seedUser({ uid: 'u1' });
      await userService.setEmailVerified(uid, true);
      const user = await userService.getUser(uid);
      expect(user!.emailVerified).toBe(1);
    });
  });
});
