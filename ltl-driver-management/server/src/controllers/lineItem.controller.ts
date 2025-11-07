import { Request, Response } from 'express';
import { prisma } from '../index';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for receipt uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'receipts');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const bookingId = req.params.bookingId;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `booking-${bookingId}-receipt-${timestamp}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
    }
  }
});

export const getBookingLineItems = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const lineItems = await prisma.bookingLineItem.findMany({
      where: { bookingId: parseInt(bookingId) },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.json(lineItems);
  } catch (error) {
    console.error('Get booking line items error:', error);
    return res.status(500).json({ message: 'Failed to fetch line items' });
  }
};

export const addBookingLineItem = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { category, description, amount, quantity = 1, unitPrice } = req.body;
    const userId = (req as any).user?.id;

    // Validate booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Allow adding line items even after booking is signed

    const lineItem = await prisma.bookingLineItem.create({
      data: {
        bookingId: parseInt(bookingId),
        category,
        description,
        amount: parseFloat(amount),
        quantity: parseInt(quantity),
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
        createdBy: userId
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return res.status(201).json(lineItem);
  } catch (error) {
    console.error('Add booking line item error:', error);
    return res.status(500).json({ message: 'Failed to add line item' });
  }
};

export const updateBookingLineItem = async (req: Request, res: Response) => {
  try {
    const { bookingId, lineItemId } = req.params;
    const { category, description, amount, quantity, unitPrice } = req.body;

    // Validate booking exists and is not signed
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Allow updating line items even after booking is signed

    const lineItem = await prisma.bookingLineItem.update({
      where: { 
        id: parseInt(lineItemId),
        bookingId: parseInt(bookingId)
      },
      data: {
        category,
        description,
        amount: amount ? parseFloat(amount) : undefined,
        quantity: quantity ? parseInt(quantity) : undefined,
        unitPrice: unitPrice ? parseFloat(unitPrice) : undefined
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return res.json(lineItem);
  } catch (error) {
    console.error('Update booking line item error:', error);
    return res.status(500).json({ message: 'Failed to update line item' });
  }
};

export const deleteBookingLineItem = async (req: Request, res: Response) => {
  try {
    const { bookingId, lineItemId } = req.params;

    // Validate booking exists and is not signed
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Allow deleting line items even after booking is signed

    // Get line item to check for receipt file
    const lineItem = await prisma.bookingLineItem.findUnique({
      where: { 
        id: parseInt(lineItemId),
        bookingId: parseInt(bookingId)
      }
    });

    if (!lineItem) {
      return res.status(404).json({ message: 'Line item not found' });
    }

    // Delete receipt file if it exists
    if (lineItem.receiptPath) {
      const filePath = path.join(process.cwd(), 'uploads', 'receipts', lineItem.receiptPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.bookingLineItem.delete({
      where: { 
        id: parseInt(lineItemId),
        bookingId: parseInt(bookingId)
      }
    });

    return res.json({ message: 'Line item deleted successfully' });
  } catch (error) {
    console.error('Delete booking line item error:', error);
    return res.status(500).json({ message: 'Failed to delete line item' });
  }
};

export const uploadLineItemReceipt = async (req: Request, res: Response) => {
  upload.single('receipt')(req, res, async (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({ message: err.message });
    }

    try {
      const { bookingId, lineItemId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Validate booking and line item
      const lineItem = await prisma.bookingLineItem.findUnique({
        where: { 
          id: parseInt(lineItemId),
          bookingId: parseInt(bookingId)
        },
        include: { booking: true }
      });

      if (!lineItem) {
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        return res.status(404).json({ message: 'Line item not found' });
      }

      // Allow uploading receipts even after booking is signed

      // Delete old receipt if it exists
      if (lineItem.receiptPath) {
        const oldFilePath = path.join(process.cwd(), 'uploads', 'receipts', lineItem.receiptPath);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      // Update line item with new receipt path
      const updatedLineItem = await prisma.bookingLineItem.update({
        where: { id: parseInt(lineItemId) },
        data: { receiptPath: file.filename },
        include: {
          creator: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      return res.json(updatedLineItem);
    } catch (error) {
      console.error('Upload receipt error:', error);
      // Clean up uploaded file on error
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ message: 'Failed to upload receipt' });
    }
  });
};

export const getLineItemReceipt = async (req: Request, res: Response) => {
  try {
    const { bookingId, lineItemId } = req.params;

    const lineItem = await prisma.bookingLineItem.findUnique({
      where: { 
        id: parseInt(lineItemId),
        bookingId: parseInt(bookingId)
      }
    });

    if (!lineItem || !lineItem.receiptPath) {
      return res.status(404).json({ message: 'Receipt not found' });
    }

    const filePath = path.join(process.cwd(), 'uploads', 'receipts', lineItem.receiptPath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Receipt file not found' });
    }

    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (['.jpg', '.jpeg'].includes(ext)) {
      contentType = 'image/jpeg';
    } else if (ext === '.png') {
      contentType = 'image/png';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Get receipt error:', error);
    return res.status(500).json({ message: 'Failed to retrieve receipt' });
  }
};

// Get booking total including line items
export const getBookingTotal = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        lineItems: true
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const baseRate = Number(booking.rate);
    const lineItemsTotal = booking.lineItems.reduce((sum, item) => {
      return sum + Number(item.amount);
    }, 0);

    return res.json({
      baseRate,
      lineItemsTotal,
      grandTotal: baseRate + lineItemsTotal,
      lineItemsCount: booking.lineItems.length
    });
  } catch (error) {
    console.error('Get booking total error:', error);
    return res.status(500).json({ message: 'Failed to calculate booking total' });
  }
};