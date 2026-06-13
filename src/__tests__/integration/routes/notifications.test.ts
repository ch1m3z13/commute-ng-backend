import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../helpers/testApp.js';
import { resetDatabase, seedUser, seedNotification } from '../../setup.js';
import { makeToken } from '../../helpers/authHelpers.js';

const app = createTestApp();

describe('GET /api/notifications', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns notifications for user', async () => {
    await seedUser({ uid: 'u1' });
    await seedNotification({ recipientUid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notifications)).toBe(true);
  });
});

describe('GET /api/notifications/unread-count', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns unread count', async () => {
    await seedUser({ uid: 'u1' });
    await seedNotification({ recipientUid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('marks notification as read', async () => {
    await seedUser({ uid: 'u1' });
    const id = await seedNotification({ recipientUid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .patch(`/api/notifications/${id}/read`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});

describe('DELETE /api/notifications/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('deletes notification', async () => {
    await seedUser({ uid: 'u1' });
    const id = await seedNotification({ recipientUid: 'u1' });
    const token = makeToken('u1');
    const res = await request(app)
      .delete(`/api/notifications/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});
