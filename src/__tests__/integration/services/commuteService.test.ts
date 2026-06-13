import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, seedUser, seedCommute } from '../../setup.js';
import { commuteService } from '../../../services/commuteService.js';

describe('commuteService', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('getCommute', () => {
    it('returns commute by id', async () => {
      const id = await seedCommute({ id: 'c1', authorUid: 'u1' });
      const commute = await commuteService.getCommute(id);
      expect(commute).not.toBeNull();
      expect(commute!.id).toBe('c1');
    });

    it('returns null for non-existent id', async () => {
      const commute = await commuteService.getCommute('nonexistent');
      expect(commute).toBeNull();
    });
  });

  describe('getCommutes', () => {
    it('filters by authorUid', async () => {
      await seedCommute({ id: 'c1', authorUid: 'u1' });
      await seedCommute({ id: 'c2', authorUid: 'u2' });
      const result = await commuteService.getCommutes({ authorUid: 'u1' });
      expect(result).toHaveLength(1);
      expect(result[0].authorUid).toBe('u1');
    });

    it('filters by type', async () => {
      await seedCommute({ id: 'c1', type: 'offer' });
      await seedCommute({ id: 'c2', type: 'request' });
      const result = await commuteService.getCommutes({ type: 'offer' });
      expect(result).toHaveLength(1);
    });

    it('filters by status', async () => {
      await seedCommute({ id: 'c1', status: 'active' });
      await seedCommute({ id: 'c2', status: 'cancelled' });
      const result = await commuteService.getCommutes({ status: 'active' });
      expect(result).toHaveLength(1);
    });
  });

  describe('updateCommute', () => {
    it('updates commute by owner', async () => {
      const id = await seedCommute({ id: 'c1', authorUid: 'u1' });
      const updated = await commuteService.updateCommute(id, 'u1', { departureTime: '09:00 AM' });
      expect(updated).not.toBeNull();
      expect(updated!.departureTime).toBe('09:00 AM');
    });

    it('throws for non-owner', async () => {
      const id = await seedCommute({ id: 'c1', authorUid: 'u1' });
      await expect(commuteService.updateCommute(id, 'u2', { departureTime: '09:00 AM' }))
        .rejects.toThrow('Unauthorized');
    });
  });

  describe('deleteCommute', () => {
    it('deletes commute by owner', async () => {
      const id = await seedCommute({ id: 'c1', authorUid: 'u1' });
      const result = await commuteService.deleteCommute(id, 'u1');
      expect(result).toBe(true);
      const commute = await commuteService.getCommute(id);
      expect(commute).toBeNull();
    });

    it('throws for non-owner', async () => {
      const id = await seedCommute({ id: 'c1', authorUid: 'u1' });
      await expect(commuteService.deleteCommute(id, 'u2'))
        .rejects.toThrow('Unauthorized');
    });
  });

  describe('decrementSeats / incrementSeats', () => {
    it('decrements seatsRemaining', async () => {
      const id = await seedCommute({ id: 'c1', seatsAvailable: 3 });
      await commuteService.decrementSeats(id);
      const commute = await commuteService.getCommute(id);
      expect(commute!.seatsRemaining).toBe(2);
    });

    it('increments seatsRemaining', async () => {
      const id = await seedCommute({ id: 'c1', seatsAvailable: 3 });
      await commuteService.decrementSeats(id);
      await commuteService.incrementSeats(id);
      const commute = await commuteService.getCommute(id);
      expect(commute!.seatsRemaining).toBe(3);
    });
  });
});
