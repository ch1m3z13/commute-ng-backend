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
  sendSms,
} from '../services/verificationService.js';
import { z } from 'zod';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const sendOtpSchema = z.object({
  mobileNumber: z.string().regex(/^\d{10,15}$/, 'Invalid phone number format'),
});

const verifyOtpSchema = z.object({
  mobileNumber: z.string(),
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

    const phoneVerified = Boolean(user.phoneVerified);
    const ninVerified  = Boolean(user.ninVerified);
    const idCardVerified = Boolean(user.idCardVerified);
    const idCardStatus = toIdCardStatus(
      idCardVerified,
      user.idCardUrl,
      user.verificationStatus ?? 'unverified',
    );

    const tier = computeTier({ phoneVerified, ninVerified, idCardVerified });

    return res.json({
      tier,
      phoneVerified,
      ninVerified,
      idCardVerified,
      idCardStatus,
      rejectionReason: user.rejectionReason ?? undefined,
      // Backward-compat
      isVerified: idCardVerified,
      verificationStatus: user.verificationStatus ?? 'unverified',
    });
  } catch (error) {
    console.error('Error fetching verification status:', error);
    return res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

// ─── POST /api/verification/otp/send ─────────────────────────────────────────
// Generates a 6-digit OTP and sends it to the given mobile number.
// Rate-limit: the same number can only request a new OTP once per 2 minutes.

const otpSendTtlSeconds = 120; // 2 minutes
// In-memory rate-limit store (per-process). For multi-instance deploy, use Redis.
const otpRateLimit: Record<string, number> = {};

router.post('/otp/send', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = sendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid phone number', details: parsed.error.errors });
    }

    const { mobileNumber } = parsed.data;
    const key = `${req.user!.uid}:${mobileNumber}`;
    const now = Date.now();

    if (otpRateLimit[key] && now - otpRateLimit[key] < otpSendTtlSeconds * 1000) {
      const waitSec = Math.ceil((otpSendTtlSeconds * 1000 - (now - otpRateLimit[key])) / 1000);
      return res.status(429).json({
        error: 'Too many requests',
        details: `Please wait ${waitSec} seconds before requesting a new code.`,
      });
    }

    const otp = await generateAndStoreOtp(req.user!.uid);
    await sendSms(mobileNumber, `Your CommuteNG verification code is: ${otp}. It expires in 10 minutes.`);

    otpRateLimit[key] = now;

    return res.json({
      message: 'OTP sent',
      expiresInSeconds: 10 * 60,
      // In development only — remove in production
      ...(process.env.NODE_ENV !== 'production' ? { _debug_otp: otp } : {}),
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// ─── POST /api/verification/otp/verify ────────────────────────────────────────
// Verifies the OTP code. On success, marks phoneVerified = 1.

router.post('/otp/verify', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const { mobileNumber, code } = parsed.data;

    const valid = await verifyOtp(req.user!.uid, code);
    if (!valid) {
      return res.status(400).json({
        error: 'Invalid or expired OTP',
        details: 'The code you entered is incorrect or has expired. Request a new one.',
      });
    }

    // Update the user's mobile number if it's new or changed
    const user = await userService.getUser(req.user!.uid);
    if (user && user.mobileNumber !== mobileNumber) {
      await userService.updateUser(req.user!.uid, { mobileNumber });
    }

    return res.json({ message: 'Phone number verified', phoneVerified: true });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// ─── POST /api/verification/nin/validate ──────────────────────────────────────
// Validates NIN format. On success, marks ninVerified = 1.
// Full government NIN verification (NIMC API) requires authorized credentials
// and is done manually by admins for now.

router.post('/nin/validate', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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

router.post('/id-card/submit', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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

router.post('/resend-otp', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await userService.getUser(req.user!.uid);
    if (!user?.mobileNumber) {
      return res.status(400).json({ error: 'No mobile number on file. Submit your phone number first.' });
    }

    await clearOtp(req.user!.uid);
    const otp = await generateAndStoreOtp(req.user!.uid);
    await sendSms(user.mobileNumber, `Your CommuteNG verification code is: ${otp}. It expires in 10 minutes.`);

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
// On approval: sets idCardVerified = 1 and verificationStatus = 'verified'.
// On rejection: sets verificationStatus = 'rejected' and stores the reason.

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
      // Just update status to pending (admin re-opening review)
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
