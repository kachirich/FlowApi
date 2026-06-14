import { Router } from 'express';
import { generateKey, listKeys, revokeKey, assignKeyFlow } from '../controllers/apiKey.controller.js';
import authenticate from '../middleware/auth.js';
import { validateRequest, assignFlowSchema } from '../middleware/validateRequest.js';

const router = Router();

// All API Key management routes require a valid user session
router.use(authenticate);

// Generate a new API Key
router.post('/', generateKey);

// List all API Keys for the user
router.get('/', listKeys);

// Assign (or unassign) a Flow to an API Key
router.put('/:id/flow', validateRequest(assignFlowSchema), assignKeyFlow);

// Revoke an API Key by ID
router.delete('/:id', revokeKey);

export default router;
