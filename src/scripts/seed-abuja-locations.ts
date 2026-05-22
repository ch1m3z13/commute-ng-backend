/**
 * Abuja location seed data for geocache.
 * Run this once to populate the geocache table with common Abuja locations.
 * Usage: npx tsx src/scripts/seed-abuja-locations.ts
 */

import { initializeDatabase, getDb } from '../config/database.js';
import { geocodingService } from '../services/geocodingService.js';

const ABUJA_LOCATIONS = [
  // Areas / Districts
  'Maitama, Abuja',
  'Wuse, Abuja',
  'Wuse 2, Abuja',
  'Garki, Abuja',
  'Garki 1, Abuja',
  'Garki 2, Abuja',
  'Asokoro, Abuja',
  'Utako, Abuja',
  'Kubwa, Abuja',
  'Nyanya, Abuja',
  'Lugbe, Abuja',
  'Jahi, Abuja',
  'Life Camp, Abuja',
  'Galadimawa, Abuja',
  'Apo, Abuja',
  'Karsana, Abuja',
  'Lokogoma, Abuja',
  'Dakibiyu, Abuja',
  'Wuye, Abuja',
  'Durumi, Abuja',
  'Mabushi, Abuja',
  'Katampe, Abuja',
  'Kabusa, Abuja',
  'Idu, Abuja',
  'Karmo, Abuja',
  'Dei-Dei, Abuja',
  'Suleja, Abuja',
  'Madalla, Abuja',

  // Major offices and landmarks
  'Nigerian Communications Commission, Maitama, Abuja',
  'Central Business District, Abuja',
  'Nnamdi Azikiwe International Airport, Abuja',
  'National Assembly, Abuja',
  'Aso Rock Presidential Villa, Abuja',
  'CBN Headquarters, Abuja',
  'NNPC Towers, Abuja',
  'NAFDAC Headquarters, Abuja',
  'EFCC Headquarters, Abuja',
  'ICPC Headquarters, Abuja',
  'Nigerian Airforce Base, Abuja',
  'Nigerian Army Headquarters, Abuja',
  'Police Headquarters, Abuja',
  'Nigerian Stock Exchange, Abuja',
  'Abuja International Conference Centre, Abuja',
  'National Stadium, Abuja',
  'Transcorp Hilton, Abuja',
  'Sheraton Hotel, Abuja',
  'Nicon Luxury Hotel, Abuja',

  // Estates
  'Lugbe Estate, Abuja',
  'Lokogoma Estate, Abuja',
  'Apo Legislative Quarters, Abuja',
  'Mabushi District, Abuja',
  'Kubwa Extension, Abuja',
];

async function seed() {
  initializeDatabase();
  const db = getDb();

  console.log(`Seeding ${ABUJA_LOCATIONS.length} Abuja locations...`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const location of ABUJA_LOCATIONS) {
    // Check if already cached
    const existing = db.prepare('SELECT 1 FROM geocache WHERE query = ?').get(location.toLowerCase().trim());
    if (existing) {
      skipped++;
      continue;
    }

    try {
      const result = await geocodingService.geocode(location);
      console.log(`  ✓ ${location} → (${result.lat.toFixed(4)}, ${result.lng.toFixed(4)})`);
      success++;
    } catch (err: any) {
      console.log(`  ✗ ${location} → ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} seeded, ${skipped} skipped (already cached), ${failed} failed`);
}

seed().catch(console.error);
