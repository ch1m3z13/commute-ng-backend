import 'dotenv/config';
import { initializeDatabase, getDb } from '../config/database.js';
import { GeocodingService } from '../services/geocodingService.js';

const locationsToSeed = [
  // Districts
  { name: 'Maitama, Abuja', cat: 'district' },
  { name: 'Wuse, Abuja', cat: 'district' },
  { name: 'Garki, Abuja', cat: 'district' },
  { name: 'Asokoro, Abuja', cat: 'district' },
  { name: 'Gwarinpa, Abuja', cat: 'district' },
  { name: 'Jabi, Abuja', cat: 'district' },
  { name: 'Wuye, Abuja', cat: 'district' },
  { name: 'Kuje, Abuja', cat: 'district' },
  { name: 'Bwari, Abuja', cat: 'district' },
  { name: 'Nyanya, Abuja', cat: 'district' },
  
  // Landmarks
  { name: 'Central Bank of Nigeria, Abuja', cat: 'landmark' },
  { name: 'Nnamdi Azikiwe International Airport, Abuja', cat: 'landmark' },
  { name: 'National Stadium, Abuja', cat: 'landmark' },
  { name: 'National Mosque, Abuja', cat: 'landmark' },
  { name: 'National Christian Centre, Abuja', cat: 'landmark' },
  { name: 'Silverbird Cinema, Abuja', cat: 'landmark' },
  { name: 'Jabi Lake Mall, Abuja', cat: 'landmark' },
  { name: ' la Finale Mall, Abuja', cat: 'landmark' },
  { name: ' la Riviera Hotel, Abuja', cat: 'landmark' },
  { name: 'Transcorp Hilton Abuja', cat: 'landmark' },
  
  // Roads/Areas
  { name: 'Aso Drive, Abuja', cat: 'road' },
  { name: 'Constitution Avenue, Abuja', cat: 'road' },
  { name: 'Airport Road, Abuja', cat: 'road' },
  { name: 'Sulemana road, Abuja', cat: 'road' },
  { name: 'Utako Market, Abuja', cat: 'landmark' },
];

async function seed() {
  try {
    console.log('🚀 Starting location seeding...');
    await initializeDatabase();
    const db = getDb();
    const geoService = new GeocodingService();

    let successCount = 0;
    let failCount = 0;

    for (const loc of locationsToSeed) {
      try {
        console.log(`📍 Seeding: ${loc.name}...`);
        const result = await geoService.geocode(loc.name);
        
        await db.prepare(
          'INSERT INTO locations (displayName, lat, lng, category) VALUES (?, ?, ?, ?)'
        ).run(result.displayName, result.lat, result.lng, loc.cat);
        
        successCount++;
      } catch (e: any) {
        console.error(`❌ Failed to seed ${loc.name}: ${e.message}`);
        failCount++;
      }
    }

    console.log(`\n✅ Seeding complete!`);
    console.log(`- Successes: ${successCount}`);
    console.log(`- Failures: ${failCount}`);
  } catch (error) {
    console.error('❌ Critical seeding error:', error);
  }
}

seed();
