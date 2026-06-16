import { Router, Response } from 'express';
import { z } from 'zod';
import { signJwt } from '../config/auth.js';
import { verifyRefreshToken, rotateRefreshToken } from '../services/refreshTokenService.js';
import { userService } from '../services/userService.js';
import { strictAuthLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post('/', strictAuthLimiter, async (req, res: Response) => {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const { refreshToken } = parsed.data;

    const uid = await verifyRefreshToken(refreshToken);
    if (!uid) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await userService.getUser(uid);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const newRefreshToken = await rotateRefreshToken(refreshToken, uid);
    const accessToken = signJwt({ uid, email: user.email });

    return res.json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return res.status(500).json({ error: 'Failed to refresh token' });
  }
});

export default router;

