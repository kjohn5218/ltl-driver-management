/**
 * Carrier Controller Tests
 */

import { Request, Response } from 'express';
import { prismaMock } from '../mocks/prisma.mock';
import { getCarriers, searchCarriers, getCarrierById } from '../../controllers/carrier.controller';
import { createMockCarrier } from '../utils/testHelpers';

describe('Carrier Controller', () => {
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

  describe('getCarriers', () => {
    it('should return paginated carriers', async () => {
      mockReq.query = { page: '1', limit: '10' };

      const mockCarriers = [
        createMockCarrier({ id: 1, carrierName: 'Carrier A' }),
        createMockCarrier({ id: 2, carrierName: 'Carrier B' })
      ];

      prismaMock.carrier.count.mockResolvedValue(2);
      prismaMock.carrier.findMany.mockResolvedValue(mockCarriers as any);

      await getCarriers(mockReq as Request, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          carriers: expect.arrayContaining([
            expect.objectContaining({ carrierName: 'Carrier A' })
          ]),
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
            total: 2
          })
        })
      );
    });

    it('should filter carriers by status', async () => {
      mockReq.query = { status: 'APPROVED', page: '1', limit: '10' };

      prismaMock.carrier.count.mockResolvedValue(1);
      prismaMock.carrier.findMany.mockResolvedValue([
        createMockCarrier({ status: 'APPROVED' as any })
      ] as any);

      await getCarriers(mockReq as Request, mockRes as Response);

      expect(prismaMock.carrier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'APPROVED'
          })
        })
      );
    });

    it('should search carriers by name', async () => {
      mockReq.query = { search: 'TestCarrier', page: '1', limit: '10' };

      prismaMock.carrier.count.mockResolvedValue(1);
      prismaMock.carrier.findMany.mockResolvedValue([
        createMockCarrier({ carrierName: 'TestCarrier Inc' })
      ] as any);

      await getCarriers(mockReq as Request, mockRes as Response);

      expect(prismaMock.carrier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.any(Object) })
            ])
          })
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockReq.query = { page: '1', limit: '10' };

      prismaMock.carrier.count.mockRejectedValue(new Error('Database error'));

      await getCarriers(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Failed to fetch carriers'
      });
    });
  });

  describe('searchCarriers', () => {
    it('should search carriers by query', async () => {
      mockReq.query = { q: 'test' };

      const mockCarriers = [
        createMockCarrier({ carrierName: 'Test Carrier' })
      ];

      prismaMock.carrier.findMany.mockResolvedValue(mockCarriers as any);

      await searchCarriers(mockReq as Request, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith(mockCarriers);
    });

    it('should return empty array when no matches', async () => {
      mockReq.query = { q: 'nonexistent' };

      prismaMock.carrier.findMany.mockResolvedValue([]);

      await searchCarriers(mockReq as Request, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith([]);
    });

    it('should handle search errors', async () => {
      mockReq.query = { q: 'test' };

      prismaMock.carrier.findMany.mockRejectedValue(new Error('Search error'));

      await searchCarriers(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Search failed'
      });
    });
  });

  describe('getCarrierById', () => {
    it('should return carrier by ID', async () => {
      mockReq.params = { id: '1' };

      const mockCarrier = createMockCarrier({
        id: 1,
        carrierName: 'Test Carrier'
      });

      prismaMock.carrier.findUnique.mockResolvedValue({
        ...mockCarrier,
        drivers: [],
        bookings: [],
        preferredRoutes: [],
        documents: []
      } as any);

      await getCarrierById(mockReq as Request, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          carrierName: 'Test Carrier'
        })
      );
    });

    it('should return 404 for non-existent carrier', async () => {
      mockReq.params = { id: '999' };

      prismaMock.carrier.findUnique.mockResolvedValue(null);

      await getCarrierById(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Carrier not found'
      });
    });

    it('should return 400 for invalid carrier ID', async () => {
      mockReq.params = { id: 'invalid' };

      await getCarrierById(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Invalid carrier ID'
      });
    });

    it('should return 400 when ID is missing', async () => {
      mockReq.params = {};

      await getCarrierById(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Carrier ID is required'
      });
    });
  });
});
