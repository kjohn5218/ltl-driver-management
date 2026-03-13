/**
 * Invoice Controller Tests
 */

import { Request, Response } from 'express';
import { InvoiceController } from '../../controllers/invoice.controller';
import invoiceService from '../../services/invoice.service';
import { createMockInvoice, createMockBooking } from '../utils/testHelpers';

// Mock the invoice service
jest.mock('../../services/invoice.service');
jest.mock('../../services/notification.service');

const mockInvoiceService = invoiceService as jest.Mocked<typeof invoiceService>;

describe('Invoice Controller', () => {
  let controller: InvoiceController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    controller = new InvoiceController();

    responseJson = jest.fn();
    responseStatus = jest.fn().mockReturnThis();

    mockReq = {
      query: {},
      params: {},
      body: {},
      user: { email: 'test@example.com' }
    } as any;

    mockRes = {
      json: responseJson,
      status: responseStatus
    };
  });

  describe('createInvoice', () => {
    it('should create an invoice successfully', async () => {
      mockReq.body = { bookingId: 1 };

      const mockInvoice = createMockInvoice({
        id: 1,
        invoiceNumber: 'INV-001'
      });

      mockInvoiceService.createInvoice.mockResolvedValue(mockInvoice as any);
      (mockInvoiceService.copyBookingDocuments as jest.Mock).mockResolvedValue(undefined);
      mockInvoiceService.getInvoice.mockResolvedValue({
        ...mockInvoice,
        booking: createMockBooking()
      } as any);

      await controller.createInvoice(mockReq as Request, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNumber: 'INV-001'
        })
      );
    });

    it('should return 400 when bookingId is missing', async () => {
      mockReq.body = {};

      await controller.createInvoice(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Booking ID is required'
      });
    });

    it('should handle errors gracefully', async () => {
      mockReq.body = { bookingId: 1 };

      mockInvoiceService.createInvoice.mockRejectedValue(new Error('Create failed'));

      await controller.createInvoice(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Create failed'
      });
    });
  });

  describe('getInvoice', () => {
    it('should return invoice by ID', async () => {
      mockReq.params = { id: '1' };

      const mockInvoice = {
        ...createMockInvoice({ id: 1, invoiceNumber: 'INV-001' }),
        booking: createMockBooking()
      };

      mockInvoiceService.getInvoice.mockResolvedValue(mockInvoice as any);

      await controller.getInvoice(mockReq as Request, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNumber: 'INV-001'
        })
      );
    });

    it('should return 404 for non-existent invoice', async () => {
      mockReq.params = { id: '999' };

      mockInvoiceService.getInvoice.mockResolvedValue(null);

      await controller.getInvoice(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Invoice not found'
      });
    });
  });

  describe('listInvoices', () => {
    it('should return paginated invoices', async () => {
      mockReq.query = { limit: '10', offset: '0' };

      const mockInvoices = [
        createMockInvoice({ id: 1, invoiceNumber: 'INV-001' }),
        createMockInvoice({ id: 2, invoiceNumber: 'INV-002' })
      ];

      mockInvoiceService.listInvoices.mockResolvedValue({
        invoices: mockInvoices,
        total: 2
      } as any);

      await controller.listInvoices(mockReq as Request, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          invoices: expect.arrayContaining([
            expect.objectContaining({ invoiceNumber: 'INV-001' })
          ]),
          total: 2
        })
      );
    });

    it('should filter invoices by status', async () => {
      mockReq.query = { status: 'PENDING' };

      mockInvoiceService.listInvoices.mockResolvedValue({
        invoices: [],
        total: 0
      } as any);

      await controller.listInvoices(mockReq as Request, mockRes as Response);

      expect(mockInvoiceService.listInvoices).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PENDING'
        })
      );
    });

    it('should filter invoices by carrier', async () => {
      mockReq.query = { carrierId: '5' };

      mockInvoiceService.listInvoices.mockResolvedValue({
        invoices: [],
        total: 0
      } as any);

      await controller.listInvoices(mockReq as Request, mockRes as Response);

      expect(mockInvoiceService.listInvoices).toHaveBeenCalledWith(
        expect.objectContaining({
          carrierId: 5
        })
      );
    });
  });

  describe('updateInvoiceStatus', () => {
    it('should update invoice status', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { status: 'PAID' };

      const updatedInvoice = createMockInvoice({
        id: 1,
        status: 'PAID'
      });

      mockInvoiceService.updateInvoiceStatus.mockResolvedValue(updatedInvoice as any);

      await controller.updateInvoiceStatus(mockReq as Request, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PAID'
        })
      );
    });

    it('should return 400 for invalid status', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { status: 'INVALID_STATUS' };

      await controller.updateInvoiceStatus(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Valid status is required'
      });
    });

    it('should return 400 when status is missing', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = {};

      await controller.updateInvoiceStatus(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Valid status is required'
      });
    });
  });

  describe('sendInvoicesToAP', () => {
    it('should return 400 when invoiceIds is missing', async () => {
      mockReq.body = {};

      await controller.sendInvoicesToAP(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Invoice IDs are required'
      });
    });

    it('should return 400 when invoiceIds is empty', async () => {
      mockReq.body = { invoiceIds: [] };

      await controller.sendInvoicesToAP(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Invoice IDs are required'
      });
    });

    it('should return 404 when no valid invoices found', async () => {
      mockReq.body = { invoiceIds: [1, 2, 3] };

      mockInvoiceService.getInvoice.mockResolvedValue(null);

      await controller.sendInvoicesToAP(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'No valid invoices found'
      });
    });
  });
});
