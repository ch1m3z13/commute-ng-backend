import 'dotenv/config';
import { Pool } from 'pg';
import { config } from './index.js';

declare module 'pg' {
  interface Pool {}
}

let pool: Pool;

// PostgreSQL folds unquoted identifiers to lowercase. Map lowercase keys back to camelCase.
const CAMEL_CASE_KEYS: Record<string, string> = {
  displayname: 'displayName',
  mobilenumber: 'mobileNumber',
  isverified: 'isVerified',
  verificationstatus: 'verificationStatus',
  employmentletterurl: 'employmentLetterUrl',
  idcardurl: 'idCardUrl',
  paystuburl: 'payStubUrl',
  phoneverified: 'phoneVerified',
  ninverified: 'ninVerified',
  idcardverified: 'idCardVerified',
  rejectionreason: 'rejectionReason',
  otpcode: 'otpCode',
  otpexpiresat: 'otpExpiresAt',
  emailverified: 'emailVerified',
  carmake: 'carMake',
  carmodel: 'carModel',
  caryear: 'carYear',
  platenumber: 'plateNumber',
  passwordhash: 'passwordHash',
  providerid: 'providerId',
  homeaddress: 'homeAddress',
  homelat: 'homeLat',
  homelng: 'homeLng',
  officeaddress: 'officeAddress',
  officelat: 'officeLat',
  officelng: 'officeLng',
  matchingpreferences: 'matchingPreferences',
  createdat: 'createdAt',
  updatedat: 'updatedAt',
  passwordresettoken: 'passwordResetToken',
  passwordresetexpiresat: 'passwordResetExpiresAt',
  authoruid: 'authorUid',
  authorname: 'authorName',
  authorphoto: 'authorPhoto',
  startpoint: 'startPoint',
  startlat: 'startLat',
  startlng: 'startLng',
  destlat: 'destLat',
  destlng: 'destLng',
  departuretime: 'departureTime',
  seatsavailable: 'seatsAvailable',
  seatsremaining: 'seatsRemaining',
  driveruid: 'driverUid',
  passengeruid: 'passengerUid',
  passengername: 'passengerName',
  passengerphoto: 'passengerPhoto',
  matchscore: 'matchScore',
  detourmeters: 'detourMeters',
  recipientuid: 'recipientUid',
  rideid: 'rideId',
  commuteid: 'commuteId',
  actoruid: 'actorUid',
  actorname: 'actorName',
  actorphoto: 'actorPhoto',
  pickupradiusmeters: 'pickupRadiusMeters',
  timeflexibilityminutes: 'timeFlexibilityMinutes',
  senderuid: 'senderUid',
  sendername: 'senderName',
  senderphoto: 'senderPhoto',
  raw_json: 'rawJson',
  token_hash: 'tokenHash',
  expires_at: 'expiresAt',
  created_at: 'createdAt',
  ride_id: 'rideId',
  rater_uid: 'raterUid',
  ratee_uid: 'rateeUid',
};

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[CAMEL_CASE_KEYS[key] ?? key] = value;
  }
  return normalized;
}

export function buildParameterizedQuery(sql: string, params: Record<string, unknown> | unknown[]): { text: string; values: unknown[] } {
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
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? normalizeRowKeys(row) : undefined;
  }

  async all(...args: unknown[]): Promise<Record<string, unknown>[]> {
    const p = args.length === 1 && !Array.isArray(args[0]) && typeof args[0] === 'object'
      ? buildParameterizedQuery(this.sql, args[0] as Record<string, unknown>)
      : buildParameterizedQuery(this.sql, args as unknown[]);
    const result = await pool.query(p.text, p.values);
    return result.rows.map(normalizeRowKeys);
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

  const useSsl = connectionString.includes('sslmode=require') || connectionString.includes('supabase');
  pool = new Pool({ connectionString, ssl: useSsl ? { rejectUnauthorized: false } : undefined });

  const createTableSQL = [
    `CREATE TABLE IF NOT EXISTS geocache (query TEXT PRIMARY KEY, lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL, raw_json TEXT, createdAt TIMESTAMP WITH TIME ZONE)`,
    `CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, displayName TEXT NOT NULL, email TEXT UNIQUE NOT NULL, mobileNumber TEXT, nin TEXT, company TEXT, isVerified INTEGER DEFAULT 0, rating DOUBLE PRECISION DEFAULT 5.0, role TEXT DEFAULT 'executive', photoURL TEXT, verificationStatus TEXT DEFAULT 'unverified', employmentLetterUrl TEXT, idCardUrl TEXT, payStubUrl TEXT, phoneVerified INTEGER DEFAULT 0, ninVerified INTEGER DEFAULT 0, idCardVerified INTEGER DEFAULT 0, rejectionReason TEXT, otpCode TEXT, otpExpiresAt TIMESTAMP WITH TIME ZONE, carMake TEXT, carModel TEXT, carYear TEXT, plateNumber TEXT, passwordHash TEXT, provider TEXT, providerId TEXT, homeAddress TEXT, homeLat DOUBLE PRECISION, homeLng DOUBLE PRECISION, officeAddress TEXT, officeLat DOUBLE PRECISION, officeLng DOUBLE PRECISION, matchingPreferences TEXT, createdAt TIMESTAMP WITH TIME ZONE, updatedAt TIMESTAMP WITH TIME ZONE)`,
    `CREATE TABLE IF NOT EXISTS commutes (id TEXT PRIMARY KEY, authorUid TEXT NOT NULL, authorName TEXT, authorPhoto TEXT, startPoint TEXT NOT NULL, startLat DOUBLE PRECISION, startLng DOUBLE PRECISION, destination TEXT NOT NULL, destLat DOUBLE PRECISION, destLng DOUBLE PRECISION, departureTime TEXT NOT NULL, seatsAvailable INTEGER NOT NULL, seatsRemaining INTEGER, carMake TEXT, carModel TEXT, carYear TEXT, plateNumber TEXT, type TEXT DEFAULT 'offer', status TEXT DEFAULT 'active', shift TEXT, recurring INTEGER DEFAULT 0, daysOfWeek TEXT, pickupRadiusMeters INTEGER DEFAULT 2000, timeFlexibilityMinutes INTEGER DEFAULT 30, createdAt TIMESTAMP WITH TIME ZONE, updatedAt TIMESTAMP WITH TIME ZONE)`,
    `CREATE TABLE IF NOT EXISTS rides (id TEXT PRIMARY KEY, commuteId TEXT NOT NULL, driverUid TEXT NOT NULL, passengerUid TEXT NOT NULL, passengerName TEXT, passengerPhoto TEXT, startPoint TEXT NOT NULL, destination TEXT NOT NULL, departureTime TEXT NOT NULL, seatsAvailable INTEGER, carMake TEXT, carModel TEXT, carYear TEXT, plateNumber TEXT, status TEXT DEFAULT 'pending', matchScore DOUBLE PRECISION, detourMeters DOUBLE PRECISION, createdAt TIMESTAMP WITH TIME ZONE, updatedAt TIMESTAMP WITH TIME ZONE)`,
    `CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, recipientUid TEXT NOT NULL, type TEXT NOT NULL, rideId TEXT, commuteId TEXT, actorUid TEXT NOT NULL, actorName TEXT NOT NULL, actorPhoto TEXT, startPoint TEXT, destination TEXT, departureTime TEXT, read INTEGER DEFAULT 0, createdAt TIMESTAMP WITH TIME ZONE)`,
    `CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, rideId TEXT NOT NULL, senderUid TEXT NOT NULL, senderName TEXT NOT NULL, senderPhoto TEXT, text TEXT NOT NULL, createdAt TIMESTAMP WITH TIME ZONE)`,
    `CREATE TABLE IF NOT EXISTS refresh_tokens (token_hash TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE, expires_at TIMESTAMP WITH TIME ZONE NOT NULL, created_at TIMESTAMP WITH TIME ZONE NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ride_ratings (id TEXT PRIMARY KEY, ride_id TEXT NOT NULL REFERENCES rides(id) ON DELETE CASCADE, rater_uid TEXT NOT NULL REFERENCES users(uid), rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), comment TEXT, created_at TIMESTAMP WITH TIME ZONE NOT NULL, UNIQUE(ride_id, rater_uid))`,
    `CREATE TABLE IF NOT EXISTS locations (id SERIAL PRIMARY KEY, displayName TEXT NOT NULL, lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL, category TEXT, createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)`,
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
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS passwordResetToken TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS passwordResetExpiresAt TIMESTAMP WITH TIME ZONE',
    'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_uid ON refresh_tokens(uid)',
    'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_locations_displayname ON locations(displayName)',
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
