import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../helpers/testApp.js';
import { resetDatabase } from '../../setup.js';

const app = createTestApp();

describe('GET /api/auth/:provider', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('redirects to Google OAuth URL', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-id';
    const res = await request(app).get('/api/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
  });

  it('redirects to LinkedIn OAuth URL', async () => {
    process.env.LINKEDIN_CLIENT_ID = 'test-id';
    const res = await request(app).get('/api/auth/linkedin');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('linkedin.com');
  });

  it('redirects to TikTok OAuth URL', async () => {
    process.env.TIKTOK_CLIENT_ID = 'test-id';
    const res = await request(app).get('/api/auth/tiktok');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('tiktok.com');
  });

  it('returns 400 for unsupported provider', async () => {
    const res = await request(app).get('/api/auth/facebook');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/:provider/callback', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns 400 for missing code', async () => {
    const res = await request(app).get('/api/auth/google/callback?state=test');
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid state', async () => {
    const res = await request(app).get('/api/auth/google/callback?code=test&state=invalid');
    expect(res.status).toBe(400);
  });
});
