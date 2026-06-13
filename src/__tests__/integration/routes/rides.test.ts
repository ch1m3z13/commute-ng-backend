import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../helpers/testApp.js';
import { resetDatabase, seedUser, seedCommute, seedRide } from '../../setup.js';
import { makeToken } from '../../helpers/authHelpers.js';

const app = createTestApp();

describe('POST /api/rides', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates ride request', async () => {
    await seedUser({ uid: 'driver1', verificationStatus: 'verified', isVerified: 1 });
    await seedUser({ uid: 'passenger1' });
    const commuteId = await seedCommute({ id: 'c1', authorUid: 'driver1', seatsAvailable: 3 });
    const token = makeToken('passenger1');
    const res = await request(app)
      .post('/api/rides')
      .set('Authorization', `Bearer ${token}`)
      .send({ commuteId });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('returns 400 for self-request', async () => {
    await seedUser({ uid: 'u1', verificationStatus: 'verified', isVerified: 1 });
    const commuteId = await seedCommute({ id: 'c1', authorUid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .post('/api/rides')
      .set('Authorization', `Bearer ${token}`)
      .send({ commuteId });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/rides/:id/accept', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('accepts ride as driver', async () => {
    await seedUser({ uid: 'driver1' });
    await seedUser({ uid: 'passenger1' });
    const commuteId = await seedCommute({ id: 'c1', authorUid: 'driver1', seatsAvailable: 3 });
    const rideId = await seedRide({ id: 'r1', commuteId, driverUid: 'driver1', passengerUid: 'passenger1' });
    const token = makeToken('driver1');
    const res = await request(app)
      .patch(`/api/rides/${rideId}/accept`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');
  });

  it('returns 403 for non-driver', async () => {
    await seedUser({ uid: 'driver1' });
    await seedUser({ uid: 'passenger1' });
    const commuteId = await seedCommute({ id: 'c1', authorUid: 'driver1' });
    const rideId = await seedRide({ id: 'r1', commuteId, driverUid: 'driver1', passengerUid: 'passenger1' });
    const token = makeToken('passenger1');
    const res = await request(app)
      .patch(`/api/rides/${rideId}/accept`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/rides/:id/reject', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('rejects ride as driver', async () => {
    await seedUser({ uid: 'driver1' });
    await seedUser({ uid: 'passenger1' });
    const commuteId = await seedCommute({ id: 'c1', authorUid: 'driver1' });
    const rideId = await seedRide({ id: 'r1', commuteId, driverUid: 'driver1', passengerUid: 'passenger1' });
    const token = makeToken('driver1');
    const res = await request(app)
      .patch(`/api/rides/${rideId}/reject`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
  });
});

describe('PATCH /api/rides/:id/complete', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('marks ride complete', async () => {
    await seedUser({ uid: 'driver1' });
    await seedUser({ uid: 'passenger1' });
    const commuteId = await seedCommute({ id: 'c1', authorUid: 'driver1' });
    const rideId = await seedRide({ id: 'r1', commuteId, driverUid: 'driver1', passengerUid: 'passenger1' });
    const token = makeToken('driver1');
    const res = await request(app)
      .patch(`/api/rides/${rideId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });
});

describe('PATCH /api/rides/:id/cancel', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('cancels ride', async () => {
    await seedUser({ uid: 'driver1' });
    await seedUser({ uid: 'passenger1' });
    const commuteId = await seedCommute({ id: 'c1', authorUid: 'driver1' });
    const rideId = await seedRide({ id: 'r1', commuteId, driverUid: 'driver1', passengerUid: 'passenger1' });
    const token = makeToken('driver1');
    const res = await request(app)
      .patch(`/api/rides/${rideId}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });
});
