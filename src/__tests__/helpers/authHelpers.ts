import { signJwt } from '../../config/auth.js';
import bcrypt from 'bcrypt';

export function makeToken(uid: string, email?: string): string {
  return signJwt({ uid, email: email || `${uid}@test.com` });
}

export async function hashPw(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}
