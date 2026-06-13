import { beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeDatabase, getDb } from '../config/database.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-ci';
if (!process.env.SUPABASE_DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.SUPABASE_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/commute_ng_test';
}

const TABLES = ['chat_messages', 'notifications', 'rides', 'commutes', 'geocache', 'users'];

beforeAll(async () => {
  await initializeDatabase();
});

afterAll(async () => {
  for (const table of TABLES) {
    try {
      await getDb().prepare(`TRUNCATE TABLE ${table} CASCADE`).run();
    } catch { /* ignore */ }
  }
});

export async function resetDatabase() {
  for (const table of TABLES) {
    await getDb().prepare(`TRUNCATE TABLE ${table} CASCADE`).run();
  }
}

export async function seedUser(overrides: Partial<{
  uid: string; email: string; displayName: string; passwordHash: string;
  role: string; verificationStatus: string; isVerified: number;
}> = {}) {
  const uid = overrides.uid || 'test-user-' + Math.random().toString(36).slice(2);
  const now = new Date().toISOString();
  await getDb().prepare(`
    INSERT INTO users (uid, displayName, email, role, isVerified, verificationStatus, passwordHash, createdAt, updatedAt)
    VALUES (@uid, @displayName, @email, @role, @isVerified, @verificationStatus, @passwordHash, @now, @now)
  `).run({
    uid,
    displayName: overrides.displayName || 'Test User',
    email: overrides.email || `test-${uid}@example.com`,
    role: overrides.role || 'executive',
    isVerified: overrides.isVerified ?? 0,
    verificationStatus: overrides.verificationStatus || 'unverified',
    passwordHash: overrides.passwordHash || null,
    now,
  });
  return uid;
}

export async function seedCommute(overrides: Partial<{
  id: string; authorUid: string; type: string; status: string;
  shift: string; seatsAvailable: number;
}> = {}) {
  const id = overrides.id || 'test-commute-' + Math.random().toString(36).slice(2);
  const now = new Date().toISOString();
  await getDb().prepare(`
    INSERT INTO commutes (id, authorUid, startPoint, startLat, startLng, destination, destLat, destLng, departureTime, seatsAvailable, seatsRemaining, type, status, shift, createdAt, updatedAt)
    VALUES (@id, @authorUid, 'Test Start', 9.0579, 7.4951, 'Test End', 9.0650, 7.4914, '08:00 AM', @seats, @seats, @type, @status, @shift, @now, @now)
  `).run({
    id,
    authorUid: overrides.authorUid || 'test-user',
    seats: overrides.seatsAvailable ?? 3,
    type: overrides.type || 'offer',
    status: overrides.status || 'active',
    shift: overrides.shift || 'morning',
    now,
  });
  return id;
}

export async function seedRide(overrides: Partial<{
  id: string; commuteId: string; driverUid: string; passengerUid: string; status: string;
}> = {}) {
  const id = overrides.id || 'test-ride-' + Math.random().toString(36).slice(2);
  const now = new Date().toISOString();
  await getDb().prepare(`
    INSERT INTO rides (id, commuteId, driverUid, passengerUid, passengerName, startPoint, destination, departureTime, seatsAvailable, status, createdAt, updatedAt)
    VALUES (@id, @commuteId, @driverUid, @passengerUid, 'Test Passenger', 'Start', 'End', '08:00 AM', 1, @status, @now, @now)
  `).run({
    id,
    commuteId: overrides.commuteId || 'test-commute',
    driverUid: overrides.driverUid || 'driver-uid',
    passengerUid: overrides.passengerUid || 'passenger-uid',
    status: overrides.status || 'pending',
    now,
  });
  return id;
}

export async function seedNotification(overrides: Partial<{
  id: string; recipientUid: string; type: string; actorUid: string;
}> = {}) {
  const id = overrides.id || 'test-notif-' + Math.random().toString(36).slice(2);
  const now = new Date().toISOString();
  await getDb().prepare(`
    INSERT INTO notifications (id, recipientUid, type, rideId, actorUid, actorName, startPoint, destination, departureTime, read, createdAt)
    VALUES (@id, @recipientUid, @type, 'test-ride', @actorUid, 'Test Actor', 'Start', 'End', '08:00 AM', 0, @now)
  `).run({
    id,
    recipientUid: overrides.recipientUid || 'test-user',
    type: overrides.type || 'ride_request',
    actorUid: overrides.actorUid || 'actor-uid',
    now,
  });
  return id;
}
