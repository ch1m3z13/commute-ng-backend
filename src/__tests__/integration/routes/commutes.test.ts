import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../helpers/testApp.js';
import { resetDatabase, seedUser, seedCommute } from '../../setup.js';
import { makeToken } from '../../helpers/authHelpers.js';

const app = createTestApp();

describe('GET /api/commutes', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns commutes for authenticated user', async () => {
    await seedUser({ uid: 'u1' });
    await seedCommute({ id: 'c1', authorUid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .get('/api/commutes')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('filters by type', async () => {
    await seedUser({ uid: 'u1' });
    await seedCommute({ id: 'c1', type: 'offer' });
    await seedCommute({ id: 'c2', type: 'request' });
    const token = makeToken('u1');
    const res = await request(app)
      .get('/api/commutes?type=offer')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('GET /api/commutes/match', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns 400 for missing params', async () => {
    const token = makeToken('u1');
    const res = await request(app)
      .get('/api/commutes/match')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/commutes', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns 403 for unverified user', async () => {
    await seedUser({ uid: 'u1', verificationStatus: 'unverified' });
    const token = makeToken('u1');
    const res = await request(app)
      .post('/api/commutes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        startPoint: 'Start',
        destination: 'End',
        departureTime: '08:00 AM',
        seatsAvailable: 2,
        startLat: 9.0579,
        startLng: 7.4951,
        destLat: 9.0650,
        destLng: 7.4914,
      });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/commutes/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns commute by id', async () => {
    await seedUser({ uid: 'u1' });
    await seedCommute({ id: 'c1', authorUid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .get('/api/commutes/c1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('c1');
  });

  it('returns 404 for non-existent', async () => {
    const token = makeToken('u1');
    const res = await request(app)
      .get('/api/commutes/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/commutes/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('deletes commute by owner', async () => {
    await seedUser({ uid: 'u1' });
    await seedCommute({ id: 'c1', authorUid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .delete('/api/commutes/c1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it('returns 403 for non-owner', async () => {
    await seedUser({ uid: 'u1' });
    await seedCommute({ id: 'c1', authorUid: 'u1' });
    const token = makeToken('u2');
    const res = await request(app)
      .delete('/api/commutes/c1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
