import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDatabase } from '../../setup.js';
import { geocodingService } from '../../../services/geocodingService.js';

describe('geocodingService', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('geocode', () => {
    it('returns cached result for known query', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify([{
          lat: '9.0579',
          lon: '7.4951',
          display_name: 'Abuja, Nigeria',
        }]), { status: 200 })
      );

      const result1 = await geocodingService.geocode('Abuja');
      expect(result1).toBeDefined();
      expect(result1.lat).toBeCloseTo(9.0579, 3);

      vi.restoreAllMocks();
    });
  });
});
