import 'dotenv/config';
import DatabaseConstructor from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';

let db: DatabaseConstructor.Database;

export function initializeDatabase(): void {
  const dbPath = process.env.DB_PATH || './commute-ng.db';
  const resolved = path.resolve(dbPath);

  // Ensure directory exists
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new DatabaseConstructor(resolved);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      displayName TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      mobileNumber TEXT,
      nin TEXT,
      company TEXT,
      isVerified INTEGER DEFAULT 0,
      rating REAL DEFAULT 5.0,
      role TEXT DEFAULT 'executive',
      photoURL TEXT,
      verificationStatus TEXT DEFAULT 'unverified',
      employmentLetterUrl TEXT,
      idCardUrl TEXT,
      payStubUrl TEXT,
      carMake TEXT,
      carModel TEXT,
      carYear TEXT,
      plateNumber TEXT,
      passwordHash TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS commutes (
      id TEXT PRIMARY KEY,
      authorUid TEXT NOT NULL,
      authorName TEXT,
      authorPhoto TEXT,
      startPoint TEXT NOT NULL,
      destination TEXT NOT NULL,
      departureTime TEXT NOT NULL,
      seatsAvailable INTEGER NOT NULL,
      carMake TEXT,
      carModel TEXT,
      carYear TEXT,
      plateNumber TEXT,
      type TEXT DEFAULT 'offer',
      status TEXT DEFAULT 'active',
      shift TEXT,
      recurring INTEGER DEFAULT 0,
      daysOfWeek TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS rides (
      id TEXT PRIMARY KEY,
      commuteId TEXT NOT NULL,
      driverUid TEXT NOT NULL,
      passengerUid TEXT NOT NULL,
      passengerName TEXT,
      passengerPhoto TEXT,
      startPoint TEXT NOT NULL,
      destination TEXT NOT NULL,
      departureTime TEXT NOT NULL,
      seatsAvailable INTEGER,
      carMake TEXT,
      carModel TEXT,
      carYear TEXT,
      plateNumber TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipientUid TEXT NOT NULL,
      type TEXT NOT NULL,
      rideId TEXT,
      commuteId TEXT,
      actorUid TEXT NOT NULL,
      actorName TEXT NOT NULL,
      actorPhoto TEXT,
      startPoint TEXT,
      destination TEXT,
      departureTime TEXT,
      read INTEGER DEFAULT 0,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      rideId TEXT NOT NULL,
      senderUid TEXT NOT NULL,
      senderName TEXT NOT NULL,
      senderPhoto TEXT,
      text TEXT NOT NULL,
      createdAt TEXT
    );
  `);
}

export function getDb(): DatabaseConstructor.Database {
  if (!db) {
    initializeDatabase();
  }
  return db;
}
