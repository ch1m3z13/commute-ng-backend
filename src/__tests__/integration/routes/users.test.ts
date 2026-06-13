import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../helpers/testApp.js';
import { resetDatabase, seedUser } from '../../setup.js';
import { makeToken, hashPw } from '../../helpers/authHelpers.js';

const app = createTestApp();

describe('POST /api/users/register', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('registers new user and returns token', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ email: 'new@test.com', password: 'password123', displayName: 'New User' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.uid).toBeDefined();
  });

  it('returns 409 for duplicate email', async () => {
    await seedUser({ uid: 'u1', email: 'dup@test.com' });
    const res = await request(app)
      .post('/api/users/register')
      .send({ email: 'dup@test.com', password: 'password123', displayName: 'Dup' });
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ email: 'not-an-email', password: 'password123', displayName: 'Test' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for short password', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ email: 'test@test.com', password: 'short', displayName: 'Test' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/users/login', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('logs in with correct credentials', async () => {
    const pw = await hashPw('password123');
    await seedUser({ uid: 'u1', email: 'login@test.com', passwordHash: pw });
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: 'login@test.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const pw = await hashPw('password123');
    await seedUser({ uid: 'u1', email: 'login@test.com', passwordHash: pw });
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: 'login@test.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: 'nobody@test.com', password: 'password123' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/users/me', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns user profile for authenticated user', async () => {
    await seedUser({ uid: 'u1', email: 'me@test.com' });
    const token = makeToken('u1', 'me@test.com');
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.uid).toBe('u1');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/users/me', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('updates displayName', async () => {
    await seedUser({ uid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe('Updated Name');
  });
});

describe('GET /api/users/:uid', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns user by uid', async () => {
    await seedUser({ uid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .get('/api/users/u1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.uid).toBe('u1');
  });

  it('returns 404 for non-existent user', async () => {
    const token = makeToken('u1');
    const res = await request(app)
      .get('/api/users/nobody')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
