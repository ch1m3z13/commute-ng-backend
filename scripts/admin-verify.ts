import { getDb } from '../src/config/database.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function verifyUser(identifier: string) {
  const db = getDb();
  
  // 1. Find the user by email or UID
  const user = db.prepare('SELECT uid, email FROM users WHERE email = ? OR uid = ?').get(identifier, identifier) as any;

  if (!user) {
    console.error(`❌ User not found: ${identifier}`);
    process.exit(1);
  }

  const uid = user.uid;
  const email = user.email;

  console.log(`🚀 Verifying user: ${email} (${uid})`);

  try {
    // 2. Update to verified status
    // Note: We use the same columns expected by the frontend: 
    // isVerified (1/0), verificationStatus ('verified'), and essentially marking ID as verified
    const result = db.prepare(`
      UPDATE users 
      SET isVerified = 1, 
          verificationStatus = 'verified', 
          updatedAt = datetime('now') 
      WHERE uid = ?
    `).run(uid);

    if (result.changes === 0) {
      throw new Error('Failed to update user status');
    }

    console.log(`✅ Success! User ${email} is now fully verified.`);
    console.log(`👉 They can now offer and book rides with full trust.`);
  } catch (error) {
    console.error(`❌ Error verifying user: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: npx tsx scripts/admin-verify.ts <email_or_uid>');
  process.exit(1);
}

verifyUser(args[0]);
