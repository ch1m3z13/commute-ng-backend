import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { notificationService } from '../services/notificationService.js';

const router = Router();

router.get('/stream', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering
  });

  // Send initial comment to establish connection
  res.write(': connected\n\n');

  // Register connection
  notificationService.addConnection(req.user!.uid, res);

  // Send heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notifications = await notificationService.getNotifications(req.user!.uid);
    return res.json({ notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.get('/unread-count', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.uid);
    return res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

router.patch('/read-all', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await notificationService.markAllAsRead(req.user!.uid);
    return res.status(204).send();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

router.patch('/:id/read', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await notificationService.markAsRead(req.user!.uid, req.params.id);
    return res.status(204).send();
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await notificationService.deleteNotification(req.user!.uid, req.params.id);
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
