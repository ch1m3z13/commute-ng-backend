import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../helpers/testApp.js';
import { resetDatabase } from '../../setup.js';

vi.mock('../../../config/index.js', () => ({
  config: {
    cognitoDomain: 'test-pool.auth.eu-west-1.amazoncognito.com',
    cognitoClientId: 'test-client-id',
    cognitoClientSecret: 'test-secret',
    cognitoRegion: 'eu-west-1',
    oauthCallbackBaseUrl: 'http://localhost:3001/api/auth',
    frontendBaseUrl: 'http://localhost:3000',
  },
}));

const app = createTestApp();

describe('GET /api/auth/:provider', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('redirects to Cognito authorize URL', async () => {
    const res = await request(app).get('/api/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('amazoncognito.com');
    expect(res.headers.location).toContain('/oauth2/authorize');
    expect(res.headers.location).toContain('client_id=test-client-id');
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
