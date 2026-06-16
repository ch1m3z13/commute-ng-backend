import { initializeDatabase, getDb } from '../src/config/database.js';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

const SALT_ROUNDS = 12;

interface SeedUser {
  uid?: string;
  email: string;
  password: string;
  displayName: string;
  role?: string;
  verificationStatus?: string;
  isVerified?: number;
  emailVerified?: number;
  ninVerified?: number;
  idCardVerified?: number;
  mobileNumber?: string;
  nin?: string;
  company?: string;
  carMake?: string;
  carModel?: string;
  carYear?: string;
  plateNumber?: string;
  homeAddress?: string;
  homeLat?: number;
  homeLng?: number;
  officeAddress?: string;
  officeLat?: number;
  officeLng?: number;
  photoURL?: string;
}

const TEST_USERS: SeedUser[] = [
  // ─── Admin ──────────────────────────────────────────────────────────────
  {
    email: 'admin@commuteng.com',
    password: 'Admin123!',
    displayName: 'Platform Admin',
    role: 'admin',
    verificationStatus: 'verified',
    isVerified: 1,
    emailVerified: 1,
    ninVerified: 1,
    idCardVerified: 1,
    mobileNumber: '08012345678',
    nin: '12345678901',
    company: 'CommuteNG',
    carMake: 'Toyota',
    carModel: 'Camry',
    carYear: '2023',
    plateNumber: 'ABC-123-NG',
    homeAddress: '12 Aso Drive, Maitama, Abuja',
    homeLat: 9.0579,
    homeLng: 7.4951,
    officeAddress: 'Central Business District, Abuja',
    officeLat: 9.0580,
    officeLng: 7.4890,
  },

  // ─── Verified Drivers (offer rides) ─────────────────────────────────────
  {
    email: 'chinedu@company.com',
    password: 'Password1!',
    displayName: 'Chinedu Okafor',
    role: 'executive',
    verificationStatus: 'verified',
    isVerified: 1,
    emailVerified: 1,
    ninVerified: 1,
    idCardVerified: 1,
    mobileNumber: '08023456789',
    nin: '23456789012',
    company: 'Andela Nigeria',
    carMake: 'Honda',
    carModel: 'Civic',
    carYear: '2022',
    plateNumber: 'XYZ-456-NG',
    homeAddress: '25 Wuse Zone 5, Abuja',
    homeLat: 9.0620,
    homeLng: 7.4770,
    officeAddress: '4th Avenue, Gwarinpa, Abuja',
    officeLat: 9.1100,
    officeLng: 7.4300,
  },
  {
    email: 'fatima@company.com',
    password: 'Password1!',
    displayName: 'Fatima Abubakar',
    role: 'executive',
    verificationStatus: 'verified',
    isVerified: 1,
    emailVerified: 1,
    ninVerified: 1,
    idCardVerified: 1,
    mobileNumber: '08034567890',
    nin: '34567890123',
    company: 'Flour Mills Nigeria',
    carMake: 'Toyota',
    carModel: 'Corolla',
    carYear: '2023',
    plateNumber: 'LMN-789-NG',
    homeAddress: '15 Kubwa Extension, Abuja',
    homeLat: 9.1500,
    homeLng: 7.3800,
    officeAddress: 'Central Business District, Abuja',
    officeLat: 9.0580,
    officeLng: 7.4890,
  },
  {
    email: 'emeka@company.com',
    password: 'Password1!',
    displayName: 'Emeka Nwankwo',
    role: 'executive',
    verificationStatus: 'verified',
    isVerified: 1,
    emailVerified: 1,
    ninVerified: 1,
    idCardVerified: 1,
    mobileNumber: '08045678901',
    nin: '45678901234',
    company: 'Dangote Group',
    carMake: 'Hyundai',
    carModel: 'Tucson',
    carYear: '2022',
    plateNumber: 'PQR-012-NG',
    homeAddress: '30 Jabi District, Abuja',
    homeLat: 9.0700,
    homeLng: 7.4400,
    officeAddress: 'Lugbe Industrial Area, Abuja',
    officeLat: 9.0200,
    officeLng: 7.5200,
  },

  // ─── Verified Passengers (find/booking rides) ───────────────────────────
  {
    email: 'aminu@company.com',
    password: 'Password1!',
    displayName: 'Aminu Bello',
    role: 'executive',
    verificationStatus: 'verified',
    isVerified: 1,
    emailVerified: 1,
    ninVerified: 1,
    idCardVerified: 1,
    mobileNumber: '08056789012',
    nin: '56789012345',
    company: 'NNPC Limited',
    homeAddress: '8 Garki Area 11, Abuja',
    homeLat: 9.0600,
    homeLng: 7.4900,
    officeAddress: 'NAFDAC Headquarters, Wuse, Abuja',
    officeLat: 9.0650,
    officeLng: 7.4750,
  },
  {
    email: 'grace@company.com',
    password: 'Password1!',
    displayName: 'Grace Ogundimu',
    role: 'executive',
    verificationStatus: 'verified',
    isVerified: 1,
    emailVerified: 1,
    ninVerified: 1,
    idCardVerified: 1,
    mobileNumber: '08067890123',
    nin: '67890123456',
    company: 'MTN Nigeria',
    homeAddress: '42 Life Camp, Abuja',
    homeLat: 9.1000,
    homeLng: 7.4100,
    officeAddress: 'Bujel Plaza, Central Business District',
    officeLat: 9.0580,
    officeLng: 7.4890,
  },

  // ─── Standard tier (email + NIN verified, no ID card) ──────────────────
  {
    email: 'standard@company.com',
    password: 'Password1!',
    displayName: 'Yusuf Abdullahi',
    role: 'executive',
    verificationStatus: 'unverified',
    isVerified: 0,
    emailVerified: 1,
    ninVerified: 1,
    idCardVerified: 0,
    mobileNumber: '08078901234',
    nin: '78901234567',
    company: 'Bureau of Public Enterprises',
  },

  // ─── Basic tier (email only) ───────────────────────────────────────────
  {
    email: 'basic@company.com',
    password: 'Password1!',
    displayName: 'Ifeanyi Chukwu',
    role: 'executive',
    verificationStatus: 'unverified',
    isVerified: 0,
    emailVerified: 1,
    ninVerified: 0,
    idCardVerified: 0,
    mobileNumber: '08089012345',
    company: 'Access Bank',
  },

  // ─── Unverified (new user) ──────────────────────────────────────────────
  {
    email: 'newuser@company.com',
    password: 'Password1!',
    displayName: 'Aisha Mohammed',
    role: 'executive',
    verificationStatus: 'unverified',
    isVerified: 0,
    emailVerified: 0,
    ninVerified: 0,
    idCardVerified: 0,
  },

  // ─── Pending verification (submitted ID, awaiting review) ───────────────
  {
    email: 'pending@company.com',
    password: 'Password1!',
    displayName: 'Tunde Bakare',
    role: 'executive',
    verificationStatus: 'pending',
    isVerified: 0,
    emailVerified: 1,
    ninVerified: 1,
    idCardVerified: 0,
    mobileNumber: '08090123456',
    nin: '90123456789',
    company: 'Shell Nigeria',
    homeAddress: '5 Maitama Crescent, Abuja',
    homeLat: 9.0610,
    homeLng: 7.4920,
    officeAddress: 'Lekki Phase 1, Lagos (remote)',
    officeLat: 6.4450,
    officeLng: 3.4700,
  },

  // ─── Rejected verification ──────────────────────────────────────────────
  {
    email: 'rejected@company.com',
    password: 'Password1!',
    displayName: 'Ngozi Eze',
    role: 'executive',
    verificationStatus: 'rejected',
    isVerified: 0,
    emailVerified: 1,
    ninVerified: 1,
    idCardVerified: 0,
    mobileNumber: '08001234567',
    nin: '01234567890',
    company: 'Nigerian Breweries',
  },
];

const TEST_COMMUTES = [
  // Chinedu offers morning ride
  {
    authorEmail: 'chinedu@company.com',
    startPoint: '25 Wuse Zone 5, Abuja',
    startLat: 9.0620,
    startLng: 7.4770,
    destination: '4th Avenue, Gwarinpa, Abuja',
    destLat: 9.1100,
    destLng: 7.4300,
    departureTime: '08:00',
    seatsAvailable: 3,
    type: 'offer',
    status: 'active',
    shift: 'morning',
    recurring: 1,
    daysOfWeek: JSON.stringify(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
  },
  // Fatima offers morning ride
  {
    authorEmail: 'fatima@company.com',
    startPoint: '15 Kubwa Extension, Abuja',
    startLat: 9.1500,
    startLng: 7.3800,
    destination: 'Central Business District, Abuja',
    destLat: 9.0580,
    destLng: 7.4890,
    departureTime: '07:30',
    seatsAvailable: 2,
    type: 'offer',
    status: 'active',
    shift: 'morning',
    recurring: 1,
    daysOfWeek: JSON.stringify(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
  },
  // Emeka offers evening ride (back home)
  {
    authorEmail: 'emeka@company.com',
    startPoint: 'Lugbe Industrial Area, Abuja',
    startLat: 9.0200,
    startLng: 7.5200,
    destination: '30 Jabi District, Abuja',
    destLat: 9.0700,
    destLng: 7.4400,
    departureTime: '17:00',
    seatsAvailable: 4,
    type: 'offer',
    status: 'active',
    shift: 'evening',
    recurring: 1,
    daysOfWeek: JSON.stringify(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
  },
  // Aminu requests morning ride
  {
    authorEmail: 'aminu@company.com',
    startPoint: '8 Garki Area 11, Abuja',
    startLat: 9.0600,
    startLng: 7.4900,
    destination: 'NAFDAC Headquarters, Wuse, Abuja',
    destLat: 9.0650,
    destLng: 7.4750,
    departureTime: '08:30',
    seatsAvailable: 1,
    type: 'request',
    status: 'active',
    shift: 'morning',
  },
  // Grace requests morning ride
  {
    authorEmail: 'grace@company.com',
    startPoint: '42 Life Camp, Abuja',
    startLat: 9.1000,
    startLng: 7.4100,
    destination: 'Bujel Plaza, Central Business District',
    destLat: 9.0580,
    destLng: 7.4890,
    departureTime: '07:45',
    seatsAvailable: 1,
    type: 'request',
    status: 'active',
    shift: 'morning',
  },
];

async function seed() {
  console.log('Initializing database...');
  await initializeDatabase();
  const db = getDb();

  // ─── Create Users ────────────────────────────────────────────────────────
  console.log(`\nSeeding ${TEST_USERS.length} test users...`);

  const userUidMap: Record<string, string> = {};

  for (const userData of TEST_USERS) {
    const uid = userData.uid || randomUUID();
    const passwordHash = await bcrypt.hash(userData.password, SALT_ROUNDS);
    const now = new Date().toISOString();

    try {
      await db.prepare(`
        INSERT INTO users (uid, displayName, email, mobileNumber, nin, company,
          isVerified, rating, role, photoURL, verificationStatus,
          phoneVerified, ninVerified, idCardVerified, rejectionReason,
          carMake, carModel, carYear, plateNumber,
          passwordHash,
          homeAddress, homeLat, homeLng, officeAddress, officeLat, officeLng,
          createdAt, updatedAt)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
      `).run(
        uid,
        userData.displayName,
        userData.email,
        userData.mobileNumber || null,
        userData.nin || null,
        userData.company || null,
        userData.isVerified ?? 0,
        5.0,
        userData.role || 'executive',
        userData.photoURL || null,
        userData.verificationStatus || 'unverified',
        userData.emailVerified ? 1 : 0,
        userData.ninVerified ? 1 : 0,
        userData.idCardVerified ? 1 : 0,
        userData.verificationStatus === 'rejected' ? 'Your documents could not be verified. Please submit a clearer image.' : null,
        userData.carMake || null,
        userData.carModel || null,
        userData.carYear || null,
        userData.plateNumber || null,
        passwordHash,
        userData.homeAddress || null,
        userData.homeLat ?? null,
        userData.homeLng ?? null,
        userData.officeAddress || null,
        userData.officeLat ?? null,
        userData.officeLng ?? null,
        now,
        now,
      );
      userUidMap[userData.email] = uid;
      console.log(`  ✓ ${userData.displayName} (${userData.email}) — role: ${userData.role}, status: ${userData.verificationStatus}`);
    } catch (err: any) {
      if (err.message?.includes('duplicate key')) {
        console.log(`  ⏭ ${userData.email} — already exists, skipping`);
      } else {
        console.error(`  ✗ ${userData.email} — ${err.message}`);
      }
    }
  }

  // ─── Create Commutes ─────────────────────────────────────────────────────
  console.log(`\nSeeding ${TEST_COMMUTES.length} test commutes...`);

  for (const commute of TEST_COMMUTES) {
    const authorUid = userUidMap[commute.authorEmail];
    if (!authorUid) {
      console.log(`  ⏭ Skipping commute — author ${commute.authorEmail} not found`);
      continue;
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    try {
      await db.prepare(`
        INSERT INTO commutes (id, authorUid, startPoint, startLat, startLng, destination, destLat, destLng,
          departureTime, seatsAvailable, seatsRemaining, type, status, shift, recurring, daysOfWeek,
          pickupRadiusMeters, timeFlexibilityMinutes, createdAt, updatedAt)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      `).run(
        id,
        authorUid,
        commute.startPoint,
        commute.startLat,
        commute.startLng,
        commute.destination,
        commute.destLat,
        commute.destLng,
        commute.departureTime,
        commute.seatsAvailable,
        commute.seatsAvailable,
        commute.type,
        commute.status,
        commute.shift,
        commute.recurring || 0,
        commute.daysOfWeek || null,
        2000,
        30,
        now,
        now,
      );
      console.log(`  ✓ ${commute.type.toUpperCase()} — ${commute.startPoint} → ${commute.destination} (${commute.shift})`);
    } catch (err: any) {
      console.error(`  ✗ ${commute.startPoint} → ${commute.destination} — ${err.message}`);
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log('\n─── Test Accounts ───────────────────────────────────────');
  console.log('');
  console.log('Admin:');
  console.log('  admin@commuteng.com / Admin123!');
  console.log('');
  console.log('Verified Drivers (offer rides):');
  console.log('  chinedu@company.com / Password1!');
  console.log('  fatima@company.com  / Password1!');
  console.log('  emeka@company.com   / Password1!');
  console.log('');
  console.log('Verified Passengers (find/book rides):');
  console.log('  aminu@company.com   / Password1!');
  console.log('  grace@company.com   / Password1!');
  console.log('');
  console.log('Standard Tier (email + NIN, no ID):');
  console.log('  standard@company.com / Password1!');
  console.log('');
  console.log('Basic Tier (email only):');
  console.log('  basic@company.com / Password1!');
  console.log('');
  console.log('Unverified (new user):');
  console.log('  newuser@company.com / Password1!');
  console.log('');
  console.log('Pending Verification:');
  console.log('  pending@company.com / Password1!');
  console.log('');
  console.log('Rejected Verification:');
  console.log('  rejected@company.com / Password1!');
  console.log('');
  console.log('─── End ────────────────────────────────────────────────');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
