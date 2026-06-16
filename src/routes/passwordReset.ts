import { Router, Response } from 'express';
import { z } from 'zod';
import { authLimiter } from '../middleware/rateLimiter.js';
import { userService } from '../services/userService.js';
import { hashPassword } from '../config/auth.js';
import {
  generatePasswordResetToken,
  verifyPasswordResetToken,
  clearPasswordResetToken,
  resetPassword,
} from '../services/passwordResetService.js';
import { sendEmail } from '../services/verificationService.js';
import { revokeAllUserRefreshTokens } from '../services/refreshTokenService.js';

const router = Router();

const requestResetSchema = z.object({
  email: z.string().email().transform(val => val.toLowerCase().trim()),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  uid: z.string().uuid(),
  newPassword: z.string().min(8).max(128)
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' }),
});

router.post('/forgot-password', authLimiter, async (req, res: Response) => {
  try {
    const parsed = requestResetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const { email } = parsed.data;
    const user = await userService.getUserByEmail(email);

    if (!user) {
      return res.json({ message: 'If an account exists, a reset link has been sent' });
    }

    const token = await generatePasswordResetToken(user.uid);
    const resetLink = `${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/reset-password?uid=${user.uid}&token=${token}`;

    await sendEmail(
      email,
      'CommuteNG Password Reset',
      `Password Reset Request\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link expires in 60 minutes.`
    );

    return res.json({ message: 'If an account exists, a reset link has been sent' });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
});

router.post('/reset-password', authLimiter, async (req, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const { token, uid, newPassword } = parsed.data;

    const valid = await verifyPasswordResetToken(uid, token);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await hashPassword(newPassword);
    await resetPassword(uid, passwordHash);
    await revokeAllUserRefreshTokens(uid);

    return res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
