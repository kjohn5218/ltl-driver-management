import express from 'express';
import { 
  getBookingByToken,
  uploadBookingDocuments,
  getBookingDocuments,
  downloadDocument,
  deleteDocument,
  upload
} from '../controllers/bookingDocument.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// Public routes (for document upload via token)
router.get('/upload/:token', getBookingByToken);
router.post('/upload/:token', upload.array('documents', 10), uploadBookingDocuments);

// Protected routes (for internal use)
router.use(authenticate);
router.get('/booking/:bookingId', getBookingDocuments);
router.get('/download/:documentId', downloadDocument);
router.delete('/:documentId', deleteDocument);

export default router;