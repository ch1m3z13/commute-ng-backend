import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { chatService } from '../services/chatService.js';
import { userService } from '../services/userService.js';

const router = Router();

router.get('/:rideId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const canAccess = await chatService.canAccessChat(req.params.rideId, req.user!.uid);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this chat' });
    }

    const messages = await chatService.getMessages(req.params.rideId);
    return res.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/:rideId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const canAccess = await chatService.canAccessChat(req.params.rideId, req.user!.uid);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this chat' });
    }

    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const user = await userService.getUser(req.user!.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const message = await chatService.sendMessage(
      req.params.rideId,
      req.user!.uid,
      user.displayName,
      user.photoURL || null,
      text.trim()
    );

    return res.status(201).json({ message });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
