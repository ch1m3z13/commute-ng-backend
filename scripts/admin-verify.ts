import { getDb } from '../src/config/database.js';
import { initializeDatabase } from '../src/config/database.js';

async function verifyUser(identifier: string) {
  await initializeDatabase();
  const db = getDb();

  const result = await db.prepare('SELECT uid, email FROM users WHERE email = $1 OR uid = $1').get(identifier) as { uid: string; email: string } | undefined;

  if (!result) {
    console.error(`User not found: ${identifier}`);
    process.exit(1);
  }

  const { uid, email } = result;

  console.log(`Verifying user: ${email} (${uid})`);

  try {
    const updateResult = await db.prepare(`
      UPDATE users
      SET isVerified = 1,
          verificationStatus = 'verified',
          idCardVerified = 1,
          updatedAt = $1
      WHERE uid = $2
    `).run(new Date().toISOString(), uid) as { rowCount: number };

    if (updateResult.rowCount === 0) {
      throw new Error('Failed to update user status');
    }

    console.log(`Success! User ${email} is now fully verified.`);
  } catch (error) {
    console.error(`Error verifying user: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: npx tsx scripts/admin-verify.ts <email_or_uid>');
  process.exit(1);
}

verifyUser(args[0]);
