import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { commuteService } from '../services/commuteService.js';
import { userService } from '../services/userService.js';
import { z } from 'zod';

const router = Router();

const createCommuteSchema = z.object({
  startPoint: z.string().min(1).max(200),
  destination: z.string().min(1).max(200),
  departureTime: z.string().min(1),
  seatsAvailable: z.number().int().min(1).max(6),
  carMake: z.string().min(1).max(50).optional(),
  carModel: z.string().min(1).max(50).optional(),
  carYear: z.string().regex(/^\d{4}$/).optional(),
  plateNumber: z.string().min(1).max(20).optional(),
  shift: z.enum(['morning', 'evening']).optional(),
  recurring: z.boolean().optional(),
  daysOfWeek: z.array(z.string()).optional(),
  type: z.enum(['offer', 'request']).default('offer'),
});

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, status, authorUid } = req.query;

    const commutes = await commuteService.getCommutes({
      type: type as 'offer' | 'request' | undefined,
      status: status as 'active' | 'completed' | 'cancelled' | undefined,
      authorUid: authorUid as string | undefined,
    });

    return res.json(commutes);
  } catch (error) {
    console.error('Error fetching commutes:', error);
    return res.status(500).json({ error: 'Failed to fetch commutes' });
  }
});

router.get('/search', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query parameters are required' });
    }

    const commutes = await commuteService.searchCommutes(from as string, to as string);
    return res.json(commutes);
  } catch (error) {
    console.error('Error searching commutes:', error);
    return res.status(500).json({ error: 'Failed to search commutes' });
  }
});

router.get('/my', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const commutes = await commuteService.getCommutes({
      authorUid: req.user!.uid,
      type: 'offer',
    });
    return res.json(commutes);
  } catch (error) {
    console.error('Error fetching my commutes:', error);
    return res.status(500).json({ error: 'Failed to fetch commutes' });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const commute = await commuteService.getCommute(req.params.id);
    if (!commute) {
      return res.status(404).json({ error: 'Commute not found' });
    }
    return res.json(commute);
  } catch (error) {
    console.error('Error fetching commute:', error);
    return res.status(500).json({ error: 'Failed to fetch commute' });
  }
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await userService.getUser(req.user!.uid);
    if (!user || user.verificationStatus !== 'verified') {
      return res.status(403).json({ error: 'Only verified users can create commutes' });
    }

    const parsed = createCommuteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const commute = await commuteService.createCommute(req.user!.uid, parsed.data);
    return res.status(201).json(commute);
  } catch (error) {
    console.error('Error creating commute:', error);
    return res.status(500).json({ error: 'Failed to create commute' });
  }
});

router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const commute = await commuteService.updateCommute(req.params.id, req.user!.uid, req.body);
    if (!commute) {
      return res.status(404).json({ error: 'Commute not found' });
    }
    return res.json(commute);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Error updating commute:', error);
    return res.status(500).json({ error: 'Failed to update commute' });
  }
});

router.patch('/:id/cancel', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const commute = await commuteService.updateCommute(req.params.id, req.user!.uid, { status: 'cancelled' });
    if (!commute) {
      return res.status(404).json({ error: 'Commute not found' });
    }
    return res.json(commute);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Error cancelling commute:', error);
    return res.status(500).json({ error: 'Failed to cancel commute' });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await commuteService.deleteCommute(req.params.id, req.user!.uid);
    if (!deleted) {
      return res.status(404).json({ error: 'Commute not found' });
    }
    return res.status(204).send();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Error deleting commute:', error);
    return res.status(500).json({ error: 'Failed to delete commute' });
  }
});

export default router;
