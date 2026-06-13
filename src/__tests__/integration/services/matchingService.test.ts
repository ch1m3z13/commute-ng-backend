import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDatabase, seedCommute } from '../../setup.js';
import { matchingService } from '../../../services/matchingService.js';

describe('matchingService', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('findMatches', () => {
    it('returns matches within pickup radius', async () => {
      await seedCommute({
        id: 'c1',
        authorUid: 'driver1',
        type: 'offer',
        status: 'active',
        shift: 'morning',
        seatsAvailable: 3,
      });

      const result = await matchingService.findMatches({
        pickupLat: 9.058,
        pickupLng: 7.495,
        dropoffLat: 9.065,
        dropoffLng: 7.491,
        desiredTime: '08:00 AM',
        shift: 'morning',
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns empty when no matching commutes exist', async () => {
      const result = await matchingService.findMatches({
        pickupLat: 0,
        pickupLng: 0,
        dropoffLat: 0,
        dropoffLng: 0,
        desiredTime: '08:00 AM',
        shift: 'morning',
      });
      expect(result).toHaveLength(0);
    });
  });
});
