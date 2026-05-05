import { Request, Response, NextFunction } from 'express';
import { featureFlags } from '../config/featureFlags.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    email_verified?: boolean;
  };
}

async function firebaseAuthenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const { authenticateToken: fn } = await import('./auth.firebase.js');
  return fn(req, res, next);
}

async function supabaseAuthenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const { authenticateToken: fn } = await import('./auth.supabase.js');
  return fn(req, res, next);
}

async function firebaseOptionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const { optionalAuth: fn } = await import('./auth.firebase.js');
  return fn(req, res, next);
}

async function supabaseOptionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const { optionalAuth: fn } = await import('./auth.supabase.js');
  return fn(req, res, next);
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (featureFlags.auth.provider === 'supabase') {
    return supabaseAuthenticate(req, res, next);
  }
  return firebaseAuthenticate(req, res, next);
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (featureFlags.auth.provider === 'supabase') {
    return supabaseOptionalAuth(req, res, next);
  }
  return firebaseOptionalAuth(req, res, next);
}
