import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  unsubscribe,
  adminBroadcast,
} from '../controllers/notification.controller.js';

const router = Router();

// One-click unsubscribe — public, returns HTML
router.get('/unsubscribe/:token', unsubscribe);

// Authenticated user preference management
router.get('/preferences', authenticate, getNotificationPreferences);
router.put('/preferences', authenticate, updateNotificationPreferences);

// Admin-only broadcast
router.post('/broadcast', authenticate, (req, res, next) => {
  if (!req.user?.is_admin) {
    return res.status(403).json({ success: false, error: 'Admin only' });
  }
  next();
}, adminBroadcast);

export default router;
