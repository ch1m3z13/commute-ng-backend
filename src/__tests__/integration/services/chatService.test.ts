import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, seedRide } from '../../setup.js';
import { chatService } from '../../../services/chatService.js';

describe('chatService', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('getMessages', () => {
    it('returns messages for ride', async () => {
      const rideId = await seedRide({ id: 'r1', driverUid: 'd1', passengerUid: 'p1' });
      await chatService.sendMessage(rideId, 'd1', 'Driver', null, 'Hello');
      const messages = await chatService.getMessages(rideId);
      expect(messages).toHaveLength(1);
      expect(messages[0].text).toBe('Hello');
    });

    it('orders by createdAt ASC', async () => {
      const rideId = await seedRide({ id: 'r1', driverUid: 'd1', passengerUid: 'p1' });
      await chatService.sendMessage(rideId, 'd1', 'Driver', null, 'First');
      await chatService.sendMessage(rideId, 'p1', 'Passenger', null, 'Second');
      const messages = await chatService.getMessages(rideId);
      expect(messages[0].text).toBe('First');
      expect(messages[1].text).toBe('Second');
    });
  });

  describe('sendMessage', () => {
    it('creates message with correct fields', async () => {
      const rideId = await seedRide({ id: 'r1', driverUid: 'd1', passengerUid: 'p1' });
      const msg = await chatService.sendMessage(rideId, 'd1', 'Driver', null, 'Test message');
      expect(msg.id).toBeDefined();
      expect(msg.rideId).toBe(rideId);
      expect(msg.senderUid).toBe('d1');
      expect(msg.text).toBe('Test message');
    });
  });

  describe('canAccessChat', () => {
    it('returns true for driver', async () => {
      const rideId = await seedRide({ id: 'r1', driverUid: 'd1', passengerUid: 'p1' });
      expect(await chatService.canAccessChat(rideId, 'd1')).toBe(true);
    });

    it('returns true for passenger', async () => {
      const rideId = await seedRide({ id: 'r1', driverUid: 'd1', passengerUid: 'p1' });
      expect(await chatService.canAccessChat(rideId, 'p1')).toBe(true);
    });

    it('returns false for unrelated user', async () => {
      const rideId = await seedRide({ id: 'r1', driverUid: 'd1', passengerUid: 'p1' });
      expect(await chatService.canAccessChat(rideId, 'outsider')).toBe(false);
    });

    it('returns false for non-existent ride', async () => {
      expect(await chatService.canAccessChat('nonexistent', 'd1')).toBe(false);
    });
  });
});
