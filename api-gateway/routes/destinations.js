import { Router } from 'express';
import {
  createDestination,
  listDestinations,
  updateDestination,
  deleteDestination,
  browseDestination
} from '../controllers/destination.controller.js';
import authenticate from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { createDestinationSchema, updateDestinationSchema, browseDestinationSchema } from '../middleware/validateRequest.js';
import { sandboxEgressLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// All destination management routes require user authentication
router.use(authenticate);

// Browse a provider's resources (e.g. NocoDB base → table) — outbound proxy, rate-limited
router.post('/browse', sandboxEgressLimiter, validateRequest(browseDestinationSchema), browseDestination);

// Create a new routing endpoint
router.post('/', validateRequest(createDestinationSchema), createDestination);

// List all endpoints for the logged-in user
router.get('/', listDestinations);

// Update URL, name, status, or cap
router.put('/:id', validateRequest(updateDestinationSchema), updateDestination);

// Remove endpoint
router.delete('/:id', deleteDestination);

export default router;
