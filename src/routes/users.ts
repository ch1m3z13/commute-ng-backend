import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { userService } from '../services/userService.js';
import { z } from 'zod';

const router = Router();

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  mobileNumber: z.string().regex(/^\d{10}$/).optional(),
  company: z.string().max(100).optional(),
});

const vehicleSchema = z.object({
  carMake: z.string().min(1).max(50).optional(),
  carModel: z.string().min(1).max(50).optional(),
  carYear: z.string().regex(/^\d{4}$/).optional(),
  plateNumber: z.string().min(1).max(20).optional(),
});

router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await userService.getUser(req.user!.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { displayName, mobileNumber, nin, company } = req.body;

    if (!displayName || !nin) {
      return res.status(400).json({ error: 'displayName and nin are required' });
    }

    const user = await userService.createUser(req.user!.uid, {
      email: req.user!.email,
      displayName,
      mobileNumber,
      nin,
      company,
    });

    return res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

router.patch('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const user = await userService.updateUser(req.user!.uid, parsed.data);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

router.patch('/me/vehicle', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = vehicleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const user = await userService.updateVehicle(req.user!.uid, parsed.data);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    return res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

router.patch('/me/phone', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mobileNumber } = req.body;

    if (!mobileNumber || !/^\d{10}$/.test(mobileNumber)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const user = await userService.updateUser(req.user!.uid, { mobileNumber });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error('Error updating phone:', error);
    return res.status(500).json({ error: 'Failed to update phone' });
  }
});

router.get('/drivers/top-rated', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const drivers = await userService.getVerifiedExecutives(req.user!.uid);
    return res.json(drivers.slice(0, 10));
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

router.get('/:uid', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await userService.getUser(req.params.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
