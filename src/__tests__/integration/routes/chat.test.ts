import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../helpers/testApp.js';
import { resetDatabase, seedUser, seedRide } from '../../setup.js';
import { makeToken } from '../../helpers/authHelpers.js';

const app = createTestApp();

describe('GET /api/chat/:rideId', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns messages for ride participant', async () => {
    await seedUser({ uid: 'driver1' });
    await seedUser({ uid: 'passenger1' });
    const rideId = await seedRide({ id: 'r1', driverUid: 'driver1', passengerUid: 'passenger1' });
    const token = makeToken('driver1');
    const res = await request(app)
      .get(`/api/chat/${rideId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages || res.body)).toBe(true);
  });

  it('returns 403 for non-participant', async () => {
    await seedUser({ uid: 'driver1' });
    await seedUser({ uid: 'passenger1' });
    await seedUser({ uid: 'outsider' });
    const rideId = await seedRide({ id: 'r1', driverUid: 'driver1', passengerUid: 'passenger1' });
    const token = makeToken('outsider');
    const res = await request(app)
      .get(`/api/chat/${rideId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/chat/:rideId', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('sends message', async () => {
    await seedUser({ uid: 'driver1' });
    await seedUser({ uid: 'passenger1' });
    const rideId = await seedRide({ id: 'r1', driverUid: 'driver1', passengerUid: 'passenger1' });
    const token = makeToken('driver1');
    const res = await request(app)
      .post(`/api/chat/${rideId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Hello!' });
    expect(res.status).toBe(201);
    expect(res.body.text).toBe('Hello!');
  });

  it('returns 400 for empty text', async () => {
    await seedUser({ uid: 'driver1' });
    await seedUser({ uid: 'passenger1' });
    const rideId = await seedRide({ id: 'r1', driverUid: 'driver1', passengerUid: 'passenger1' });
    const token = makeToken('driver1');
    const res = await request(app)
      .post(`/api/chat/${rideId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: '' });
    expect(res.status).toBe(400);
  });
});
