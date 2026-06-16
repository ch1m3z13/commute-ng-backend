import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { getDb } from '../config/database.js';

const RESET_TOKEN_LENGTH = 32;
const RESET_TOKEN_TTL_MINUTES = 60;
const RESET_TOKEN_HASH_ROUNDS = 10;

export async function generatePasswordResetToken(uid: string): Promise<string> {
  const rawToken = randomBytes(RESET_TOKEN_LENGTH).toString('hex');
  const hashed = await bcrypt.hash(rawToken, RESET_TOKEN_HASH_ROUNDS);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  await getDb().prepare(
    'UPDATE users SET passwordResetToken = @token, passwordResetExpiresAt = @expiresAt WHERE uid = @uid'
  ).run({ token: hashed, expiresAt, uid });

  return rawToken;
}

export async function verifyPasswordResetToken(uid: string, rawToken: string): Promise<boolean> {
  const row = await getDb().prepare(
    'SELECT passwordResetToken, passwordResetExpiresAt FROM users WHERE uid = @uid'
  ).get({ uid }) as { passwordResetToken: string; passwordResetExpiresAt: string } | undefined;

  if (!row || !row.passwordResetToken || !row.passwordResetExpiresAt) return false;
  if (new Date(row.passwordResetExpiresAt) < new Date()) return false;

  const match = await bcrypt.compare(rawToken, row.passwordResetToken);
  return match;
}

export async function clearPasswordResetToken(uid: string): Promise<void> {
  await getDb().prepare(
    'UPDATE users SET passwordResetToken = NULL, passwordResetExpiresAt = NULL WHERE uid = @uid'
  ).run({ uid });
}

export async function resetPassword(uid: string, newPasswordHash: string): Promise<void> {
  await getDb().prepare(
    'UPDATE users SET passwordHash = @passwordHash, passwordResetToken = NULL, passwordResetExpiresAt = NULL, updatedAt = @now WHERE uid = @uid'
  ).run({ passwordHash: newPasswordHash, now: new Date().toISOString(), uid });
}
