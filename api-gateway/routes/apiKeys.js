import { Router } from 'express';
import { generateKey, listKeys, revokeKey } from '../controllers/apiKey.controller.js';
import authenticate from '../middleware/auth.js';

const router = Router();

// All API Key management routes require a valid user session
router.use(authenticate);

// Generate a new API Key
router.post('/', generateKey);

// List all API Keys for the user
router.get('/', listKeys);

// Revoke an API Key by ID
router.delete('/:id', revokeKey);

export default router;
