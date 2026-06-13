import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, seedUser, seedCommute, seedRide } from '../../setup.js';
import { rideService } from '../../../services/rideService.js';

describe('rideService', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('getRide', () => {
    it('returns ride by id', async () => {
      const commuteId = await seedCommute({ id: 'c1', authorUid: 'driver1' });
      const rideId = await seedRide({ id: 'r1', commuteId, driverUid: 'driver1', passengerUid: 'pass1' });
      const ride = await rideService.getRide(rideId);
      expect(ride).not.toBeNull();
      expect(ride!.id).toBe('r1');
    });

    it('returns null for non-existent id', async () => {
      const ride = await rideService.getRide('nonexistent');
      expect(ride).toBeNull();
    });
  });

  describe('acceptRide', () => {
    it('sets ride status to accepted', async () => {
      const commuteId = await seedCommute({ id: 'c1', authorUid: 'driver1', seatsAvailable: 3 });
      const rideId = await seedRide({ id: 'r1', commuteId, driverUid: 'driver1', passengerUid: 'pass1' });
      const ride = await rideService.acceptRide(rideId, 'driver1');
      expect(ride!.status).toBe('accepted');
    });

    it('throws for non-driver', async () => {
      const commuteId = await seedCommute({ id: 'c1', authorUid: 'driver1' });
      const rideId = await seedRide({ id: 'r1', commuteId, driverUid: 'driver1', passengerUid: 'pass1' });
      await expect(rideService.acceptRide(rideId, 'pass1'))
        .rejects.toThrow('Only the driver can accept rides');
    });
  });

  describe('rejectRide', () => {
    it('sets ride status to rejected', async () => {
      const commuteId = await seedCommute({ id: 'c1', authorUid: 'driver1' });
      const rideId = await seedRide({ id: 'r1', commuteId, driverUid: 'driver1', passengerUid: 'pass1' });
      const ride = await rideService.rejectRide(rideId, 'driver1');
      expect(ride!.status).toBe('rejected');
    });
  });

  describe('completeRide', () => {
    it('sets ride status to completed', async () => {
      const commuteId = await seedCommute({ id: 'c1', authorUid: 'driver1' });
      const rideId = await seedRide({ id: 'r1', commuteId, driverUid: 'driver1', passengerUid: 'pass1' });
      const ride = await rideService.completeRide(rideId, 'driver1');
      expect(ride!.status).toBe('completed');
    });

    it('throws for non-participant', async () => {
      const commuteId = await seedCommute({ id: 'c1', authorUid: 'driver1' });
      const rideId = await seedRide({ id: 'r1', commuteId, driverUid: 'driver1', passengerUid: 'pass1' });
      await expect(rideService.completeRide(rideId, 'outsider'))
        .rejects.toThrow('Only participants');
    });
  });

  describe('cancelRide', () => {
    it('sets ride status to cancelled', async () => {
      const commuteId = await seedCommute({ id: 'c1', authorUid: 'driver1' });
      const rideId = await seedRide({ id: 'r1', commuteId, driverUid: 'driver1', passengerUid: 'pass1' });
      const ride = await rideService.cancelRide(rideId, 'driver1');
      expect(ride!.status).toBe('cancelled');
    });
  });
});
