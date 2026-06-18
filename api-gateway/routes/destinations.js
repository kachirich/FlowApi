import { Router } from 'express';
import {
  createDestination,
  listDestinations,
  updateDestination,
  deleteDestination
} from '../controllers/destination.controller.js';
import authenticate from '../middleware/auth.js';

const router = Router();

// All destination management routes require user authentication
router.use(authenticate);

// Create a new routing endpoint
router.post('/', createDestination);

// List all endpoints for the logged-in user
router.get('/', listDestinations);

// Update URL, name, status, or cap
router.put('/:id', updateDestination);

// Remove endpoint
router.delete('/:id', deleteDestination);

export default router;
