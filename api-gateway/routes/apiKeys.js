import { Router } from 'express';
import {
  generateKey,
  listKeys,
  revokeKey,
  assignKeyFlow,
  rotateSigningSecret,
  deleteSigningSecret,
  setSignatureRequired,
} from '../controllers/apiKey.controller.js';
import authenticate from '../middleware/auth.js';
import { validateRequest, assignFlowSchema, signatureRequiredSchema } from '../middleware/validateRequest.js';

const router = Router();

// All API Key management routes require a valid user session
router.use(authenticate);

// Generate a new API Key
router.post('/', generateKey);

// List all API Keys for the user
router.get('/', listKeys);

// Assign (or unassign) a Flow to an API Key
router.put('/:id/flow', validateRequest(assignFlowSchema), assignKeyFlow);

// HMAC signing secret — generate/rotate (returned once) and remove
router.post('/:id/signing-secret', rotateSigningSecret);
router.delete('/:id/signing-secret', deleteSigningSecret);

// Toggle HMAC signature enforcement for a key
router.put('/:id/signature-required', validateRequest(signatureRequiredSchema), setSignatureRequired);

// Revoke an API Key by ID
router.delete('/:id', revokeKey);

export default router;
