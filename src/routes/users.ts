import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { userService } from '../services/userService.js';
import { hashPassword, verifyPassword, signJwt } from '../config/auth.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

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

// POST /api/users/register
router.post('/register', async (req, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const { email, password, displayName } = parsed.data;

    const existing = await userService.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);
    const uid = randomUUID();
    await userService.createUser(uid, { email, displayName, passwordHash });

    const token = signJwt({ uid, email });
    return res.status(201).json({ token, uid });
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /api/users/login
router.post('/login', async (req, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.error) {
      const { email, password } = parsed.data;
      const user = await userService.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const valid = await verifyPassword(password, (user as unknown as { passwordHash?: string }).passwordHash || '');
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = signJwt({ uid: user.uid, email: user.email });
      return res.json({ token, uid: user.uid });
    } else {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ error: 'Failed to log in' });
  }
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

// Update home/office addresses
router.patch('/me/addresses', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { homeAddress, homeLat, homeLng, officeAddress, officeLat, officeLng } = req.body;
    const user = await userService.updateAddresses(req.user!.uid, {
      homeAddress, homeLat, homeLng, officeAddress, officeLat, officeLng,
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error('Error updating addresses:', error);
    return res.status(500).json({ error: 'Failed to update addresses' });
  }
});

// Get/update matching preferences
router.get('/me/matching-preferences', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const prefs = await userService.getMatchingPreferences(req.user!.uid);
    return res.json(prefs);
  } catch (error) {
    console.error('Error fetching matching preferences:', error);
    return res.status(500).json({ error: 'Failed to fetch matching preferences' });
  }
});

router.patch('/me/matching-preferences', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await userService.updateMatchingPreferences(req.user!.uid, req.body);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error('Error updating matching preferences:', error);
    return res.status(500).json({ error: 'Failed to update matching preferences' });
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
