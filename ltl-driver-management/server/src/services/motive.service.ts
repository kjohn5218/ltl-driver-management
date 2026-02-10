import axios, { AxiosInstance, AxiosError } from 'axios';
import { getMotiveConfig, MotiveConfig } from '../config/motive.config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Motive API Response Types
interface MotiveDriver {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string | null;
  driver_company_id: string;
  status: string;
  role: string;
}

interface MotiveLocation {
  lat: number;
  lon: number;
  located_at: string;
  bearing: number;
  engine_hours: number;
  id: string;
  type: string;
  description: string;
  speed: number | null;
  odometer: number;
  battery_voltage: number | null;
  fuel: number;
  fuel_primary_remaining_percentage: number | null;
  fuel_secondary_remaining_percentage: number | null;
}

interface MotiveVehicleLocation {
  vehicle: {
    id: number;
    number: string;
    year: string;
    make: string;
    model: string;
    vin: string;
    current_location: MotiveLocation | null;
    current_driver: MotiveDriver | null;
  };
}

interface MotiveAsset {
  asset: {
    id: number;
    name: string;
    status: string;
    type: string;
    vin: string;
    license_plate_state: string | null;
    license_plate_number: string;
    make: string;
    model: string;
    year: string;
  };
}

interface MotiveVehicleLocationsResponse {
  vehicles: MotiveVehicleLocation[];
  pagination?: {
    per_page: number;
    page_no: number;
    total: number;
  };
}

interface MotiveAssetsResponse {
  assets: MotiveAsset[];
  pagination?: {
    per_page: number;
    page_no: number;
    total: number;
  };
}

export interface LocationSyncResult {
  trucksUpdated: number;
  trucksNotFound: number;
  errors: string[];
  total: number;
}

export interface VehicleLocationData {
  unitNumber: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  bearing: number;
  locatedAt: Date;
  description: string;
  odometer: number;
  fuelPercentage: number | null;
  currentDriverName: string | null;
  currentDriverId: string | null;
}

class MotiveError extends Error {
  constructor(public statusCode: number, message: string, public details?: any) {
    super(message);
    this.name = 'MotiveError';
  }
}

export class MotiveService {
  private apiClient: AxiosInstance;
  private config: MotiveConfig;
  private lastSyncAt: Date | null = null;
  private lastSyncResult: LocationSyncResult | null = null;

  constructor() {
    this.config = getMotiveConfig();
    this.apiClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Api-Key': this.config.apiKey
      }
    });

    this.apiClient.interceptors.response.use(
      response => response,
      this.handleAxiosError.bind(this)
    );
  }

  private async handleAxiosError(error: AxiosError) {
    if (error.response) {
      const { status, data } = error.response;
      let message = 'Motive API request failed';

      if (status === 401) {
        message = 'Motive API authentication failed. Check your API key.';
      } else if (data && typeof data === 'object' && 'error' in data) {
        message = (data as any).error;
      }

      throw new MotiveError(status, message, data);
    } else if (error.request) {
      throw new MotiveError(0, 'No response from Motive API', error.request);
    } else {
      throw new MotiveError(0, error.message);
    }
  }

  // Fetch all vehicle locations with pagination
  async fetchVehicleLocations(): Promise<VehicleLocationData[]> {
    const allLocations: VehicleLocationData[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await this.apiClient.get<MotiveVehicleLocationsResponse>(
        `/vehicle_locations?per_page=${perPage}&page_no=${page}`
      );

      const vehicles = response.data.vehicles || [];

      for (const item of vehicles) {
        const vehicle = item.vehicle;
        if (vehicle.current_location) {
          allLocations.push({
            unitNumber: vehicle.number,
            latitude: vehicle.current_location.lat,
            longitude: vehicle.current_location.lon,
            speed: vehicle.current_location.speed,
            bearing: vehicle.current_location.bearing,
            locatedAt: new Date(vehicle.current_location.located_at),
            description: vehicle.current_location.description,
            odometer: vehicle.current_location.odometer,
            fuelPercentage: vehicle.current_location.fuel_primary_remaining_percentage,
            currentDriverName: vehicle.current_driver
              ? `${vehicle.current_driver.first_name} ${vehicle.current_driver.last_name}`
              : null,
            currentDriverId: vehicle.current_driver?.driver_company_id || null
          });
        }
      }

      // Check pagination
      const pagination = response.data.pagination;
      if (pagination && vehicles.length === perPage) {
        page++;
      } else {
        hasMore = false;
      }
    }

    return allLocations;
  }

  // Fetch all assets (trailers)
  async fetchAssets(): Promise<MotiveAsset[]> {
    const allAssets: MotiveAsset[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await this.apiClient.get<MotiveAssetsResponse>(
        `/assets?per_page=${perPage}&page_no=${page}`
      );

      const assets = response.data.assets || [];
      allAssets.push(...assets);

      if (assets.length === perPage) {
        page++;
      } else {
        hasMore = false;
      }
    }

    return allAssets;
  }

  // Sync vehicle locations to local trucks
  async syncVehicleLocations(): Promise<LocationSyncResult> {
    const result: LocationSyncResult = {
      trucksUpdated: 0,
      trucksNotFound: 0,
      errors: [],
      total: 0
    };

    try {
      console.log('[Motive] Fetching vehicle locations...');
      const locations = await this.fetchVehicleLocations();
      result.total = locations.length;
      console.log(`[Motive] Fetched ${locations.length} vehicle locations`);

      for (const location of locations) {
        try {
          // Find truck by unit number
          const truck = await prisma.equipmentTruck.findFirst({
            where: { unitNumber: location.unitNumber }
          });

          if (truck) {
            await prisma.equipmentTruck.update({
              where: { id: truck.id },
              data: {
                currentLatitude: location.latitude,
                currentLongitude: location.longitude,
                lastLocationUpdate: location.locatedAt,
                updatedAt: new Date()
              }
            });
            result.trucksUpdated++;
          } else {
            result.trucksNotFound++;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Truck ${location.unitNumber}: ${message}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to fetch locations: ${message}`);
      console.error('[Motive] Sync error:', message);
    }

    this.lastSyncAt = new Date();
    this.lastSyncResult = result;

    console.log(`[Motive] Sync complete: ${result.trucksUpdated} updated, ${result.trucksNotFound} not found`);

    return result;
  }

  // Get current location for a specific truck
  async getTruckLocation(unitNumber: string): Promise<VehicleLocationData | null> {
    const locations = await this.fetchVehicleLocations();
    return locations.find(loc => loc.unitNumber === unitNumber) || null;
  }

  // Get all current vehicle locations (for map display)
  async getAllVehicleLocations(): Promise<VehicleLocationData[]> {
    return this.fetchVehicleLocations();
  }

  // Get sync status
  getSyncStatus(): { lastSyncAt: Date | null; lastResult: LocationSyncResult | null } {
    return {
      lastSyncAt: this.lastSyncAt,
      lastResult: this.lastSyncResult
    };
  }
}

// Singleton instance
let motiveServiceInstance: MotiveService | null = null;

export const getMotiveService = (): MotiveService => {
  if (!motiveServiceInstance) {
    motiveServiceInstance = new MotiveService();
  }
  return motiveServiceInstance;
};
