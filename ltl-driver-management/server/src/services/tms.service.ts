/**
 * TMS Service
 *
 * Unified service for fetching shipment data from TMS.
 * Uses the TMS API when configured, otherwise falls back to mock data.
 */

import { isTMSConfigured } from '../config/tms.config';
import { tmsApiService, TMSShipment } from './tms.api.service';
import { tmsMockService, TMSTripData } from './tms.mock.service';
import {
  expectedShipmentsMockService,
  ExpectedLaneVolume,
  ExpectedShipmentDetail,
} from './expectedShipments.mock.service';
import { log } from '../utils/logger';

/**
 * TMS Service - primary interface for TMS data operations
 */
export const tmsService = {
  /**
   * Check if TMS API is available
   */
  isConfigured(): boolean {
    return isTMSConfigured();
  },

  /**
   * Get trip data with shipments
   */
  async getTripData(tripId: number, tripNumber: string): Promise<TMSTripData> {
    if (isTMSConfigured()) {
      try {
        // Extract manifest number from trip number (e.g., "5760U-DEN-GJT" -> "5760U")
        const manifestNumber = tripNumber.split('-')[0] || tripNumber.slice(0, 5);

        const response = await tmsApiService.getManifest(manifestNumber);

        if (response.success && response.data) {
          const manifest = response.data;

          // Transform API response to TMSTripData format
          return {
            tripNumber,
            manifestNumber: manifest.manifestNumber,
            originCode: manifest.originCode,
            destCode: manifest.destCode,
            driverName: manifest.driverName,
            trailerNumber: manifest.trailerNumber,
            effort: manifest.effort || '',
            lastLoad: manifest.lastLoad,
            dispatchedAt: manifest.dispatchedAt ? new Date(manifest.dispatchedAt) : undefined,
            arrivedAt: manifest.arrivedAt ? new Date(manifest.arrivedAt) : undefined,
            shipments: manifest.shipments,
          };
        } else {
          log.warn('TMS', `Failed to fetch manifest ${manifestNumber}, falling back to mock`);
        }
      } catch (error) {
        log.error('TMS', 'Error fetching trip data from TMS API', error);
      }
    }

    // Fallback to mock service
    return tmsMockService.getTripData(tripId, tripNumber);
  },

  /**
   * Get shipments for a manifest
   */
  async getManifestShipments(manifestNumber: string): Promise<TMSShipment[]> {
    if (isTMSConfigured()) {
      try {
        const response = await tmsApiService.getManifestShipments(manifestNumber);

        if (response.success && response.data) {
          return response.data;
        } else {
          log.warn('TMS', `Failed to fetch shipments for ${manifestNumber}, falling back to mock`);
        }
      } catch (error) {
        log.error('TMS', 'Error fetching shipments from TMS API', error);
      }
    }

    // Fallback to mock
    const mockData = await tmsMockService.getTripShipments(0);
    return mockData;
  },

  /**
   * Get hazmat shipments for a trip
   */
  async getHazmatShipments(tripId: number, manifestNumber?: string): Promise<TMSShipment[]> {
    if (isTMSConfigured() && manifestNumber) {
      try {
        const response = await tmsApiService.getManifestShipments(manifestNumber);

        if (response.success && response.data) {
          return response.data.filter(s => s.hazmat !== undefined);
        }
      } catch (error) {
        log.error('TMS', 'Error fetching hazmat shipments from TMS API', error);
      }
    }

    // Fallback to mock
    return tmsMockService.getHazmatShipments(tripId);
  },

  /**
   * Get expected lane volumes for planning
   */
  async getLaneVolumes(
    startDate: Date,
    endDate: Date,
    originTerminalCode?: string,
    destinationTerminalCode?: string
  ): Promise<ExpectedLaneVolume[]> {
    if (isTMSConfigured()) {
      try {
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        const response = await tmsApiService.getLaneVolumes(startStr, endStr, originTerminalCode);

        if (response.success && response.data) {
          // Transform API response to ExpectedLaneVolume format
          return response.data
            .filter(
              v => !destinationTerminalCode || v.destinationTerminalCode === destinationTerminalCode
            )
            .map(v => ({
              originTerminalCode: v.originTerminalCode,
              destinationTerminalCode: v.destinationTerminalCode,
              laneName: `${v.originTerminalCode}-${v.destinationTerminalCode}`,
              forecastDate: new Date(v.forecastDate),
              expectedShipmentCount: v.expectedShipmentCount,
              expectedPieces: v.expectedPieces,
              expectedWeight: v.expectedWeight,
              expectedCube: undefined,
              guaranteedCount: v.guaranteedCount,
              standardCount: v.standardCount,
              expeditedCount: v.expeditedCount,
              hazmatCount: v.hazmatCount,
              highValueCount: 0,
              oversizeCount: 0,
              estimatedTrailers: v.estimatedTrailers,
              trailerUtilization: 75, // Default value if not provided
              confidenceLevel: 'MEDIUM' as const,
            }));
        }
      } catch (error) {
        log.error('TMS', 'Error fetching lane volumes from TMS API', error);
      }
    }

    // Fallback to mock
    return expectedShipmentsMockService.getLaneVolumes(
      startDate,
      endDate,
      originTerminalCode,
      destinationTerminalCode
    );
  },

  /**
   * Get aggregated lane volumes
   */
  async getLaneVolumesAggregated(
    startDate: Date,
    endDate: Date,
    originTerminalCode?: string
  ): Promise<ExpectedLaneVolume[]> {
    if (isTMSConfigured()) {
      // For aggregated, we fetch daily and aggregate locally
      const dailyVolumes = await this.getLaneVolumes(startDate, endDate, originTerminalCode);

      // Group by lane and aggregate
      const aggregated = new Map<string, ExpectedLaneVolume>();

      for (const v of dailyVolumes) {
        const key = `${v.originTerminalCode}-${v.destinationTerminalCode}`;
        const existing = aggregated.get(key);

        if (existing) {
          existing.expectedShipmentCount += v.expectedShipmentCount;
          existing.expectedPieces += v.expectedPieces;
          existing.expectedWeight += v.expectedWeight;
          existing.guaranteedCount += v.guaranteedCount;
          existing.standardCount += v.standardCount;
          existing.expeditedCount += v.expeditedCount;
          existing.hazmatCount += v.hazmatCount;
          existing.highValueCount += v.highValueCount;
          existing.oversizeCount += v.oversizeCount;
          existing.estimatedTrailers += v.estimatedTrailers;
        } else {
          aggregated.set(key, { ...v });
        }
      }

      return Array.from(aggregated.values());
    }

    // Fallback to mock
    return expectedShipmentsMockService.getLaneVolumesAggregated(
      startDate,
      endDate,
      originTerminalCode
    );
  },

  /**
   * Get detailed expected shipments for a lane
   */
  async getLaneShipmentDetails(
    originTerminalCode: string,
    destinationTerminalCode: string,
    forecastDate: Date
  ): Promise<ExpectedShipmentDetail[]> {
    if (isTMSConfigured()) {
      try {
        const dateStr = forecastDate.toISOString().split('T')[0];
        const response = await tmsApiService.getLaneShipmentDetails(
          originTerminalCode,
          destinationTerminalCode,
          dateStr
        );

        if (response.success && response.data) {
          // Transform TMS shipments to ExpectedShipmentDetail format
          return response.data.map(s => ({
            externalProNumber: s.proNumber,
            originTerminalCode,
            destinationTerminalCode,
            forecastDate,
            pieces: s.pieces,
            weight: s.weight,
            cube: undefined,
            serviceLevel: 'STANDARD' as const,
            isHazmat: !!s.hazmat,
            hazmatClass: s.hazmat?.hazardClass,
            isHighValue: false,
            isOversize: false,
            shipperName: s.shipper.name,
            shipperCity: s.shipper.city,
            consigneeName: s.consignee.name,
            consigneeCity: s.consignee.city,
            estimatedPickupTime: undefined,
            estimatedDeliveryTime: s.expDeliveryDate
              ? new Date(s.expDeliveryDate)
              : undefined,
            appointmentRequired: false,
            externalStatus: 'BOOKED',
          }));
        }
      } catch (error) {
        log.error('TMS', 'Error fetching shipment details from TMS API', error);
      }
    }

    // Fallback to mock
    return expectedShipmentsMockService.getLaneShipmentDetails(
      originTerminalCode,
      destinationTerminalCode,
      forecastDate
    );
  },

  /**
   * Get daily summary for expected shipments
   */
  async getDailySummary(forecastDate: Date): Promise<{
    totalShipments: number;
    totalPieces: number;
    totalWeight: number;
    totalTrailers: number;
    hazmatShipments: number;
    guaranteedShipments: number;
    laneCount: number;
  }> {
    const volumes = await this.getLaneVolumes(forecastDate, forecastDate);

    return {
      totalShipments: volumes.reduce((sum, v) => sum + v.expectedShipmentCount, 0),
      totalPieces: volumes.reduce((sum, v) => sum + v.expectedPieces, 0),
      totalWeight: volumes.reduce((sum, v) => sum + v.expectedWeight, 0),
      totalTrailers: parseFloat(
        volumes.reduce((sum, v) => sum + v.estimatedTrailers, 0).toFixed(1)
      ),
      hazmatShipments: volumes.reduce((sum, v) => sum + v.hazmatCount, 0),
      guaranteedShipments: volumes.reduce((sum, v) => sum + v.guaranteedCount, 0),
      laneCount: volumes.length,
    };
  },

  /**
   * Check TMS API health
   */
  async healthCheck(): Promise<{
    configured: boolean;
    connected: boolean;
    version?: string;
    error?: string;
  }> {
    if (!isTMSConfigured()) {
      return {
        configured: false,
        connected: false,
        error: 'TMS API not configured - using mock data',
      };
    }

    try {
      const response = await tmsApiService.healthCheck();

      if (response.success && response.data) {
        return {
          configured: true,
          connected: true,
          version: response.data.version,
        };
      } else {
        return {
          configured: true,
          connected: false,
          error: response.error || 'Health check failed',
        };
      }
    } catch (error) {
      return {
        configured: true,
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};
