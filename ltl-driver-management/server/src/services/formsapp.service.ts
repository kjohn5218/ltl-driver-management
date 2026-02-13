import axios, { AxiosInstance, AxiosError } from 'axios';
import { getFormsAppConfig, FormsAppConfig } from '../config/formsapp.config';
import { PrismaClient, EquipmentStatus, TruckType, TrailerType, DollyType } from '@prisma/client';

const prisma = new PrismaClient();

// FormsApp API Response Types
interface FormsAppAsset {
  id: number;
  assetNumber: string;
  assetType: string;
  status: string;
  year?: number;
  model?: string;
  vin?: string;
  licensePlate?: string;
  odometer?: number;
  engineHours?: number;
  locationId?: number;
  locationName?: string;
  manufacturerName?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface FormsAppResponse {
  items: FormsAppAsset[];
  total: number;
}

interface AssetQueryParams {
  asset_type?: string;
  search?: string;
  unit_number?: string;
  status?: string;
  location_id?: number;
  skip?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface SyncResult {
  created: number;
  updated: number;
  errors: string[];
  total: number;
}

export interface FullSyncResult {
  trucks: SyncResult;
  trailers: SyncResult;
  dollies: SyncResult;
  summary: string;
}

class FormsAppError extends Error {
  constructor(public statusCode: number, message: string, public details?: any) {
    super(message);
    this.name = 'FormsAppError';
  }
}

export class FormsAppService {
  private apiClient: AxiosInstance;
  private config: FormsAppConfig;
  private lastSyncAt: Date | null = null;
  private lastSyncResult: FullSyncResult | null = null;

  constructor() {
    this.config = getFormsAppConfig();
    this.apiClient = axios.create({
      baseURL: this.config.apiUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
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
      let message = 'FormsApp API request failed';

      if (data && typeof data === 'object' && 'message' in data) {
        message = data.message as string;
      } else if (data && typeof data === 'string') {
        message = data;
      }

      if (status === 429) {
        message = 'FormsApp API rate limit exceeded. Please wait and try again.';
      }

      throw new FormsAppError(status, message, data);
    } else if (error.request) {
      throw new FormsAppError(0, 'No response from FormsApp API', error.request);
    } else {
      throw new FormsAppError(0, error.message);
    }
  }

  // Rate limiting helper - ensures minimum delay between requests
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Fetch assets with pagination
  async fetchAssets(params: AssetQueryParams): Promise<FormsAppResponse> {
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const response = await this.apiClient.get<FormsAppResponse>(`/assets?${queryParams.toString()}`);
    return response.data;
  }

  // Fetch all assets of a type with pagination
  async fetchAllAssetsOfType(assetType: string): Promise<FormsAppAsset[]> {
    const allAssets: FormsAppAsset[] = [];
    const limit = 100;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.fetchAssets({
        asset_type: assetType,
        limit,
        skip
      });

      allAssets.push(...response.items);
      skip += limit;
      hasMore = allAssets.length < response.total;

      // Rate limiting: wait 150ms between requests (under 500/min)
      if (hasMore) {
        await this.delay(150);
      }
    }

    return allAssets;
  }

  // Map FormsApp status to local EquipmentStatus enum
  private mapStatus(formsAppStatus: string): EquipmentStatus {
    const statusMap: Record<string, EquipmentStatus> = {
      'ACTIVE': EquipmentStatus.AVAILABLE,
      'IN_SERVICE': EquipmentStatus.AVAILABLE,
      'INACTIVE': EquipmentStatus.OUT_OF_SERVICE,
      'OUT_OF_SERVICE': EquipmentStatus.OUT_OF_SERVICE,
      'MAINTENANCE': EquipmentStatus.MAINTENANCE,
      'IN_TRANSIT': EquipmentStatus.IN_TRANSIT,
      'ASSIGNED': EquipmentStatus.DISPATCHED,
      'DISPATCHED': EquipmentStatus.DISPATCHED
    };

    return statusMap[formsAppStatus?.toUpperCase()] || EquipmentStatus.AVAILABLE;
  }

  // Map FormsApp asset to truck data
  private mapToTruck(asset: FormsAppAsset): {
    unitNumber: string;
    truckType: TruckType;
    make: string | null;
    model: string | null;
    year: number | null;
    vin: string | null;
    licensePlate: string | null;
    status: EquipmentStatus;
    externalFleetId: string;
  } {
    // Determine truck type based on asset_type
    let truckType: TruckType = TruckType.SEMI_TRUCK;
    if (asset.assetType === 'straight_truck') {
      truckType = TruckType.STRAIGHT_TRUCK;
    }

    return {
      unitNumber: asset.assetNumber?.toUpperCase() || `TRUCK-${asset.id}`,
      truckType,
      make: asset.manufacturerName || null,
      model: asset.model || null,
      year: asset.year || null,
      vin: asset.vin?.toUpperCase() || null,
      licensePlate: asset.licensePlate?.toUpperCase() || null,
      status: this.mapStatus(asset.status),
      externalFleetId: String(asset.id)
    };
  }

  // Map FormsApp asset to trailer data
  private mapToTrailer(asset: FormsAppAsset): {
    unitNumber: string;
    trailerType: TrailerType;
    lengthFeet: number | null;
    status: EquipmentStatus;
    licensePlate: string | null;
    externalFleetId: string;
  } {
    // Infer trailer type from model/name if possible
    let trailerType: TrailerType = TrailerType.DRY_VAN_53;
    let lengthFeet = 53;

    const modelLower = (asset.model || '').toLowerCase();
    const assetNumber = asset.assetNumber || '';
    const assetNumberLower = assetNumber.toLowerCase();

    // Check for specific lengths in model or asset number
    // Order matters: check more specific patterns first
    if (modelLower.includes('pup')) {
      trailerType = TrailerType.PUP_TRAILER;
      lengthFeet = 28;
    } else if (modelLower.includes('reefer')) {
      if (modelLower.includes('28') || assetNumberLower.includes('28')) {
        trailerType = TrailerType.REEFER_28;
        lengthFeet = 28;
      } else {
        trailerType = TrailerType.REEFER_53;
        lengthFeet = 53;
      }
    } else if (modelLower.includes('flatbed')) {
      trailerType = TrailerType.FLATBED;
      lengthFeet = 53;
    } else if (modelLower.includes('tanker')) {
      trailerType = TrailerType.TANKER;
      lengthFeet = 53;
    } else {
      // For dry vans, detect length from model or asset number
      // Use regex to find length patterns like "28", "45", "48", "53"
      // Check model first, then asset number
      const lengthMatch = modelLower.match(/\b(28|40|45|48|53)\b/) ||
                          assetNumber.match(/\b(28|40|45|48|53)\b/) ||
                          assetNumber.match(/(28|40|45|48|53)/);

      if (lengthMatch) {
        lengthFeet = parseInt(lengthMatch[1], 10);
        if (lengthFeet === 28) {
          trailerType = TrailerType.DRY_VAN_28;
        } else {
          trailerType = TrailerType.DRY_VAN_53; // Use 53 type for 40, 45, 48, 53
        }
      }
    }

    return {
      unitNumber: assetNumber.toUpperCase() || `TRAILER-${asset.id}`,
      trailerType,
      lengthFeet,
      status: this.mapStatus(asset.status),
      licensePlate: asset.licensePlate?.toUpperCase() || null,
      externalFleetId: String(asset.id)
    };
  }

  // Map FormsApp asset to dolly data
  private mapToDolly(asset: FormsAppAsset): {
    unitNumber: string;
    dollyType: DollyType;
    status: EquipmentStatus;
    externalFleetId: string;
  } {
    // Detect B-dolly from name/model
    let dollyType: DollyType = DollyType.A_DOLLY;
    const modelLower = (asset.model || '').toLowerCase();
    const assetNumberLower = (asset.assetNumber || '').toLowerCase();

    if (modelLower.includes('b-dolly') || modelLower.includes('b dolly') ||
        assetNumberLower.includes('bdolly') || assetNumberLower.includes('b-dolly')) {
      dollyType = DollyType.B_DOLLY;
    }

    return {
      unitNumber: asset.assetNumber?.toUpperCase() || `DOLLY-${asset.id}`,
      dollyType,
      status: this.mapStatus(asset.status),
      externalFleetId: String(asset.id)
    };
  }

  // Sync trucks from FormsApp
  async syncTrucks(): Promise<SyncResult> {
    const result: SyncResult = { created: 0, updated: 0, errors: [], total: 0 };

    try {
      // Fetch semi_tractor and straight_truck types
      const [semiTrucks, straightTrucks] = await Promise.all([
        this.fetchAllAssetsOfType('semi_tractor'),
        this.fetchAllAssetsOfType('straight_truck')
      ]);

      const allTrucks = [...semiTrucks, ...straightTrucks];
      result.total = allTrucks.length;

      for (const asset of allTrucks) {
        try {
          const truckData = this.mapToTruck(asset);

          // Find existing by externalFleetId first, then by unitNumber
          let existing = await prisma.equipmentTruck.findFirst({
            where: { externalFleetId: truckData.externalFleetId }
          });

          if (!existing) {
            existing = await prisma.equipmentTruck.findFirst({
              where: { unitNumber: truckData.unitNumber }
            });
          }

          if (existing) {
            await prisma.equipmentTruck.update({
              where: { id: existing.id },
              data: {
                ...truckData,
                updatedAt: new Date()
              }
            });
            result.updated++;
          } else {
            await prisma.equipmentTruck.create({
              data: truckData
            });
            result.created++;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Truck ${asset.assetNumber}: ${message}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to fetch trucks: ${message}`);
    }

    return result;
  }

  // Sync trailers from FormsApp
  async syncTrailers(): Promise<SyncResult> {
    const result: SyncResult = { created: 0, updated: 0, errors: [], total: 0 };

    try {
      const trailers = await this.fetchAllAssetsOfType('trailer');
      result.total = trailers.length;

      for (const asset of trailers) {
        try {
          const trailerData = this.mapToTrailer(asset);

          let existing = await prisma.equipmentTrailer.findFirst({
            where: { externalFleetId: trailerData.externalFleetId }
          });

          if (!existing) {
            existing = await prisma.equipmentTrailer.findFirst({
              where: { unitNumber: trailerData.unitNumber }
            });
          }

          if (existing) {
            await prisma.equipmentTrailer.update({
              where: { id: existing.id },
              data: {
                ...trailerData,
                updatedAt: new Date()
              }
            });
            result.updated++;
          } else {
            await prisma.equipmentTrailer.create({
              data: trailerData
            });
            result.created++;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Trailer ${asset.assetNumber}: ${message}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to fetch trailers: ${message}`);
    }

    return result;
  }

  // Sync dollies from FormsApp
  async syncDollies(): Promise<SyncResult> {
    const result: SyncResult = { created: 0, updated: 0, errors: [], total: 0 };

    try {
      const dollies = await this.fetchAllAssetsOfType('converter_dolly');
      result.total = dollies.length;

      for (const asset of dollies) {
        try {
          const dollyData = this.mapToDolly(asset);

          let existing = await prisma.equipmentDolly.findFirst({
            where: { externalFleetId: dollyData.externalFleetId }
          });

          if (!existing) {
            existing = await prisma.equipmentDolly.findFirst({
              where: { unitNumber: dollyData.unitNumber }
            });
          }

          if (existing) {
            await prisma.equipmentDolly.update({
              where: { id: existing.id },
              data: {
                ...dollyData,
                updatedAt: new Date()
              }
            });
            result.updated++;
          } else {
            await prisma.equipmentDolly.create({
              data: dollyData
            });
            result.created++;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Dolly ${asset.assetNumber}: ${message}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to fetch dollies: ${message}`);
    }

    return result;
  }

  // Full sync of all equipment types
  async syncAllEquipment(): Promise<FullSyncResult> {
    console.log('[FormsApp] Starting full equipment sync...');
    const startTime = Date.now();

    const [trucks, trailers, dollies] = await Promise.all([
      this.syncTrucks(),
      this.syncTrailers(),
      this.syncDollies()
    ]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalCreated = trucks.created + trailers.created + dollies.created;
    const totalUpdated = trucks.updated + trailers.updated + dollies.updated;
    const totalErrors = trucks.errors.length + trailers.errors.length + dollies.errors.length;

    const result: FullSyncResult = {
      trucks,
      trailers,
      dollies,
      summary: `Synced in ${elapsed}s: ${totalCreated} created, ${totalUpdated} updated, ${totalErrors} errors`
    };

    this.lastSyncAt = new Date();
    this.lastSyncResult = result;

    console.log(`[FormsApp] ${result.summary}`);

    return result;
  }

  // Get sync status
  getSyncStatus(): { lastSyncAt: Date | null; lastResult: FullSyncResult | null } {
    return {
      lastSyncAt: this.lastSyncAt,
      lastResult: this.lastSyncResult
    };
  }
}

// Singleton instance
let formsAppServiceInstance: FormsAppService | null = null;

export const getFormsAppService = (): FormsAppService => {
  if (!formsAppServiceInstance) {
    formsAppServiceInstance = new FormsAppService();
  }
  return formsAppServiceInstance;
};
