import 'dotenv/config';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';

const firestore = getFirestore();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSupabaseUserIdByFirebaseUid(firebaseUid: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('firebase_uid', firebaseUid)
    .single();
  return data?.id || null;
}

async function migrateUsers(): Promise<void> {
  console.log('Migrating users...');
  const snapshot = await firestore.collection('users').get();
  let migrated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { error } = await supabase.from('users').insert({
      firebase_uid: doc.id,
      email: data.email,
      display_name: data.displayName,
      mobile_number: data.mobileNumber,
      nin: data.nin,
      company: data.company,
      is_verified: data.isVerified ?? false,
      rating: data.rating ?? 5.0,
      role: data.role ?? 'executive',
      photo_url: data.photoURL,
      verification_status: data.verificationStatus ?? 'unverified',
      employment_letter_url: data.employmentLetterUrl,
      id_card_url: data.idCardUrl,
      pay_stub_url: data.payStubUrl,
      car_make: data.carMake,
      car_model: data.carModel,
      car_year: data.carYear,
      plate_number: data.plateNumber,
    });

    if (!error) migrated++;
  }
  console.log(`Migrated ${migrated}/${snapshot.size} users`);
}

async function migrateCommutes(): Promise<void> {
  console.log('Migrating commutes...');
  const snapshot = await firestore.collection('commutes').get();
  let migrated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const authorId = await getSupabaseUserIdByFirebaseUid(data.authorUid);

    if (!authorId) {
      console.warn(`Skipping commute ${doc.id}: author ${data.authorUid} not found`);
      continue;
    }

    const { error } = await supabase.from('commutes').insert({
      id: doc.id, // preserve original Firestore document ID as UUID (migration only)
      author_uid: authorId,
      author_name: data.authorName,
      author_photo: data.authorPhoto,
      start_point: data.startPoint,
      destination: data.destination,
      departure_time: data.departureTime,
      seats_available: data.seatsAvailable ?? 1,
      car_make: data.carMake,
      car_model: data.carModel,
      car_year: data.carYear,
      plate_number: data.plateNumber,
      type: data.type ?? 'offer',
      status: data.status ?? 'active',
      shift: data.shift,
      recurring: data.recurring,
      days_of_week: data.daysOfWeek,
      requests: data.requests ?? [],
    });

    if (!error) migrated++;
  }
  console.log(`Migrated ${migrated}/${snapshot.size} commutes`);
}

async function migrateRides(): Promise<void> {
  console.log('Migrating rides...');
  const snapshot = await firestore.collection('rides').get();
  let migrated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Map Firebase UIDs to Supabase user IDs
    const driverId = await getSupabaseUserIdByFirebaseUid(data.driverUid);
    const passengerId = await getSupabaseUserIdByFirebaseUid(data.passengerUid);

    if (!driverId || !passengerId) {
      console.warn(`Skipping ride ${doc.id}: driver or passenger not found`);
      continue;
    }

    const { error } = await supabase.from('rides').insert({
      id: doc.id,
      commute_id: data.commuteId,
      driver_uid: driverId,
      passenger_uid: passengerId,
      passenger_name: data.passengerName,
      passenger_photo: data.passengerPhoto,
      author_name: data.authorName,
      author_photo: data.authorPhoto,
      start_point: data.startPoint,
      destination: data.destination,
      departure_time: data.departureTime,
      seats_available: data.seatsAvailable ?? 1,
      car_make: data.carMake,
      car_model: data.carModel,
      car_year: data.carYear,
      plate_number: data.plateNumber,
      status: data.status ?? 'pending',
    });

    if (!error) migrated++;
  }
  console.log(`Migrated ${migrated}/${snapshot.size} rides`);
}

async function migrateMessages(): Promise<void> {
  console.log('Migrating ride messages...');
  const ridesSnapshot = await firestore.collection('rides').get();
  let totalMigrated = 0;
  let totalMessages = 0;

  for (const rideDoc of ridesSnapshot.docs) {
    const messagesSnapshot = await rideDoc.ref.collection('messages').get();
    totalMessages += messagesSnapshot.size;

    for (const msgDoc of messagesSnapshot.docs) {
      const data = msgDoc.data();
      const senderId = await getSupabaseUserIdByFirebaseUid(data.senderUid);

      if (!senderId) {
        console.warn(`Skipping message ${msgDoc.id} in ride ${rideDoc.id}: sender not found`);
        continue;
      }

      const { error } = await supabase.from('ride_messages').insert({
        id: msgDoc.id,
        ride_id: rideDoc.id,
        sender_uid: senderId,
        sender_name: data.senderName,
        sender_photo: data.senderPhoto,
        text: data.text,
      });

      if (!error) totalMigrated++;
    }
  }
  console.log(`Migrated ${totalMigrated}/${totalMessages} messages`);
}

async function migrateNotifications(): Promise<void> {
  console.log('Migrating notifications...');
  const usersSnapshot = await firestore.collection('users').get();
  let totalMigrated = 0;
  let totalNotifs = 0;

  for (const userDoc of usersSnapshot.docs) {
    const recipientId = await getSupabaseUserIdByFirebaseUid(userDoc.id);
    if (!recipientId) continue;

    const notifsSnapshot = await userDoc.ref.collection('notifications').get();
    totalNotifs += notifsSnapshot.size;

    for (const notifDoc of notifsSnapshot.docs) {
      const data = notifDoc.data();
      const actorId = await getSupabaseUserIdByFirebaseUid(data.actorUid);

      if (!actorId) {
        console.warn(`Skipping notification ${notifDoc.id}: actor not found`);
        continue;
      }

      const { error } = await supabase.from('notifications').insert({
        id: notifDoc.id,
        recipient_uid: recipientId,
        type: data.type,
        ride_id: data.rideId,
        commute_id: data.commuteId,
        actor_uid: actorId,
        actor_name: data.actorName,
        actor_photo: data.actorPhoto,
        start_point: data.startPoint,
        destination: data.destination,
        departure_time: data.departureTime,
        read: data.read ?? false,
        scheduled_for: data.scheduledFor,
      });

      if (!error) totalMigrated++;
    }
  }
  console.log(`Migrated ${totalMigrated}/${totalNotifs} notifications`);
}

async function migrate(): Promise<void> {
  console.log('Starting Firebase → Supabase migration...\n');

  try {
    await migrateUsers();
    await migrateCommutes();
    await migrateRides();
    await migrateMessages();
    await migrateNotifications();

    console.log('\nMigration complete!');
    console.log('\nNote: After migration:');
    console.log('1. Set AUTH_PROVIDER=supabase and DATABASE_PROVIDER=postgres in .env');
    console.log('2. Run npm run build to verify compilation');
    console.log('3. Test all endpoints');
    console.log('4. When ready, remove firebase_uid column: ALTER TABLE users DROP COLUMN firebase_uid');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
