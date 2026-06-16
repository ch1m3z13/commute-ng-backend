import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { userService } from '../services/userService.js';
import {
  generateAndStoreOtp,
  verifyOtp,
  clearOtp,
  validateNinFormat,
  computeTier,
  toIdCardStatus,
  sendOtpEmail,
} from '../services/verificationService.js';
import { z } from 'zod';
import { strictAuthLimiter, authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const verifyOtpSchema = z.object({
  code: z.string().length(6, 'OTP must be 6 digits'),
});

const validateNinSchema = z.object({
  nin: z.string().min(1),
});

const submitIdCardSchema = z.object({
  idCardUrl: z.string().url('Invalid URL format').or(z.literal('')),
});

// ─── GET /api/verification/status ─────────────────────────────────────────────
// Returns the user's current verification tier and step-by-step flags.

router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await userService.getUser(req.user!.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const emailVerified = Boolean(user.emailVerified);
    const ninVerified  = Boolean(user.ninVerified);
    const idCardVerified = Boolean(user.idCardVerified);
    const idCardStatus = toIdCardStatus(
      idCardVerified,
      user.idCardUrl,
      user.verificationStatus ?? 'unverified',
    );

    const tier = computeTier({ emailVerified, ninVerified, idCardVerified });

    return res.json({
      tier,
      emailVerified,
      ninVerified,
      idCardVerified,
      idCardStatus,
      rejectionReason: user.rejectionReason ?? undefined,
      isVerified: idCardVerified,
      verificationStatus: user.verificationStatus ?? 'unverified',
    });
  } catch (error) {
    console.error('Error fetching verification status:', error);
    return res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

// ─── POST /api/verification/otp/send ─────────────────────────────────────────
// Generates a 6-digit OTP and sends it to the user's registered email.

router.post('/otp/send', authenticateToken, strictAuthLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await userService.getUser(req.user!.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const otp = await generateAndStoreOtp(req.user!.uid);
    sendOtpEmail(user.email, otp).catch(err => {
      console.error('[Email] Failed to send OTP:', err.message);
    });

    return res.json({
      message: 'OTP sent',
      expiresInSeconds: 10 * 60,
      ...(process.env.NODE_ENV !== 'production' ? { _debug_otp: otp } : {}),
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// ─── POST /api/verification/otp/verify ────────────────────────────────────────
// Verifies the OTP code. On success, marks emailVerified = 1.

router.post('/otp/verify', authenticateToken, strictAuthLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const { code } = parsed.data;

    const valid = await verifyOtp(req.user!.uid, code);
    if (!valid) {
      return res.status(400).json({
        error: 'Invalid or expired OTP',
        details: 'The code you entered is incorrect or has expired. Request a new one.',
      });
    }

    return res.json({ message: 'Email verified', emailVerified: true });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// ─── POST /api/verification/nin/validate ──────────────────────────────────────
// Validates NIN format. On success, marks ninVerified = 1.

router.post('/nin/validate', authenticateToken, authLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = validateNinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const { nin } = parsed.data;
    const check = validateNinFormat(nin);
    if (!check.valid) {
      return res.status(400).json({ error: check.error });
    }

    await userService.setNinVerified(req.user!.uid, true);
    await userService.updateUser(req.user!.uid, { nin });

    return res.json({ message: 'NIN validated', ninVerified: true });
  } catch (error) {
    console.error('Error validating NIN:', error);
    return res.status(500).json({ error: 'Failed to validate NIN' });
  }
});

// ─── POST /api/verification/id-card/submit ────────────────────────────────────
// Submits a government ID card URL for admin review. Sets status to 'pending'.

router.post('/id-card/submit', authenticateToken, authLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = submitIdCardSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid URL', details: parsed.error.errors });
    }

    const { idCardUrl } = parsed.data;

    if (!idCardUrl) {
      return res.status(400).json({ error: 'ID card URL is required for full verification' });
    }

    await userService.updateVerificationStatus(req.user!.uid, 'pending', { idCardUrl });

    return res.json({
      message: 'ID card submitted for review',
      idCardStatus: 'pending_review',
      verificationStatus: 'pending',
    });
  } catch (error) {
    console.error('Error submitting ID card:', error);
    return res.status(500).json({ error: 'Failed to submit ID card' });
  }
});

// ─── POST /api/verification/resend-otp ────────────────────────────────────────
// Re-sends the OTP if the previous one expired (clears old OTP first, then generates new).

router.post('/resend-otp', authenticateToken, strictAuthLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await userService.getUser(req.user!.uid);
    if (!user?.email) {
      return res.status(400).json({ error: 'No email on file. Please register first.' });
    }

    await clearOtp(req.user!.uid);
    const otp = await generateAndStoreOtp(req.user!.uid);
    sendOtpEmail(user.email, otp).catch(err => {
      console.error('[Email] Failed to send OTP:', err.message);
    });

    return res.json({
      message: 'OTP resent',
      expiresInSeconds: 10 * 60,
      ...(process.env.NODE_ENV !== 'production' ? { _debug_otp: otp } : {}),
    });
  } catch (error) {
    console.error('Error resending OTP:', error);
    return res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

// ─── PATCH /api/verification/admin/:uid ───────────────────────────────────────
// Admin approves or rejects a user's ID card verification.

router.patch('/admin/:uid', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = await userService.checkIsAdmin(req.user!.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { uid } = req.params;
    const { status, rejectionReason } = req.body as {
      status?: string;
      rejectionReason?: string;
    };

    const validStatuses = ['pending', 'verified', 'rejected'] as const;
    if (!status || !validStatuses.includes(status as typeof validStatuses[number])) {
      return res.status(400).json({ error: 'Invalid status. Must be: pending, verified, or rejected.' });
    }

    const targetUser = await userService.getUser(uid);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (status === 'verified') {
      await userService.setIdCardVerified(uid, true);
      await userService.setRejectionReason(uid, null);
      await userService.updateVerificationStatus(uid, 'verified');
    } else if (status === 'rejected') {
      await userService.setIdCardVerified(uid, false);
      await userService.setRejectionReason(uid, rejectionReason ?? 'Your ID card could not be verified. Please submit a clearer image.');
      await userService.updateVerificationStatus(uid, 'rejected');
    } else {
      await userService.updateVerificationStatus(uid, 'pending');
    }

    const updated = await userService.getUser(uid);
    return res.json(updated);
  } catch (error) {
    console.error('Error updating verification:', error);
    return res.status(500).json({ error: 'Failed to update verification' });
  }
});

export default router;
