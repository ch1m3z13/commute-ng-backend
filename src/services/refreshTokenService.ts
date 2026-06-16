import { randomBytes, createHash } from 'node:crypto';
import { getDb } from '../config/database.js';

const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_TTL_DAYS = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createRefreshToken(uid: string): Promise<string> {
  const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  const hashed = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await getDb().prepare(
    'INSERT INTO refresh_tokens (token_hash, uid, expires_at, created_at) VALUES ($1, $2, $3, $4)'
  ).run(hashed, uid, expiresAt, new Date().toISOString());

  return rawToken;
}

export async function verifyRefreshToken(rawToken: string): Promise<string | null> {
  const hashed = hashToken(rawToken);

  const row = await getDb().prepare(
    'SELECT uid, expires_at FROM refresh_tokens WHERE token_hash = $1'
  ).get(hashed) as { uid: string; expires_at: string } | undefined;

  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    await revokeRefreshToken(rawToken);
    return null;
  }

  return row.uid;
}

export async function rotateRefreshToken(oldToken: string, uid: string): Promise<string> {
  await revokeRefreshToken(oldToken);
  return createRefreshToken(uid);
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const hashed = hashToken(rawToken);
  await getDb().prepare('DELETE FROM refresh_tokens WHERE token_hash = $1').run(hashed);
}

export async function revokeAllUserRefreshTokens(uid: string): Promise<void> {
  await getDb().prepare('DELETE FROM refresh_tokens WHERE uid = $1').run(uid);
}
