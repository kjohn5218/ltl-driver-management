import { Router } from 'express';
import { body, query } from 'express-validator';
import { 
  getCarriers, 
  getCarrierById, 
  createCarrier, 
  updateCarrier, 
  deleteCarrier,
  searchCarriers,
  uploadDocument,
  inviteCarrier,
  validateInvitation,
  registerCarrier,
  addCarrierDriver,
  updateCarrierDriver,
  deleteCarrierDriver,
  getCarrierDrivers,
  getCarrierInvitations,
  cancelCarrierInvitation,
  getCarrierAgreements,
  downloadAgreementAffidavit,
  downloadAgreementWithAffidavit,
  getCarrierDocuments,
  downloadCarrierDocument,
  deleteCarrierDocument,
  lookupCarrierData,
  sendIntellIviteInvitation,
  previewCarrierMCP,
  syncCarrierFromMCP,
  toggleCarrierMonitoring,
  getCarrierMCPStatus
} from '../controllers/carrier.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { upload } from '../middleware/upload.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Public routes (no authentication required)
router.get('/validate-invitation/:token', validateInvitation);
router.post('/register', upload.single('insuranceDocument'), registerCarrier);

// All other routes require authentication
router.use(authenticate);

// Get all carriers with filtering
router.get(
  '/',
  [
    query('status').optional().isIn(['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'NOT_ONBOARDED', 'ONBOARDED', 'REJECTED']),
    query('onboardingComplete').optional().isBoolean(),
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 5000 })
  ],
  validateRequest,
  getCarriers
);

// Search carriers
router.get(
  '/search',
  [
    query('q').notEmpty().trim()
  ],
  validateRequest,
  searchCarriers
);

// Lookup carrier data from external API (Admin/Dispatcher only)
router.post(
  '/lookup',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('dotNumber').optional().trim(),
    body('mcNumber').optional().trim()
  ],
  validateRequest,
  lookupCarrierData
);

// Send MyCarrierPackets intellivite invitation (Admin/Dispatcher only)
router.post(
  '/invite-intellivite',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('dotNumber').optional().trim(),
    body('mcNumber').optional().trim(),
    body('email').notEmpty().isEmail().normalizeEmail(),
    body('username').optional().trim()
  ],
  validateRequest,
  sendIntellIviteInvitation
);

// MyCarrierPackets Integration Routes

// Preview carrier from MCP (Admin/Dispatcher only)
router.get(
  '/mcp/preview',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    query('dotNumber').notEmpty().trim(),
    query('mcNumber').optional().trim()
  ],
  validateRequest,
  previewCarrierMCP
);

// Get carrier invitations (Admin/Dispatcher only) - Must come before /:id route
router.get(
  '/invitations',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['PENDING', 'REGISTERED', 'EXPIRED', 'CANCELLED'])
  ],
  validateRequest,
  getCarrierInvitations
);

// Get specific carrier
router.get('/:id', getCarrierById);

// Create new carrier (Admin/Dispatcher only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('name').notEmpty().trim(),
    body('contactPerson').optional().trim(),
    body('phone').optional().isMobilePhone('any'),
    body('email').optional().isEmail().normalizeEmail(),
    body('mcNumber').optional().trim(),
    body('dotNumber').optional().trim(),
    body('insuranceExpiration').optional().isISO8601(),
    body('ratePerMile').optional().isDecimal()
  ],
  validateRequest,
  createCarrier
);

// Update carrier (Admin/Dispatcher only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('name').optional().notEmpty().trim(),
    body('contactPerson').optional().trim(),
    body('phone').optional().isMobilePhone('any'),
    body('email').optional().isEmail().normalizeEmail(),
    body('mcNumber').optional().trim(),
    body('dotNumber').optional().trim(),
    body('insuranceExpiration').optional().isISO8601(),
    body('status').optional().isIn(['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'REJECTED']),
    body('rating').optional().isDecimal({ decimal_digits: '0,1' }),
    body('ratePerMile').optional().isDecimal(),
    body('onboardingComplete').optional().isBoolean()
  ],
  validateRequest,
  updateCarrier
);

// Delete carrier (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  deleteCarrier
);

// Upload carrier documents (Admin/Dispatcher only)
router.post(
  '/:id/documents',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  upload.single('document'),
  [
    body('documentType').notEmpty().trim()
  ],
  validateRequest,
  uploadDocument
);

// Invite carrier (Admin/Dispatcher only)
router.post(
  '/invite',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('email').notEmpty().isEmail().normalizeEmail(),
    body('sendMCPInvite').optional().isBoolean(),
    body('dotNumber').optional().trim(),
    body('mcNumber').optional().trim()
  ],
  validateRequest,
  inviteCarrier
);

// MyCarrierPackets Integration Routes for specific carriers

// Get MCP status for a carrier (Admin/Dispatcher only)
router.get(
  '/:id/mcp/status',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  getCarrierMCPStatus
);

// Sync carrier data from MCP (Admin/Dispatcher only)
router.post(
  '/:id/mcp/sync',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  syncCarrierFromMCP
);

// Toggle carrier monitoring in MCP (Admin/Dispatcher only)
router.post(
  '/:id/mcp/monitor',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('monitor').notEmpty().isBoolean()
  ],
  validateRequest,
  toggleCarrierMonitoring
);

// Cancel carrier invitation (Admin/Dispatcher only)
router.put(
  '/invitations/:id/cancel',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  cancelCarrierInvitation
);

// Driver management routes
// Get carrier drivers
router.get('/:carrierId/drivers', getCarrierDrivers);

// Add driver to carrier (Admin/Dispatcher only)
router.post(
  '/:carrierId/drivers',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('name').notEmpty().trim(),
    body('phoneNumber').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('licenseNumber').optional().trim()
  ],
  validateRequest,
  addCarrierDriver
);

// Update carrier driver (Admin/Dispatcher only)
router.put(
  '/:carrierId/drivers/:driverId',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('name').optional().notEmpty().trim(),
    body('phoneNumber').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('licenseNumber').optional().trim(),
    body('active').optional().isBoolean()
  ],
  validateRequest,
  updateCarrierDriver
);

// Delete carrier driver (Admin/Dispatcher only)
router.delete(
  '/:carrierId/drivers/:driverId',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  deleteCarrierDriver
);

// Agreement management routes
// Get carrier agreements
router.get('/:id/agreements', getCarrierAgreements);

// Download agreement affidavit
router.get('/:id/agreements/:agreementId/affidavit', downloadAgreementAffidavit);

// Download full agreement with affidavit
router.get('/:id/agreements/:agreementId/full', downloadAgreementWithAffidavit);

// Document management routes
// Get carrier documents
router.get('/:id/documents', getCarrierDocuments);

// Download carrier document
router.get('/:id/documents/:documentId', downloadCarrierDocument);

// Delete carrier document (Admin/Dispatcher only)
router.delete(
  '/:id/documents/:documentId',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  deleteCarrierDocument
);

export default router;