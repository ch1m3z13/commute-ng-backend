import 'dotenv/config';
import { Pool } from 'pg';
import { config } from './index.js';

declare module 'pg' {
  interface Pool {}
}

let pool: Pool;

function buildParameterizedQuery(sql: string, params: Record<string, unknown> | unknown[]): { text: string; values: unknown[] } {
  if (Array.isArray(params)) {
    let index = 1;
    const text = sql.replace(/\?/g, () => `$${index++}`);
    return { text, values: params };
  }
  const names = Object.keys(params);
  let position = 1;
  const values: unknown[] = [];
  const text = sql.replace(/@(\w+)/g, (_, name) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) {
      throw new Error('Missing parameter: ' + name);
    }
    values.push((params as Record<string, unknown>)[name]);
    return '$' + position++;
  });
  return { text, values };
}

class Statement {
  constructor(private sql: string) {}

  async run(...args: unknown[]): Promise<unknown> {
    const p = args.length === 1 && !Array.isArray(args[0]) && typeof args[0] === 'object'
      ? buildParameterizedQuery(this.sql, args[0] as Record<string, unknown>)
      : buildParameterizedQuery(this.sql, args as unknown[]);
    return (await pool.query(p.text, p.values));
  }

  async get(...args: unknown[]): Promise<Record<string, unknown> | undefined> {
    const p = args.length === 1 && !Array.isArray(args[0]) && typeof args[0] === 'object'
      ? buildParameterizedQuery(this.sql, args[0] as Record<string, unknown>)
      : buildParameterizedQuery(this.sql, args as unknown[]);
    const result = await pool.query(p.text, p.values);
    return result.rows[0] as Record<string, unknown> | undefined;
  }

  async all(...args: unknown[]): Promise<Record<string, unknown>[]> {
    const p = args.length === 1 && !Array.isArray(args[0]) && typeof args[0] === 'object'
      ? buildParameterizedQuery(this.sql, args[0] as Record<string, unknown>)
      : buildParameterizedQuery(this.sql, args as unknown[]);
    const result = await pool.query(p.text, p.values);
    return result.rows as Record<string, unknown>[];
  }
}

class Database {
  prepare(sql: string) {
    return new Statement(sql);
  }
}

export async function initializeDatabase(): Promise<void> {
  const connectionString = config.databaseUrl;
  if (!connectionString) {
    throw new Error('Supabase database URL is required in SUPABASE_DATABASE_URL or DATABASE_URL');
  }

  pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  const createTableSQL = [
    `CREATE TABLE IF NOT EXISTS geocache (query TEXT PRIMARY KEY, lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL, raw_json TEXT, createdAt TIMESTAMP WITH TIME ZONE)`,
    `CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, displayName TEXT NOT NULL, email TEXT UNIQUE NOT NULL, mobileNumber TEXT, nin TEXT, company TEXT, isVerified INTEGER DEFAULT 0, rating DOUBLE PRECISION DEFAULT 5.0, role TEXT DEFAULT 'executive', photoURL TEXT, verificationStatus TEXT DEFAULT 'unverified', employmentLetterUrl TEXT, idCardUrl TEXT, payStubUrl TEXT, phoneVerified INTEGER DEFAULT 0, ninVerified INTEGER DEFAULT 0, idCardVerified INTEGER DEFAULT 0, rejectionReason TEXT, otpCode TEXT, otpExpiresAt TIMESTAMP WITH TIME ZONE, carMake TEXT, carModel TEXT, carYear TEXT, plateNumber TEXT, passwordHash TEXT, provider TEXT, providerId TEXT, homeAddress TEXT, homeLat DOUBLE PRECISION, homeLng DOUBLE PRECISION, officeAddress TEXT, officeLat DOUBLE PRECISION, officeLng DOUBLE PRECISION, matchingPreferences TEXT, createdAt TIMESTAMP WITH TIME ZONE, updatedAt TIMESTAMP WITH TIME ZONE)`,
    `CREATE TABLE IF NOT EXISTS commutes (id TEXT PRIMARY KEY, authorUid TEXT NOT NULL, authorName TEXT, authorPhoto TEXT, startPoint TEXT NOT NULL, startLat DOUBLE PRECISION, startLng DOUBLE PRECISION, destination TEXT NOT NULL, destLat DOUBLE PRECISION, destLng DOUBLE PRECISION, departureTime TEXT NOT NULL, seatsAvailable INTEGER NOT NULL, seatsRemaining INTEGER, carMake TEXT, carModel TEXT, carYear TEXT, plateNumber TEXT, type TEXT DEFAULT 'offer', status TEXT DEFAULT 'active', shift TEXT, recurring INTEGER DEFAULT 0, daysOfWeek TEXT, pickupRadiusMeters INTEGER DEFAULT 2000, timeFlexibilityMinutes INTEGER DEFAULT 30, createdAt TIMESTAMP WITH TIME ZONE, updatedAt TIMESTAMP WITH TIME ZONE)`,
    `CREATE TABLE IF NOT EXISTS rides (id TEXT PRIMARY KEY, commuteId TEXT NOT NULL, driverUid TEXT NOT NULL, passengerUid TEXT NOT NULL, passengerName TEXT, passengerPhoto TEXT, startPoint TEXT NOT NULL, destination TEXT NOT NULL, departureTime TEXT NOT NULL, seatsAvailable INTEGER, carMake TEXT, carModel TEXT, carYear TEXT, plateNumber TEXT, status TEXT DEFAULT 'pending', matchScore DOUBLE PRECISION, detourMeters DOUBLE PRECISION, createdAt TIMESTAMP WITH TIME ZONE, updatedAt TIMESTAMP WITH TIME ZONE)`,
    `CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, recipientUid TEXT NOT NULL, type TEXT NOT NULL, rideId TEXT, commuteId TEXT, actorUid TEXT NOT NULL, actorName TEXT NOT NULL, actorPhoto TEXT, startPoint TEXT, destination TEXT, departureTime TEXT, read INTEGER DEFAULT 0, createdAt TIMESTAMP WITH TIME ZONE)`,
    `CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, rideId TEXT NOT NULL, senderUid TEXT NOT NULL, senderName TEXT NOT NULL, senderPhoto TEXT, text TEXT NOT NULL, createdAt TIMESTAMP WITH TIME ZONE)`,
  ];

  for (const sql of createTableSQL) {
    await pool.query(sql);
  }

  // Migration: add new verification columns to existing users table (additive, safe)
  const migrationColumns = [
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS phoneVerified INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS ninVerified INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS idCardVerified INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS rejectionReason TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS otpCode TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS otpExpiresAt TIMESTAMP WITH TIME ZONE',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS emailVerified INTEGER DEFAULT 0',
  ];
  for (const sql of migrationColumns) {
    try {
      await pool.query(sql);
    } catch (err: unknown) {
      if (err instanceof Error && !err.message.includes('already exists')) {
        console.warn('[Migration] ' + sql + ' - ' + err.message);
      }
    }
  }
}

export function getDb(): Database {
  if (!pool) {
    throw new Error('Database pool has not been initialized. Call initializeDatabase() first.');
  }
  return new Database();
}
