import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../helpers/testApp.js';
import { resetDatabase, seedUser } from '../../setup.js';
import { makeToken } from '../../helpers/authHelpers.js';

const app = createTestApp();

describe('GET /api/verification/status', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns verification status', async () => {
    await seedUser({ uid: 'u1', verificationStatus: 'unverified' });
    const token = makeToken('u1');
    const res = await request(app)
      .get('/api/verification/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });
});

describe('POST /api/verification/nin/validate', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('validates and stores NIN', async () => {
    await seedUser({ uid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .post('/api/verification/nin/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ nin: '12345678901' });
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid format', async () => {
    await seedUser({ uid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .post('/api/verification/nin/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ nin: '12345' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/verification/otp/send', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('generates and stores OTP', async () => {
    await seedUser({ uid: 'u1', email: 'otp@test.com' });
    const token = makeToken('u1');
    const res = await request(app)
      .post('/api/verification/otp/send')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/verification/otp/verify', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns 400 for wrong OTP', async () => {
    await seedUser({ uid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .post('/api/verification/otp/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/verification/id-card/submit', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('submits ID card URL', async () => {
    await seedUser({ uid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .post('/api/verification/id-card/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ idCardUrl: 'https://example.com/id.jpg' });
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid URL', async () => {
    await seedUser({ uid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .post('/api/verification/id-card/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ idCardUrl: 'not-a-url' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/verification/admin/:uid', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns 403 for non-admin', async () => {
    await seedUser({ uid: 'u1' });
    await seedUser({ uid: 'admin1', role: 'admin', verificationStatus: 'verified' });
    const token = makeToken('u1');
    const res = await request(app)
      .patch('/api/verification/admin/u1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'verified' });
    expect(res.status).toBe(403);
  });
});
