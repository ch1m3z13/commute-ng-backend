import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { notificationService } from '../services/notificationService.js';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notifications = await notificationService.getNotifications(req.user!.uid);
    return res.json(notifications);
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

router.patch('/:id/read', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await notificationService.markAsRead(req.user!.uid, req.params.id);
    return res.status(204).send();
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
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
