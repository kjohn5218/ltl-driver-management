/**
 * Booking Controller Tests
 */

import { Request, Response } from 'express';
import { prismaMock } from '../mocks/prisma.mock';
import { getBookings, getBookingById } from '../../controllers/booking.controller';
import { createMockBooking, createMockCarrier } from '../utils/testHelpers';

describe('Booking Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn();
    responseStatus = jest.fn().mockReturnThis();

    mockReq = {
      query: {},
      params: {},
      body: {}
    };

    mockRes = {
      json: responseJson,
      status: responseStatus
    };
  });

  describe('getBookings', () => {
    it('should return paginated bookings', async () => {
      mockReq.query = { page: '1', limit: '10' };

      const mockBookings = [
        createMockBooking({ id: 1, bookingNumber: 'BK-001' }),
        createMockBooking({ id: 2, bookingNumber: 'BK-002' })
      ];

      prismaMock.booking.count.mockResolvedValue(2);
      prismaMock.booking.findMany.mockResolvedValue(mockBookings as any);
      prismaMock.loadsheet.findMany.mockResolvedValue([]);

      await getBookings(mockReq as Request, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          bookings: expect.arrayContaining([
            expect.objectContaining({ bookingNumber: 'BK-001' })
          ]),
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
            total: 2
          })
        })
      );
    });

    it('should filter bookings by status', async () => {
      mockReq.query = { status: 'COMPLETED', page: '1', limit: '10' };

      prismaMock.booking.count.mockResolvedValue(1);
      prismaMock.booking.findMany.mockResolvedValue([
        createMockBooking({ status: 'COMPLETED' })
      ] as any);
      prismaMock.loadsheet.findMany.mockResolvedValue([]);

      await getBookings(mockReq as Request, mockRes as Response);

      expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED'
          })
        })
      );
    });

    it('should filter bookings by carrier', async () => {
      mockReq.query = { carrierId: '5', page: '1', limit: '10' };

      prismaMock.booking.count.mockResolvedValue(1);
      prismaMock.booking.findMany.mockResolvedValue([
        createMockBooking({ carrierId: 5 })
      ] as any);
      prismaMock.loadsheet.findMany.mockResolvedValue([]);

      await getBookings(mockReq as Request, mockRes as Response);

      expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            carrierId: 5
          })
        })
      );
    });

    it('should filter bookings by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      mockReq.query = { startDate, endDate, page: '1', limit: '10' };

      prismaMock.booking.count.mockResolvedValue(1);
      prismaMock.booking.findMany.mockResolvedValue([
        createMockBooking()
      ] as any);
      prismaMock.loadsheet.findMany.mockResolvedValue([]);

      await getBookings(mockReq as Request, mockRes as Response);

      expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            bookingDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date)
            })
          })
        })
      );
    });

    it('should include linked loadsheet status', async () => {
      mockReq.query = { page: '1', limit: '10' };

      const mockBookings = [
        createMockBooking({ id: 1, bookingNumber: 'BK-001' })
      ];

      prismaMock.booking.count.mockResolvedValue(1);
      prismaMock.booking.findMany.mockResolvedValue(mockBookings as any);
      prismaMock.loadsheet.findMany.mockResolvedValue([
        {
          contractPowerBookingId: 1,
          contractPowerStatus: 'CANCEL_REQUESTED',
          manifestNumber: 'MAN-001'
        }
      ] as any);

      await getBookings(mockReq as Request, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          bookings: expect.arrayContaining([
            expect.objectContaining({
              linkedLoadsheet: expect.objectContaining({
                hasCancelRequest: true,
                manifestNumber: 'MAN-001'
              })
            })
          ])
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockReq.query = { page: '1', limit: '10' };

      prismaMock.booking.count.mockRejectedValue(new Error('Database error'));

      await getBookings(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Failed to fetch bookings'
      });
    });
  });

  describe('getBookingById', () => {
    it('should return booking by ID', async () => {
      mockReq.params = { id: '1' };

      const mockBooking = {
        ...createMockBooking({ id: 1, bookingNumber: 'BK-001' }),
        carrier: createMockCarrier(),
        route: null,
        invoice: null,
        lineItems: [],
        childBookings: [],
        parentBooking: null,
        documents: []
      };

      prismaMock.booking.findUnique.mockResolvedValue(mockBooking as any);
      prismaMock.loadsheet.findFirst.mockResolvedValue(null);

      await getBookingById(mockReq as Request, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingNumber: 'BK-001'
        })
      );
    });

    it('should return 404 for non-existent booking', async () => {
      mockReq.params = { id: '999' };

      prismaMock.booking.findUnique.mockResolvedValue(null);

      await getBookingById(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Booking not found'
      });
    });
  });
});
