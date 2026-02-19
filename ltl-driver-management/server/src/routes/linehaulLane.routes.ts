import { Router } from 'express';
import {
  getLinehaulLanes,
  getLinehaulLaneById,
  createLinehaulLane,
  updateLinehaulLane,
  deleteLinehaulLane,
  getOriginLocations
} from '../controllers/linehaulLane.controller';

const router = Router();

// Get unique origin locations for dropdown
router.get('/origins', getOriginLocations);

// Get all linehaul lanes with optional filtering
router.get('/', getLinehaulLanes);

// Get single linehaul lane by ID
router.get('/:id', getLinehaulLaneById);

// Create linehaul lane
router.post('/', createLinehaulLane);

// Update linehaul lane
router.put('/:id', updateLinehaulLane);

// Delete linehaul lane
router.delete('/:id', deleteLinehaulLane);

export default router;
