import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    email_verified?: boolean;
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
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
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

  auth.verifyIdToken(idToken)
    .then((decodedToken) => {
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        email_verified: decodedToken.email_verified,
      };
      next();
    })
    .catch(() => {
      next();
    });
}
