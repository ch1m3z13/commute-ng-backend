import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { userService, sanitizeUser } from '../services/userService.js';
import { hashPassword, verifyPassword, signJwt } from '../config/auth.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authLimiter, strictAuthLimiter } from '../middleware/rateLimiter.js';
import { createRefreshToken } from '../services/refreshTokenService.js';
import { ratingService } from '../services/ratingService.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email().transform(val => val.toLowerCase().trim()),
  password: z.string().min(8).max(128)
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' }),
});

const loginSchema = z.object({
  email: z.string().email().transform(val => val.toLowerCase().trim()),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  mobileNumber: z.string().regex(/^\d{10}$/).optional(),
  company: z.string().max(100).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128)
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' }),
});

const vehicleSchema = z.object({
  carMake: z.string().min(1).max(50).optional(),
  carModel: z.string().min(1).max(50).optional(),
  carYear: z.string().regex(/^\d{4}$/).optional(),
  plateNumber: z.string().min(1).max(20).optional(),
});

const matchingPreferencesSchema = z.object({
  autoAccept: z.boolean().optional(),
  maxPickupDetourMeters: z.number().int().min(100).max(10000).optional(),
  timeFlexibilityMinutes: z.number().int().min(5).max(120).optional(),
  preferredShift: z.enum(['morning', 'evening', 'any']).optional(),
});

// POST /api/users/register
router.post('/register', authLimiter, async (req, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const { email, password } = parsed.data;

    const existing = await userService.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);
    const uid = randomUUID();
    await userService.createUser(uid, { email, passwordHash });
    await userService.setEmailVerified(uid, true);

    const token = signJwt({ uid, email });
    const refreshToken = await createRefreshToken(uid);

    return res.status(201).json({ token, uid, refreshToken });
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /api/users/login
router.post('/login', strictAuthLimiter, async (req, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const { email, password } = parsed.data;
    const user = await userService.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userWithPassword = user as typeof user & { passwordHash?: string };
    const valid = await verifyPassword(password, userWithPassword.passwordHash || '');
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signJwt({ uid: user.uid, email: user.email });
    const refreshToken = await createRefreshToken(user.uid);
    return res.json({ token, uid: user.uid, refreshToken });
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ error: 'Failed to log in' });
  }
});

router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const { revokeRefreshToken } = await import('../services/refreshTokenService.js');
      await revokeRefreshToken(refreshToken);
    }
    return res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Error logging out:', error);
    return res.status(500).json({ error: 'Failed to log out' });
  }
});

router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await userService.getUser(req.user!.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

const identitySchema = z.object({
  displayName: z.string().min(1).max(100),
  nin: z.string().length(11, { message: 'NIN must be exactly 11 digits' }).regex(/^\d+$/, { message: 'NIN must contain only numbers' }),
  mobileNumber: z.string().regex(/^\d{10}$/, { message: 'Invalid phone number format' }).optional(),
  company: z.string().max(100).optional(),
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = identitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid identity data', details: parsed.error.errors });
    }

    const user = await userService.createUser(req.user!.uid, {
      email: req.user!.email,
      ...parsed.data,
    });

    return res.status(201).json({ user: sanitizeUser(user) });
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
    return res.json({ user: sanitizeUser(user) });
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
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error('Error updating vehicle:', error);
    return res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

router.patch('/me/password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await userService.getUser(req.user!.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithPassword = user as typeof user & { passwordHash?: string };
    if (!userWithPassword.passwordHash) {
      return res.status(400).json({ error: 'No password set. Use OAuth login.' });
    }

    const valid = await verifyPassword(currentPassword, userWithPassword.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await hashPassword(newPassword);
    await userService.updateUser(req.user!.uid, { passwordHash } as any);

    const { revokeAllUserRefreshTokens } = await import('../services/refreshTokenService.js');
    await revokeAllUserRefreshTokens(req.user!.uid);

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ error: 'Failed to change password' });
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
    return res.json({ user: sanitizeUser(user) });
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
    return res.json({ user: sanitizeUser(user) });
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
    const parsed = matchingPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const user = await userService.updateMatchingPreferences(req.user!.uid, parsed.data);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error('Error updating matching preferences:', error);
    return res.status(500).json({ error: 'Failed to update matching preferences' });
  }
});

router.get('/drivers/top-rated', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const drivers = await userService.getVerifiedExecutives(req.user!.uid);
    return res.json(drivers.slice(0, 10).map(sanitizeUser));
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

router.get('/:uid/ratings', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await ratingService.getUserRatings(req.params.uid);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching user ratings:', error);
    return res.status(500).json({ error: 'Failed to fetch user ratings' });
  }
});

router.get('/:uid', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.params.uid !== req.user!.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await userService.getUser(req.params.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
