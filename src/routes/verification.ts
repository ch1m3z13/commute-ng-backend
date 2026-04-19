import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { userService } from '../services/userService.js';
import { z } from 'zod';

const router = Router();

const verificationSchema = z.object({
  employmentLetterUrl: z.string().url().optional(),
  idCardUrl: z.string().url().optional(),
  payStubUrl: z.string().url().optional(),
});

router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await userService.getUser(req.user!.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({
      verificationStatus: user.verificationStatus || 'unverified',
      isVerified: user.isVerified,
    });
  } catch (error) {
    console.error('Error fetching verification status:', error);
    return res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

router.post('/submit', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await userService.getUser(req.user!.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.displayName || !user.nin) {
      return res.status(400).json({
        error: 'Identity setup required before verification. Please complete your profile first.',
      });
    }

    if (user.verificationStatus === 'pending') {
      return res.status(400).json({ error: 'Verification already in progress' });
    }

    if (user.verificationStatus === 'verified') {
      return res.status(400).json({ error: 'Already verified' });
    }

    const parsed = verificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const updatedUser = await userService.updateVerificationStatus(
      req.user!.uid,
      'pending',
      parsed.data
    );

    return res.json(updatedUser);
  } catch (error) {
    console.error('Error submitting verification:', error);
    return res.status(500).json({ error: 'Failed to submit verification' });
  }
});

router.patch('/admin/:uid', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = await userService.checkIsAdmin(req.user!.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status } = req.body;
    if (!['pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updatedUser = await userService.updateVerificationStatus(req.params.uid, status);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(updatedUser);
  } catch (error) {
    console.error('Error updating verification:', error);
    return res.status(500).json({ error: 'Failed to update verification' });
  }
});

export default router;
