import { describe, it, expect, vi } from 'vitest';
import { AppError, errorHandler, notFoundHandler } from '../../../middleware/errorHandler.js';

function createReq(method = 'GET', path = '/test') {
  return { method, path } as any;
}

function createRes() {
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res;
}

describe('AppError', () => {
  it('creates error with statusCode and message', () => {
    const err = new AppError(404, 'Not found');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.name).toBe('AppError');
  });

  it('accepts optional code', () => {
    const err = new AppError(422, 'Validation failed', 'VALIDATION_ERROR');
    expect(err.code).toBe('VALIDATION_ERROR');
  });
});

describe('errorHandler', () => {
  it('returns AppError with correct status code and message', () => {
    const err = new AppError(404, 'User not found');
    const req = createReq();
    const res = createRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found', code: undefined });
  });

  it('returns 500 for generic Error', () => {
    const err = new Error('Something broke');
    const req = createReq();
    const res = createRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  });

  it('includes code field when present', () => {
    const err = new AppError(400, 'Bad request', 'INVALID_INPUT');
    const req = createReq();
    const res = createRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith({ error: 'Bad request', code: 'INVALID_INPUT' });
  });
});

describe('notFoundHandler', () => {
  it('returns 404 with method and path in error message', () => {
    const req = createReq('POST', '/api/users');
    const res = createRes();

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Route POST /api/users not found',
      code: 'NOT_FOUND',
    });
  });
});
