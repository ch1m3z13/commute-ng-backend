import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword, verifyPassword, signJwt, verifyJwt } from '../../../config/auth.js';

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-for-ci';
});

describe('hashPassword', () => {
  it('returns a hash string different from input', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).not.toBe('mypassword');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('produces consistent length output', async () => {
    const h1 = await hashPassword('password1');
    const h2 = await hashPassword('password2');
    expect(h1.length).toBe(h2.length);
  });
});

describe('verifyPassword', () => {
  it('returns true for matching password/hash', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword('correct', hash)).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('signJwt', () => {
  it('returns a string token', () => {
    const token = signJwt({ uid: 'user1' });
    expect(typeof token).toBe('string');
  });

  it('token contains 3 dot-separated parts', () => {
    const token = signJwt({ uid: 'user1' });
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('verifyJwt', () => {
  it('returns decoded payload for valid token', () => {
    const token = signJwt({ uid: 'user1', email: 'test@example.com' });
    const decoded = verifyJwt(token) as { uid: string; email: string };
    expect(decoded.uid).toBe('user1');
    expect(decoded.email).toBe('test@example.com');
  });

  it('returns null for invalid token', () => {
    expect(verifyJwt('invalid.token.here')).toBeNull();
  });

  it('returns null for expired token', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ uid: 'user1' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    expect(verifyJwt(token)).toBeNull();
  });
});
