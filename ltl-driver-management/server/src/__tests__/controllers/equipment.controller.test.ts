/**
 * Equipment Controller Tests
 */

import { Request, Response } from 'express';
import { prismaMock } from '../mocks/prisma.mock';
import { getTrucks } from '../../controllers/equipment.controller';
import { createMockTruck, createMockLocation } from '../utils/testHelpers';

// Mock the fleet mock service
jest.mock('../../services/fleet.mock.service', () => ({
  fleetMockService: {
    getTrucks: jest.fn()
  }
}));

describe('Equipment Controller', () => {
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

  describe('getTrucks', () => {
    it('should return paginated trucks', async () => {
      mockReq.query = { page: '1', limit: '10' };

      const mockTrucks = [
        {
          ...createMockTruck({ id: 1, unitNumber: 'TRK-001' }),
          currentLocation: createMockLocation(),
          assignedDriver: null,
          linehaulTrips: []
        },
        {
          ...createMockTruck({ id: 2, unitNumber: 'TRK-002' }),
          currentLocation: createMockLocation(),
          assignedDriver: null,
          linehaulTrips: []
        }
      ];

      prismaMock.equipmentTruck.findMany.mockResolvedValue(mockTrucks as any);
      prismaMock.equipmentTruck.count.mockResolvedValue(2);

      await getTrucks(mockReq as Request, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          trucks: expect.arrayContaining([
            expect.objectContaining({ unitNumber: 'TRK-001' })
          ]),
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
            total: 2
          })
        })
      );
    });

    it('should filter trucks by status', async () => {
      mockReq.query = { status: 'AVAILABLE', page: '1', limit: '10' };

      prismaMock.equipmentTruck.findMany.mockResolvedValue([
        {
          ...createMockTruck({ status: 'AVAILABLE' }),
          currentLocation: null,
          assignedDriver: null,
          linehaulTrips: []
        }
      ] as any);
      prismaMock.equipmentTruck.count.mockResolvedValue(1);

      await getTrucks(mockReq as Request, mockRes as Response);

      expect(prismaMock.equipmentTruck.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'AVAILABLE'
          })
        })
      );
    });

    it('should filter trucks by search term', async () => {
      mockReq.query = { search: 'TRK-001', page: '1', limit: '10' };

      prismaMock.equipmentTruck.findMany.mockResolvedValue([
        {
          ...createMockTruck({ unitNumber: 'TRK-001' }),
          currentLocation: null,
          assignedDriver: null,
          linehaulTrips: []
        }
      ] as any);
      prismaMock.equipmentTruck.count.mockResolvedValue(1);

      await getTrucks(mockReq as Request, mockRes as Response);

      expect(prismaMock.equipmentTruck.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ unitNumber: expect.any(Object) })
            ])
          })
        })
      );
    });

    it('should filter trucks by truck type', async () => {
      mockReq.query = { truckType: 'DAYCAB', page: '1', limit: '10' };

      prismaMock.equipmentTruck.findMany.mockResolvedValue([
        {
          ...createMockTruck({ type: 'DAYCAB' }),
          currentLocation: null,
          assignedDriver: null,
          linehaulTrips: []
        }
      ] as any);
      prismaMock.equipmentTruck.count.mockResolvedValue(1);

      await getTrucks(mockReq as Request, mockRes as Response);

      expect(prismaMock.equipmentTruck.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            truckType: 'DAYCAB'
          })
        })
      );
    });

    it('should filter trucks by terminal', async () => {
      mockReq.query = { terminalId: '5', page: '1', limit: '10' };

      prismaMock.equipmentTruck.findMany.mockResolvedValue([
        {
          ...createMockTruck({ currentLocationId: 5 }),
          currentLocation: createMockLocation({ id: 5 }),
          assignedDriver: null,
          linehaulTrips: []
        }
      ] as any);
      prismaMock.equipmentTruck.count.mockResolvedValue(1);

      await getTrucks(mockReq as Request, mockRes as Response);

      expect(prismaMock.equipmentTruck.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            currentLocationId: 5
          })
        })
      );
    });

    it('should include GPS data in response', async () => {
      mockReq.query = { page: '1', limit: '10' };

      const mockTrucks = [
        {
          ...createMockTruck({ id: 1, unitNumber: 'TRK-001' }),
          currentLocation: null,
          assignedDriver: null,
          linehaulTrips: [],
          currentLatitude: 34.0522,
          currentLongitude: -118.2437,
          lastLocationUpdate: new Date()
        }
      ];

      prismaMock.equipmentTruck.findMany.mockResolvedValue(mockTrucks as any);
      prismaMock.equipmentTruck.count.mockResolvedValue(1);

      await getTrucks(mockReq as Request, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          trucks: expect.arrayContaining([
            expect.objectContaining({
              currentLatitude: 34.0522,
              currentLongitude: -118.2437
            })
          ])
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockReq.query = { page: '1', limit: '10' };

      prismaMock.equipmentTruck.findMany.mockRejectedValue(new Error('Database error'));

      await getTrucks(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Failed to fetch trucks'
      });
    });
  });
});
