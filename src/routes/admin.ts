import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { userService, sanitizeUser } from '../services/userService.js';
import { commuteService } from '../services/commuteService.js';
import { rideService } from '../services/rideService.js';
import { getDb } from '../config/database.js';
import { z } from 'zod';

const router = Router();

// Admin guard middleware
async function requireAdmin(req: AuthenticatedRequest, res: Response, next: Function) {
  try {
    const isAdmin = await userService.checkIsAdmin(req.user!.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch {
    return res.status(500).json({ error: 'Failed to verify admin status' });
  }
}

// All admin routes require auth + admin
router.use(authenticateToken, requireAdmin);

// ─── Dashboard Stats ────────────────────────────────────────────────────────

router.get('/stats', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();

    const usersResult = await db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: string | number };
    const pendingResult = await db.prepare("SELECT COUNT(*) as count FROM users WHERE verificationStatus = 'pending'").get() as { count: string | number };
    const activeCommutesResult = await db.prepare("SELECT COUNT(*) as count FROM commutes WHERE status = 'active'").get() as { count: string | number };
    const activeRidesResult = await db.prepare("SELECT COUNT(*) as count FROM rides WHERE status IN ('pending', 'accepted')").get() as { count: string | number };

    return res.json({
      totalUsers: Number(usersResult.count),
      pendingVerifications: Number(pendingResult.count),
      activeCommutes: Number(activeCommutesResult.count),
      activeRides: Number(activeRidesResult.count),
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── User Management ────────────────────────────────────────────────────────

router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string)?.trim() || '';

    let whereClause = '';
    const params: Record<string, unknown> = { limit, offset };

    if (search) {
      whereClause = "WHERE uid ILIKE @search OR email ILIKE @search OR displayName ILIKE @search";
      params.search = `%${search}%`;
    }

    const countResult = await db.prepare(`SELECT COUNT(*) as count FROM users ${whereClause}`).get(
      search ? { search: params.search } : {}
    ) as { count: string | number };

    const rows = await db.prepare(
      `SELECT uid, displayName, email, mobileNumber, role, verificationStatus, isVerified, rating, createdAt, updatedAt
       FROM users ${whereClause}
       ORDER BY createdAt DESC
       LIMIT @limit OFFSET @offset`
    ).all(params) as Record<string, unknown>[];

    return res.json({
      users: rows.map(u => ({
        uid: u.uid,
        displayName: u.displayname || u.displayName,
        email: u.email,
        mobileNumber: u.mobilenumber || u.mobileNumber,
        role: u.role,
        verificationStatus: u.verificationstatus || u.verificationStatus,
        isVerified: Boolean(u.isverified ?? u.isVerified),
        rating: Number(u.rating),
        createdAt: u.createdat || u.createdAt,
        updatedAt: u.updatedat || u.updatedAt,
      })),
      total: Number(countResult.count),
      page,
      pageSize: limit,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/users/:uid', async (req: AuthenticatedRequest, res: Response) => {
  try {
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

const roleUpdateSchema = z.object({
  role: z.enum(['executive', 'admin']),
});

router.patch('/users/:uid/role', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = roleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid role', details: parsed.error.errors });
    }

    const targetUser = await userService.getUser(req.params.uid);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updated = await userService.updateUser(req.params.uid, { role: parsed.data.role } as any);
    return res.json({ user: sanitizeUser(updated!) });
  } catch (error) {
    console.error('Error updating user role:', error);
    return res.status(500).json({ error: 'Failed to update role' });
  }
});

// ─── Verification Management ────────────────────────────────────────────────

router.get('/verifications/pending', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const rows = await db.prepare(`
      SELECT uid, displayName, email, mobileNumber, nin, verificationStatus,
             idCardUrl, idCardVerified, rejectionReason, createdAt
      FROM users
      WHERE verificationStatus = 'pending'
      ORDER BY createdAt ASC
    `).all() as Record<string, unknown>[];

    return res.json({
      users: rows.map(u => ({
        uid: u.uid,
        displayName: u.displayname || u.displayName,
        email: u.email,
        mobileNumber: u.mobilenumber || u.mobileNumber,
        nin: u.nin,
        verificationStatus: u.verificationstatus || u.verificationStatus,
        idCardUrl: u.idcardurl || u.idCardUrl,
        idCardVerified: Boolean(u.idcardverified ?? u.idCardVerified),
        rejectionReason: u.rejectionreason || u.rejectionReason,
        createdAt: u.createdat || u.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching pending verifications:', error);
    return res.status(500).json({ error: 'Failed to fetch pending verifications' });
  }
});

// ─── Commute Management ─────────────────────────────────────────────────────

router.get('/commutes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    let whereClause = '';
    const params: Record<string, unknown> = { limit, offset };

    if (status) {
      whereClause = 'WHERE c.status = @status';
      params.status = status;
    }

    const countResult = await db.prepare(`SELECT COUNT(*) as count FROM commutes c ${whereClause}`).get(
      status ? { status } : {}
    ) as { count: string | number };

    const rows = await db.prepare(`
      SELECT c.*, u.displayName as authorName, u.email as authorEmail
      FROM commutes c
      LEFT JOIN users u ON c.authorUid = u.uid
      ${whereClause}
      ORDER BY c.createdAt DESC
      LIMIT @limit OFFSET @offset
    `).all(params) as Record<string, unknown>[];

    return res.json({
      commutes: rows,
      total: Number(countResult.count),
      page,
      pageSize: limit,
    });
  } catch (error) {
    console.error('Error fetching commutes:', error);
    return res.status(500).json({ error: 'Failed to fetch commutes' });
  }
});

// ─── Ride Management ────────────────────────────────────────────────────────

router.get('/rides', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    let whereClause = '';
    const params: Record<string, unknown> = { limit, offset };

    if (status) {
      whereClause = 'WHERE r.status = @status';
      params.status = status;
    }

    const countResult = await db.prepare(`SELECT COUNT(*) as count FROM rides r ${whereClause}`).get(
      status ? { status } : {}
    ) as { count: string | number };

    const rows = await db.prepare(`
      SELECT r.*,
        d.displayName as driverName, d.email as driverEmail,
        p.displayName as passengerName, p.email as passengerEmail
      FROM rides r
      LEFT JOIN users d ON r.driverUid = d.uid
      LEFT JOIN users p ON r.passengerUid = p.uid
      ${whereClause}
      ORDER BY r.createdAt DESC
      LIMIT @limit OFFSET @offset
    `).all(params) as Record<string, unknown>[];

    return res.json({
      rides: rows.map(r => ({
        id: r.id,
        commuteId: r.commuteid || r.commuteId,
        driverUid: r.driveruid || r.driverUid,
        driverName: r.driverName,
        driverEmail: r.driverEmail,
        passengerUid: r.passengeruid || r.passengerUid,
        passengerName: r.passengerName,
        passengerEmail: r.passengerEmail,
        startPoint: r.startpoint || r.startPoint,
        destination: r.destination,
        departureTime: r.departuretime || r.departureTime,
        status: r.status,
        matchScore: r.matchscore != null ? Number(r.matchscore || r.matchScore) : null,
        createdAt: r.createdat || r.createdAt,
      })),
      total: Number(countResult.count),
      page,
      pageSize: limit,
    });
  } catch (error) {
    console.error('Error fetching rides:', error);
    return res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

// ─── Deactivate User (soft delete) ──────────────────────────────────────────

router.patch('/users/:uid/deactivate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUser = await userService.getUser(req.params.uid);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-deactivation
    if (req.params.uid === req.user!.uid) {
      return res.status(400).json({ error: 'Cannot deactivate yourself' });
    }

    const updated = await userService.updateUser(req.params.uid, {
      verificationStatus: 'rejected',
      rejectionReason: 'Account deactivated by admin',
    } as any);

    return res.json({ user: sanitizeUser(updated!), message: 'User deactivated' });
  } catch (error) {
    console.error('Error deactivating user:', error);
    return res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

export default router;
