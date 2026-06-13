#!/usr/bin/env node
/**
 * CommuteNG Admin CLI
 *
 * Usage:
 *   npx tsx src/scripts/admin-cli.ts list-pending
 *   npx tsx src/scripts/admin-cli.ts approve <uid>
 *   npx tsx src/scripts/admin-cli.ts reject <uid> [reason]
 *   npx tsx src/scripts/admin-cli.ts list-users [search]
 */

import 'dotenv/config';
import { getDb } from '../config/database.js';

async function listPending() {
  await getDb();
  const rows = await getDb().prepare(
    `SELECT uid, email, displayName, verificationStatus, idCardUrl, emailVerified, ninVerified, idCardVerified, createdAt
     FROM users WHERE verificationStatus = 'pending' ORDER BY createdAt DESC`
  ).all() as Record<string, unknown>[];

  if (rows.length === 0) {
    console.log('No users pending verification.');
    return;
  }

  console.log(`\n  ${rows.length} user(s) pending verification:\n`);
  for (const row of rows) {
    console.log(`  UID:     ${row.uid}`);
    console.log(`  Name:    ${row.displayName}`);
    console.log(`  Email:   ${row.email}`);
    console.log(`  Email:   ${row.emailVerified ? '✓' : '✗'}  NIN: ${row.ninVerified ? '✓' : '✗'}  ID Card: ${row.idCardVerified ? '✓' : (row.idCardUrl ? 'pending' : 'not submitted')}`);
    console.log(`  Created: ${row.createdAt}`);
    console.log('');
  }
}

async function approveUser(uid: string) {
  await getDb();

  const user = await getDb().prepare('SELECT uid, email, displayName, verificationStatus FROM users WHERE uid = ?').get(uid) as Record<string, unknown> | undefined;
  if (!user) {
    console.error(`User ${uid} not found.`);
    process.exit(1);
  }

  await getDb().prepare('UPDATE users SET idCardVerified = 1, verificationStatus = \'verified\', rejectionReason = NULL, updatedAt = ? WHERE uid = ?')
    .run(new Date().toISOString(), uid);

  console.log(`✓ Approved ${user.displayName} (${user.email}). Verification status: verified, tier: full.`);
}

async function rejectUser(uid: string, reason?: string) {
  await getDb();

  const user = await getDb().prepare('SELECT uid, email, displayName FROM users WHERE uid = ?').get(uid) as Record<string, unknown> | undefined;
  if (!user) {
    console.error(`User ${uid} not found.`);
    process.exit(1);
  }

  const rejectionReason = reason || 'Your ID card could not be verified. Please submit a clearer image.';
  await getDb().prepare('UPDATE users SET idCardVerified = 0, verificationStatus = \'rejected\', rejectionReason = ?, updatedAt = ? WHERE uid = ?')
    .run(rejectionReason, new Date().toISOString(), uid);

  console.log(`✗ Rejected ${user.displayName} (${user.email}). Reason: ${rejectionReason}`);
}

async function listUsers(search?: string) {
  await getDb();

  let query = 'SELECT uid, email, displayName, verificationStatus, emailVerified, ninVerified, idCardVerified, createdAt FROM users';
  const params: string[] = [];

  if (search) {
    query += ' WHERE email LIKE ? OR displayName LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY createdAt DESC LIMIT 50';

  const rows = await getDb().prepare(query).all(...params) as Record<string, unknown>[];

  if (rows.length === 0) {
    console.log('No users found.');
    return;
  }

  console.log(`\n  ${rows.length} user(s):\n`);
  for (const row of rows) {
    const status = row.verificationStatus === 'verified' ? '✓ verified' :
                   row.verificationStatus === 'pending' ? '⏳ pending' :
                   row.verificationStatus === 'rejected' ? '✗ rejected' : '? unverified';
    console.log(`  ${status.padEnd(15)} ${String(row.displayName).padEnd(25)} ${row.email}  (${row.uid})`);
  }
  console.log('');
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const [,, command, ...args] = process.argv;

async function main() {
  try {
    switch (command) {
      case 'list-pending':
        await listPending();
        break;
      case 'approve':
        if (!args[0]) { console.error('Usage: admin-cli.ts approve <uid>'); process.exit(1); }
        await approveUser(args[0]);
        break;
      case 'reject':
        if (!args[0]) { console.error('Usage: admin-cli.ts reject <uid> [reason]'); process.exit(1); }
        await rejectUser(args[0], args[1]);
        break;
      case 'list-users':
        await listUsers(args[0]);
        break;
      default:
        console.log(`
CommuteNG Admin CLI

Commands:
  list-pending           List users pending verification
  approve <uid>          Approve a user's ID card verification
  reject <uid> [reason]  Reject a user's ID card verification
  list-users [search]    List users (optionally search by name/email)
`);
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
