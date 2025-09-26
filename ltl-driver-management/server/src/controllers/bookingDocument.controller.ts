import { Request, Response } from 'express';
import { prisma } from '../index';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/booking-documents');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `booking-${req.params.token}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  // Allow images and documents
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and documents are allowed.'));
  }
};

export const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

// Get booking by upload token (for document upload page)
export const getBookingByToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    const booking = await prisma.booking.findFirst({
      where: { 
        documentUploadToken: token,
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] }
      },
      include: {
        carrier: true,
        route: true,
        childBookings: {
          include: {
            route: true
          }
        },
        documents: {
          orderBy: { uploadedAt: 'desc' }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Invalid or expired upload link' });
    }

    // Check if token is expired (24 hours)
    if (booking.documentUploadTokenCreatedAt) {
      const tokenAge = Date.now() - booking.documentUploadTokenCreatedAt.getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (tokenAge > maxAge) {
        return res.status(403).json({ message: 'Upload link has expired' });
      }
    }

    return res.json(booking);
  } catch (error) {
    console.error('Get booking by token error:', error);
    return res.status(500).json({ message: 'Failed to fetch booking' });
  }
};

// Upload documents for a booking
export const uploadBookingDocuments = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { documentType, legNumber, notes } = req.body;
    
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    // Find booking by token
    const booking = await prisma.booking.findFirst({
      where: { 
        documentUploadToken: token,
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] }
      }
    });

    if (!booking) {
      // Delete uploaded files
      for (const file of req.files) {
        fs.unlinkSync(file.path);
      }
      return res.status(404).json({ message: 'Invalid or expired upload link' });
    }

    // Check if token is expired
    if (booking.documentUploadTokenCreatedAt) {
      const tokenAge = Date.now() - booking.documentUploadTokenCreatedAt.getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (tokenAge > maxAge) {
        // Delete uploaded files
        for (const file of req.files) {
          fs.unlinkSync(file.path);
        }
        return res.status(403).json({ message: 'Upload link has expired' });
      }
    }

    // Create document records
    const uploadedDocuments = await Promise.all(
      req.files.map(file => 
        prisma.bookingDocument.create({
          data: {
            bookingId: booking.id,
            documentType: documentType || 'manifest',
            filename: file.originalname,
            filePath: file.path,
            legNumber: legNumber ? parseInt(legNumber) : undefined,
            notes: notes
          }
        })
      )
    );

    // Update booking to indicate documents have been uploaded
    await prisma.booking.update({
      where: { id: booking.id },
      data: { hasUploadedDocuments: true }
    });

    return res.json({
      message: 'Documents uploaded successfully',
      documents: uploadedDocuments
    });
  } catch (error) {
    console.error('Upload booking documents error:', error);
    
    // Clean up uploaded files on error
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          console.error('Failed to delete file:', e);
        }
      }
    }
    
    return res.status(500).json({ message: 'Failed to upload documents' });
  }
};

// Get documents for a booking (internal use)
export const getBookingDocuments = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    
    const documents = await prisma.bookingDocument.findMany({
      where: { bookingId: parseInt(bookingId) },
      orderBy: { uploadedAt: 'desc' }
    });

    return res.json(documents);
  } catch (error) {
    console.error('Get booking documents error:', error);
    return res.status(500).json({ message: 'Failed to fetch documents' });
  }
};

// Download a document
export const downloadDocument = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    
    const document = await prisma.bookingDocument.findUnique({
      where: { id: parseInt(documentId) }
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check if file exists
    if (!fs.existsSync(document.filePath)) {
      return res.status(404).json({ message: 'Document file not found' });
    }

    return res.download(document.filePath, document.filename);
  } catch (error) {
    console.error('Download document error:', error);
    return res.status(500).json({ message: 'Failed to download document' });
  }
};

// Delete a document
export const deleteDocument = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    
    const document = await prisma.bookingDocument.findUnique({
      where: { id: parseInt(documentId) },
      include: { booking: true }
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Delete file from filesystem
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    // Delete database record
    await prisma.bookingDocument.delete({
      where: { id: parseInt(documentId) }
    });

    // Check if this was the last document
    const remainingDocs = await prisma.bookingDocument.count({
      where: { bookingId: document.bookingId }
    });

    if (remainingDocs === 0) {
      await prisma.booking.update({
        where: { id: document.bookingId },
        data: { hasUploadedDocuments: false }
      });
    }

    return res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    return res.status(500).json({ message: 'Failed to delete document' });
  }
};