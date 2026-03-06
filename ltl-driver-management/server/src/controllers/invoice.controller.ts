import { Request, Response } from 'express';
import invoiceService from '../services/invoice.service';
import { InvoiceStatus } from '@prisma/client';
import { parseISO, format } from 'date-fns';
import { sendInvoicesToAP as emailInvoicesToAP } from '../services/notification.service';
import { PDFService } from '../services/pdf.service';
import ExcelJS from 'exceljs';
import { prisma } from '../index';

export class InvoiceController {
  // Generate invoice from completed booking
  async createInvoice(req: Request, res: Response) {
    try {
      const { bookingId } = req.body;
      
      if (!bookingId) {
        return res.status(400).json({ message: 'Booking ID is required' });
      }
      
      const invoice = await invoiceService.createInvoice(bookingId);
      
      // Copy booking documents to invoice attachments
      await invoiceService.copyBookingDocuments(invoice.id);
      
      // Get full invoice details
      const fullInvoice = await invoiceService.getInvoice(invoice.id);
      
      return res.json(fullInvoice);
    } catch (error: any) {
      console.error('Create invoice error:', error);
      return res.status(500).json({ message: error.message || 'Failed to create invoice' });
    }
  }

  // Get invoice details
  async getInvoice(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      const invoice = await invoiceService.getInvoice(id);
      
      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      
      return res.json(invoice);
    } catch (error: any) {
      console.error('Get invoice error:', error);
      return res.status(500).json({ message: error.message || 'Failed to get invoice' });
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
      return res.status(500).json({ message: error.message || 'Failed to list invoices' });
    }
  }

  // Update invoice status
  async updateInvoiceStatus(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const userId = (req as any).user?.email || 'System';
      
      if (!status || !Object.values(InvoiceStatus).includes(status)) {
        return res.status(400).json({ message: 'Valid status is required' });
      }
      
      const invoice = await invoiceService.updateInvoiceStatus(id, status, userId);
      
      return res.json(invoice);
    } catch (error: any) {
      console.error('Update invoice status error:', error);
      return res.status(500).json({ message: error.message || 'Failed to update invoice status' });
    }
  }

  // Send invoices to AP
  async sendInvoicesToAP(req: Request, res: Response) {
    try {
      const { invoiceIds, includeDocuments } = req.body;
      const userId = (req as any).user?.email || 'System';
      
      if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({ message: 'Invoice IDs are required' });
      }
      
      // Get full invoice details for email
      const invoices = await Promise.all(
        invoiceIds.map(id => invoiceService.getInvoice(id))
      );
      
      // Filter out null results
      const validInvoices = invoices.filter(invoice => invoice !== null);
      
      if (validInvoices.length === 0) {
        return res.status(404).json({ message: 'No valid invoices found' });
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
      return res.status(500).json({ message: error.message || 'Failed to send invoices to AP' });
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
      return res.status(500).json({ message: error.message || 'Failed to delete invoice' });
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
      return res.status(500).json({ message: error.message || 'Failed to get invoice summary' });
    }
  }

  // Download invoice as PDF
  async downloadInvoicePDF(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      const invoice = await invoiceService.getInvoice(id);

      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }

      // Generate PDF
      const pdfBuffer = await PDFService.generateInvoicePDF(invoice);

      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Invoice-${invoice.invoiceNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      return res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Download invoice PDF error:', error);
      return res.status(500).json({ message: error.message || 'Failed to generate invoice PDF' });
    }
  }

  // Export invoices to SAGE CSV format
  async exportToSageCSV(req: Request, res: Response) {
    try {
      const { invoiceIds } = req.body;

      if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({ message: 'Invoice IDs are required' });
      }

      // Get full invoice details with carrier info
      const invoices = await prisma.invoice.findMany({
        where: {
          id: { in: invoiceIds }
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

      if (invoices.length === 0) {
        return res.status(404).json({ message: 'No invoices found' });
      }

      // Default GL Account
      const DEFAULT_GL_ACCOUNT = '512-LNHL-TCOR-OPSP-000000';

      // Create CSV using ExcelJS
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('SAGE Import');

      sheet.columns = [
        { header: 'SAGE VENDOR NUMBER', key: 'sageVendorNumber', width: 20 },
        { header: 'LOAD NUMBER', key: 'loadNumber', width: 20 },
        { header: 'INVOICE COMMENT', key: 'invoiceComment', width: 40 },
        { header: 'INVOICE DATE', key: 'invoiceDate', width: 15 },
        { header: 'GL ACCOUNT', key: 'glAccount', width: 25 },
        { header: 'INVOICE AMOUNT', key: 'invoiceAmount', width: 15 }
      ];

      for (const invoice of invoices) {
        sheet.addRow({
          sageVendorNumber: invoice.booking?.carrier?.sageVendorNumber || '',
          loadNumber: invoice.booking?.id?.toString() || '',
          invoiceComment: invoice.notes || '',
          invoiceDate: format(invoice.createdAt, 'yyyy-MM-dd'),
          glAccount: DEFAULT_GL_ACCOUNT,
          invoiceAmount: Number(invoice.amount).toFixed(2)
        });
      }

      // Generate CSV
      const filename = `sage-export-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Write CSV to response
      await workbook.csv.write(res);
      return res.end();
    } catch (error: any) {
      console.error('Export to SAGE error:', error);
      return res.status(500).json({ message: error.message || 'Failed to export to SAGE' });
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
export const downloadInvoicePDF = invoiceController.downloadInvoicePDF.bind(invoiceController);
export const exportToSageCSV = invoiceController.exportToSageCSV.bind(invoiceController);

// Legacy exports for backward compatibility
export const getInvoices = listInvoices;
export const getInvoiceById = getInvoice;
export const generateInvoice = createInvoice;
export const markInvoiceAsPaid = updateInvoiceStatus;
export const downloadInvoice = getInvoice;

export default invoiceController;