import { Request, Response } from 'express';
import invoiceService from '../services/invoice.service';
import { InvoiceStatus } from '@prisma/client';
import { parseISO } from 'date-fns';
import { sendInvoicesToAP as emailInvoicesToAP } from '../services/notification.service';

export class InvoiceController {
  // Generate invoice from completed booking
  async createInvoice(req: Request, res: Response) {
    try {
      const { bookingId } = req.body;
      
      if (!bookingId) {
        return res.status(400).json({ error: 'Booking ID is required' });
      }
      
      const invoice = await invoiceService.createInvoice(bookingId);
      
      // Copy booking documents to invoice attachments
      await invoiceService.copyBookingDocuments(invoice.id);
      
      // Get full invoice details
      const fullInvoice = await invoiceService.getInvoice(invoice.id);
      
      return res.json(fullInvoice);
    } catch (error: any) {
      console.error('Create invoice error:', error);
      return res.status(500).json({ error: error.message || 'Failed to create invoice' });
    }
  }

  // Get invoice details
  async getInvoice(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      const invoice = await invoiceService.getInvoice(id);
      
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      
      return res.json(invoice);
    } catch (error: any) {
      console.error('Get invoice error:', error);
      return res.status(500).json({ error: error.message || 'Failed to get invoice' });
    }
  }

  // List invoices with filters
  async listInvoices(req: Request, res: Response) {
    try {
      const filters: any = {};
      
      if (req.query.status) {
        filters.status = req.query.status as InvoiceStatus;
      }
      
      if (req.query.fromDate) {
        filters.fromDate = parseISO(req.query.fromDate as string);
      }
      
      if (req.query.toDate) {
        filters.toDate = parseISO(req.query.toDate as string);
      }
      
      if (req.query.carrierId) {
        filters.carrierId = parseInt(req.query.carrierId as string);
      }
      
      if (req.query.limit) {
        filters.limit = parseInt(req.query.limit as string);
      }
      
      if (req.query.offset) {
        filters.offset = parseInt(req.query.offset as string);
      }
      
      const result = await invoiceService.listInvoices(filters);
      
      return res.json(result);
    } catch (error: any) {
      console.error('List invoices error:', error);
      return res.status(500).json({ error: error.message || 'Failed to list invoices' });
    }
  }

  // Update invoice status
  async updateInvoiceStatus(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const userId = (req as any).user?.email || 'System';
      
      if (!status || !Object.values(InvoiceStatus).includes(status)) {
        return res.status(400).json({ error: 'Valid status is required' });
      }
      
      const invoice = await invoiceService.updateInvoiceStatus(id, status, userId);
      
      return res.json(invoice);
    } catch (error: any) {
      console.error('Update invoice status error:', error);
      return res.status(500).json({ error: error.message || 'Failed to update invoice status' });
    }
  }

  // Send invoices to AP
  async sendInvoicesToAP(req: Request, res: Response) {
    try {
      const { invoiceIds, includeDocuments } = req.body;
      const userId = (req as any).user?.email || 'System';
      
      if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({ error: 'Invoice IDs are required' });
      }
      
      // Get full invoice details for email
      const invoices = await Promise.all(
        invoiceIds.map(id => invoiceService.getInvoice(id))
      );
      
      // Filter out null results
      const validInvoices = invoices.filter(invoice => invoice !== null);
      
      if (validInvoices.length === 0) {
        return res.status(404).json({ error: 'No valid invoices found' });
      }
      
      // Send email to AP
      await emailInvoicesToAP(validInvoices, includeDocuments);
      
      // Update status to SENT_TO_AP
      await invoiceService.updateInvoicesStatus(invoiceIds, InvoiceStatus.SENT_TO_AP, userId);
      
      console.log(`Successfully sent ${validInvoices.length} invoices to AP (includeDocuments: ${includeDocuments})`);
      
      return res.json({ 
        success: true, 
        message: `${validInvoices.length} invoice(s) sent to AP and marked as sent`
      });
    } catch (error: any) {
      console.error('Send invoices to AP error:', error);
      return res.status(500).json({ error: error.message || 'Failed to send invoices to AP' });
    }
  }

  // Delete invoice
  async deleteInvoice(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      await invoiceService.deleteInvoice(id);
      
      return res.json({ success: true, message: 'Invoice deleted successfully' });
    } catch (error: any) {
      console.error('Delete invoice error:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete invoice' });
    }
  }

  // Get invoice summary/report
  async getInvoiceSummary(req: Request, res: Response) {
    try {
      const filters: any = {};
      
      if (req.query.fromDate) {
        filters.fromDate = parseISO(req.query.fromDate as string);
      }
      
      if (req.query.toDate) {
        filters.toDate = parseISO(req.query.toDate as string);
      }
      
      if (req.query.carrierId) {
        filters.carrierId = parseInt(req.query.carrierId as string);
      }
      
      // Get all invoices for summary
      const { invoices } = await invoiceService.listInvoices({ ...filters, limit: 1000 });
      
      // Calculate summary statistics
      const summary = {
        totalInvoices: invoices.length,
        totalAmount: invoices.reduce((sum, inv) => sum + Number(inv.amount), 0),
        statusBreakdown: {
          pending: invoices.filter(inv => inv.status === InvoiceStatus.PENDING).length,
          sentToAP: invoices.filter(inv => inv.status === InvoiceStatus.SENT_TO_AP).length,
          paid: invoices.filter(inv => inv.status === InvoiceStatus.PAID).length,
          overdue: invoices.filter(inv => inv.status === InvoiceStatus.OVERDUE).length,
          cancelled: invoices.filter(inv => inv.status === InvoiceStatus.CANCELLED).length
        },
        carrierBreakdown: invoices.reduce((acc: any, inv) => {
          const carrierName = inv.booking.carrier?.name || 'Unknown';
          if (!acc[carrierName]) {
            acc[carrierName] = {
              count: 0,
              totalAmount: 0
            };
          }
          acc[carrierName].count++;
          acc[carrierName].totalAmount += Number(inv.amount);
          return acc;
        }, {}),
        invoices // Include full invoice list for export
      };
      
      return res.json(summary);
    } catch (error: any) {
      console.error('Get invoice summary error:', error);
      return res.status(500).json({ error: error.message || 'Failed to get invoice summary' });
    }
  }
}

const invoiceController = new InvoiceController();

// Export individual methods for compatibility
export const createInvoice = invoiceController.createInvoice.bind(invoiceController);
export const getInvoice = invoiceController.getInvoice.bind(invoiceController);
export const listInvoices = invoiceController.listInvoices.bind(invoiceController);
export const updateInvoiceStatus = invoiceController.updateInvoiceStatus.bind(invoiceController);
export const sendInvoicesToAP = invoiceController.sendInvoicesToAP.bind(invoiceController);
export const deleteInvoice = invoiceController.deleteInvoice.bind(invoiceController);
export const getInvoiceSummary = invoiceController.getInvoiceSummary.bind(invoiceController);

// Legacy exports for backward compatibility
export const getInvoices = listInvoices;
export const getInvoiceById = getInvoice;
export const generateInvoice = createInvoice;
export const markInvoiceAsPaid = updateInvoiceStatus;
export const downloadInvoice = getInvoice;

export default invoiceController;