import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../config/auth.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const idToken = authHeader.substring(7);

  try {
    const decoded = verifyJwt(idToken) as { uid: string; email?: string } | null;
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
    };
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const idToken = authHeader.substring(7);
  const decoded = verifyJwt(idToken) as { uid: string; email?: string } | null;
  if (decoded) {
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
    };
  }
  next();
}
