import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { commuteService } from '../services/commuteService.js';
import { userService } from '../services/userService.js';
import { geocodingService } from '../services/geocodingService.js';
import { z } from 'zod';

const router = Router();

// Autocomplete endpoint — get location suggestions
router.get('/autocomplete', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'q parameter is required' });
    }
    const results = await geocodingService.autocomplete(q);
    return res.json({ results });
  } catch (error: any) {
    console.error('Autocomplete error:', error);
    return res.status(400).json({ error: error.message || 'Autocomplete failed' });
  }
});

// Geocoding endpoint — convert address to lat/lng
router.get('/geocode', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'q parameter is required' });
    }
    const result = await geocodingService.geocode(q);
    return res.json({ results: [{ lat: result.lat, lng: result.lng, displayName: result.displayName }] });
  } catch (error: any) {
    console.error('Geocoding error:', error);
    return res.status(400).json({ error: error.message || 'Geocoding failed' });
  }
});

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
  // Optional: if client already has coordinates (e.g. from autocomplete)
  startLat: z.number().optional(),
  startLng: z.number().optional(),
  destLat: z.number().optional(),
  destLng: z.number().optional(),
  pickupRadiusMeters: z.number().int().min(500).max(5000).optional(),
  timeFlexibilityMinutes: z.number().int().min(5).max(120).optional(),
});

const updateCommuteSchema = z.object({
  startPoint: z.string().min(1).max(200).optional(),
  destination: z.string().min(1).max(200).optional(),
  departureTime: z.string().min(1).optional(),
  seatsAvailable: z.number().int().min(1).max(6).optional(),
  carMake: z.string().min(1).max(50).optional(),
  carModel: z.string().min(1).max(50).optional(),
  carYear: z.string().regex(/^\d{4}$/).optional(),
  plateNumber: z.string().min(1).max(20).optional(),
  shift: z.enum(['morning', 'evening']).optional(),
  recurring: z.boolean().optional(),
  daysOfWeek: z.array(z.string()).optional(),
  startLat: z.number().optional(),
  startLng: z.number().optional(),
  destLat: z.number().optional(),
  destLng: z.number().optional(),
  pickupRadiusMeters: z.number().int().min(500).max(5000).optional(),
  timeFlexibilityMinutes: z.number().int().min(5).max(120).optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
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

/**
 * Geospatial matching endpoint.
 * GET /api/commutes/match?pickupLat=...&pickupLng=...&dropoffLat=...&dropoffLng=...&desiredTime=...&shift=...
 */
router.get('/match', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng, desiredTime, shift } = req.query;

    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng || !desiredTime || !shift) {
      return res.status(400).json({
        error: 'pickupLat, pickupLng, dropoffLat, dropoffLng, desiredTime, and shift are required',
      });
    }

    const pLat = parseFloat(pickupLat as string);
    const pLng = parseFloat(pickupLng as string);
    const dLat = parseFloat(dropoffLat as string);
    const dLng = parseFloat(dropoffLng as string);

    if (isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    if (shift !== 'morning' && shift !== 'evening') {
      return res.status(400).json({ error: 'shift must be morning or evening' });
    }

    const matches = await commuteService.searchCommutes({
      pickupLat: pLat,
      pickupLng: pLng,
      dropoffLat: dLat,
      dropoffLng: dLng,
      desiredTime: desiredTime as string,
      shift: shift as 'morning' | 'evening',
    });

    return res.json({ matches });
  } catch (error) {
    console.error('Error matching commutes:', error);
    return res.status(500).json({ error: 'Failed to search commutes' });
  }
});

/**
 * Legacy search endpoint (kept for backward compat, now uses geocoding).
 */
router.get('/search', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { from, to, desiredTime, shift } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query parameters are required' });
    }

    // Geocode the from/to addresses
    let pLat: number, pLng: number, dLat: number, dLng: number;
    try {
      const fromGeo = await geocodingService.geocode(from as string);
      pLat = fromGeo.lat;
      pLng = fromGeo.lng;
      const toGeo = await geocodingService.geocode(to as string);
      dLat = toGeo.lat;
      dLng = toGeo.lng;
    } catch (geoErr: any) {
      return res.status(400).json({ error: geoErr.message || 'Failed to geocode addresses' });
    }

    const matches = await commuteService.searchCommutes({
      pickupLat: pLat,
      pickupLng: pLng,
      dropoffLat: dLat,
      dropoffLng: dLng,
      desiredTime: (desiredTime as string) || '08:00',
      shift: (shift as 'morning' | 'evening') || 'morning',
    });

    return res.json({ matches });
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
  } catch (error: any) {
    console.error('Error creating commute:', error);
    if (error.message && error.message.includes('Address not found')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to create commute' });
  }
});

router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = updateCommuteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const commute = await commuteService.updateCommute(req.params.id, req.user!.uid, parsed.data);
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
