import { Router } from 'express';
import { requestContractPower, requestContractPowerCancellation, getContractPowerStatus } from '../controllers/contractPower.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Request contract power for a loadsheet
router.post('/request', requestContractPower);

// Request cancellation of contract power for a loadsheet
router.post('/cancel', requestContractPowerCancellation);

// Get contract power request status for a loadsheet
router.get('/status/:loadsheetId', getContractPowerStatus);

export default router;
