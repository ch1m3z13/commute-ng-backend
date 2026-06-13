import { describe, it, expect, vi } from 'vitest';
import { authenticateToken, optionalAuth } from '../../../middleware/auth.js';
import { signJwt } from '../../../config/auth.js';

function createReq(authHeader?: string) {
  return { headers: { authorization: authHeader } } as any;
}

function createRes() {
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res;
}

describe('authenticateToken', () => {
  it('calls next() and sets req.user for valid token', () => {
    const token = signJwt({ uid: 'user1', email: 'test@test.com' });
    const req = createReq(`Bearer ${token}`);
    const res = createRes();
    const next = vi.fn();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ uid: 'user1', email: 'test@test.com' });
  });

  it('returns 401 for missing Authorization header', () => {
    const req = createReq();
    const res = createRes();
    const next = vi.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for malformed Bearer token', () => {
    const req = createReq('Bearer invalid');
    const res = createRes();
    const next = vi.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for expired JWT', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ uid: 'user1' }, process.env.JWT_SECRET || 'test-secret-for-ci', { expiresIn: '-1s' });
    const req = createReq(`Bearer ${token}`);
    const res = createRes();
    const next = vi.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('optionalAuth', () => {
  it('calls next() with req.user set for valid token', () => {
    const token = signJwt({ uid: 'user1', email: 'test@test.com' });
    const req = createReq(`Bearer ${token}`);
    const res = createRes();
    const next = vi.fn();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ uid: 'user1', email: 'test@test.com' });
  });

  it('calls next() without req.user when no header', () => {
    const req = createReq();
    const res = createRes();
    const next = vi.fn();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('calls next() without req.user for invalid token', () => {
    const req = createReq('Bearer invalid');
    const res = createRes();
    const next = vi.fn();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});
