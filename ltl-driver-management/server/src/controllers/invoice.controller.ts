import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, InvoiceStatus } from '@prisma/client';

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    
    // Build filter
    const where: Prisma.InvoiceWhereInput = {};
    if (status) where.status = status as InvoiceStatus;
    
    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    // Get total count
    const total = await prisma.invoice.count({ where });

    // Get invoices with pagination
    const invoices = await prisma.invoice.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          include: {
            carrier: true,
            route: true
          }
        }
      }
    });

    return res.json({
      invoices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    return res.status(500).json({ message: 'Failed to fetch invoices' });
  }
};

export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const invoice = await prisma.invoice.findUnique({
      where: { id: parseInt(id) },
      include: {
        booking: {
          include: {
            carrier: true,
            route: true
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    return res.json(invoice);
  } catch (error) {
    console.error('Get invoice by id error:', error);
    return res.status(500).json({ message: 'Failed to fetch invoice' });
  }
};

export const generateInvoice = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.body;

    // Check if booking exists and is completed
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        carrier: true,
        route: true,
        invoice: true
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'Booking must be completed to generate invoice' });
    }

    if (booking.invoice) {
      return res.status(409).json({ message: 'Invoice already exists for this booking' });
    }

    // Generate invoice number
    const lastInvoice = await prisma.invoice.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    const invoiceNumber = lastInvoice 
      ? `INV-${(parseInt(lastInvoice.invoiceNumber.split('-')[1]) + 1).toString().padStart(6, '0')}`
      : 'INV-000001';

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        bookingId: parseInt(bookingId),
        invoiceNumber,
        amount: booking.rate,
        status: 'PENDING'
      },
      include: {
        booking: {
          include: {
            carrier: true,
            route: true
          }
        }
      }
    });

    return res.status(201).json(invoice);
  } catch (error) {
    console.error('Generate invoice error:', error);
    return res.status(500).json({ message: 'Failed to generate invoice' });
  }
};

export const markInvoiceAsPaid = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paidAt } = req.body;

    const invoice = await prisma.invoice.update({
      where: { id: parseInt(id) },
      data: {
        status: 'PAID',
        paidAt: paidAt ? new Date(paidAt) : new Date()
      },
      include: {
        booking: {
          include: {
            carrier: true,
            route: true
          }
        }
      }
    });

    return res.json(invoice);
  } catch (error) {
    console.error('Mark invoice as paid error:', error);
    return res.status(500).json({ message: 'Failed to update invoice' });
  }
};

export const downloadInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const invoice = await prisma.invoice.findUnique({
      where: { id: parseInt(id) },
      include: {
        booking: {
          include: {
            carrier: true,
            route: true
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // TODO: Implement PDF generation
    // For now, return invoice data
    return res.json({
      message: 'PDF generation not implemented yet',
      invoice
    });
  } catch (error) {
    console.error('Download invoice error:', error);
    return res.status(500).json({ message: 'Failed to download invoice' });
  }
};