/**
 * Abuja location seed data — hardcoded geocodes.
 * Run once to populate the locations table with common Abuja suburbs and CBD landmarks.
 * Usage: npx tsx src/scripts/seed-abuja-locations.ts
 */

import 'dotenv/config';
import { initializeDatabase, getDb } from '../config/database.js';
import { LOCATIONS } from '../data/abujaLocations.js';

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function seed() {
  await initializeDatabase();
  const db = getDb();

  console.log(`Seeding ${LOCATIONS.length} Abuja locations (hardcoded geocodes)...`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const loc of LOCATIONS) {
    const normalized = normalizeQuery(loc.name);
    try {
      // Upsert into locations table
      await db.prepare(
        'INSERT INTO locations (displayName, lat, lng, category) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING'
      ).run(loc.name, loc.lat, loc.lng, loc.cat);

      // Also upsert into geocache for fast lookup
      await db.prepare(
        'INSERT INTO geocache (query, lat, lng, raw_json, createdAt) VALUES (?, ?, ?, ?, ?) ON CONFLICT (query) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, raw_json = EXCLUDED.raw_json, createdAt = EXCLUDED.createdAt'
      ).run(normalized, loc.lat, loc.lng, JSON.stringify({ display_name: loc.name }), new Date().toISOString());

      console.log(`  ✓ ${loc.name} → (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}) [${loc.cat}]`);
      inserted++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // "already exists" is fine — treat as skipped
      if (msg.includes('duplicate') || msg.includes('already exists')) {
        skipped++;
      } else {
        console.log(`  ✗ ${loc.name} → ${msg}`);
        failed++;
      }
    }
  }

  console.log(`\nDone: ${inserted} seeded, ${skipped} skipped (already exist), ${failed} failed`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
