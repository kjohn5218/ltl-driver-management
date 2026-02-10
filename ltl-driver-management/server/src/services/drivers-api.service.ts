import axios, { AxiosInstance, AxiosError } from 'axios';
import { getDriversApiConfig, DriversApiConfig } from '../config/drivers-api.config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// API Response Types
interface DriverSkill {
  id: number;
  skillCode: string;
  licenseNumber: string | null;
  licenseState: string | null;
  startDate: number[] | null; // [year, month, day]
  endDate: number[] | null;
}

interface ApiDriver {
  id: number;
  carrierCode: string;
  serviceCenterCode: string;
  supervisorActorRefNum: string | null;
  refNum: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phoneNum: string | null;
  skills: DriverSkill[];
  userName: string;
  validHazmatEndorsement: boolean;
}

export interface DriverSyncResult {
  created: number;
  updated: number;
  errors: string[];
  total: number;
}

class DriversApiError extends Error {
  constructor(public statusCode: number, message: string, public details?: any) {
    super(message);
    this.name = 'DriversApiError';
  }
}

export class DriversApiService {
  private apiClient: AxiosInstance;
  private config: DriversApiConfig;
  private lastSyncAt: Date | null = null;
  private lastSyncResult: DriverSyncResult | null = null;

  constructor() {
    this.config = getDriversApiConfig();
    this.apiClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 60000, // 60 second timeout for large dataset
      auth: {
        username: this.config.username,
        password: this.config.password
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
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
      let message = 'Drivers API request failed';

      if (status === 401) {
        message = 'Drivers API authentication failed. Check username/password.';
      } else if (data && typeof data === 'object' && 'message' in data) {
        message = data.message as string;
      }

      throw new DriversApiError(status, message, data);
    } else if (error.request) {
      throw new DriversApiError(0, 'No response from Drivers API', error.request);
    } else {
      throw new DriversApiError(0, error.message);
    }
  }

  // Fetch all drivers for the configured carrier
  async fetchAllDrivers(): Promise<ApiDriver[]> {
    const response = await this.apiClient.get<ApiDriver[]>(
      `/actors/carrier/${this.config.carrierCode}`
    );
    return response.data;
  }

  // Parse date array [year, month, day] to Date object
  private parseDate(dateArr: number[] | null): Date | null {
    if (!dateArr || dateArr.length < 3) return null;
    // Month is 1-indexed in the API, but Date constructor expects 0-indexed
    return new Date(dateArr[0], dateArr[1] - 1, dateArr[2]);
  }

  // Extract CDL info from skills
  private extractCdlInfo(skills: DriverSkill[]): {
    licenseClass: string | null;
    licenseNumber: string | null;
    licenseState: string | null;
    licenseExpiration: Date | null;
  } {
    // Find the most recent CDL_A skill
    const cdlSkills = skills
      .filter(s => s.skillCode === 'CDL_A')
      .sort((a, b) => {
        const dateA = this.parseDate(a.endDate)?.getTime() || 0;
        const dateB = this.parseDate(b.endDate)?.getTime() || 0;
        return dateB - dateA;
      });

    const cdl = cdlSkills[0];
    if (!cdl) {
      return { licenseClass: null, licenseNumber: null, licenseState: null, licenseExpiration: null };
    }

    return {
      licenseClass: 'A',
      licenseNumber: cdl.licenseNumber,
      licenseState: cdl.licenseState,
      licenseExpiration: this.parseDate(cdl.endDate)
    };
  }

  // Extract medical card expiration from skills
  private extractMedicalExpiration(skills: DriverSkill[]): Date | null {
    const medicalSkills = skills
      .filter(s => s.skillCode === 'MEDICAL')
      .sort((a, b) => {
        const dateA = this.parseDate(a.endDate)?.getTime() || 0;
        const dateB = this.parseDate(b.endDate)?.getTime() || 0;
        return dateB - dateA;
      });

    const medical = medicalSkills[0];
    return medical ? this.parseDate(medical.endDate) : null;
  }

  // Extract endorsements from skills
  private extractEndorsements(skills: DriverSkill[]): string {
    const endorsementCodes = ['HAZMAT', 'TANKER', 'LCV', 'DOUBLES', 'TRIPLES'];
    const endorsements = skills
      .filter(s => endorsementCodes.includes(s.skillCode))
      .map(s => s.skillCode.toLowerCase());

    // Remove duplicates
    return [...new Set(endorsements)].join(',');
  }

  // Map API driver to local CarrierDriver data
  private mapToDriver(apiDriver: ApiDriver, carrierId: number): {
    carrierId: number;
    name: string;
    phoneNumber: string | null;
    number: string;
    externalDriverId: string;
    currentTerminalCode: string | null;
    hazmatEndorsement: boolean;
    licenseClass: string | null;
    licenseNumber: string | null;
    licenseState: string | null;
    licenseExpiration: Date | null;
    medicalCardExpiration: Date | null;
    endorsements: string | null;
    active: boolean;
  } {
    const cdlInfo = this.extractCdlInfo(apiDriver.skills);
    const medicalExpiration = this.extractMedicalExpiration(apiDriver.skills);
    const endorsements = this.extractEndorsements(apiDriver.skills);

    return {
      carrierId,
      name: apiDriver.fullName || `${apiDriver.firstName} ${apiDriver.lastName}`.trim(),
      phoneNumber: apiDriver.phoneNum,
      number: apiDriver.refNum,
      externalDriverId: String(apiDriver.id),
      currentTerminalCode: apiDriver.serviceCenterCode || null,
      hazmatEndorsement: apiDriver.validHazmatEndorsement,
      licenseClass: cdlInfo.licenseClass,
      licenseNumber: cdlInfo.licenseNumber,
      licenseState: cdlInfo.licenseState,
      licenseExpiration: cdlInfo.licenseExpiration,
      medicalCardExpiration: medicalExpiration,
      endorsements: endorsements || null,
      active: true
    };
  }

  // Sync drivers from external API
  async syncDrivers(): Promise<DriverSyncResult> {
    const result: DriverSyncResult = { created: 0, updated: 0, errors: [], total: 0 };

    try {
      console.log('[DriversAPI] Fetching drivers from external API...');
      const apiDrivers = await this.fetchAllDrivers();
      result.total = apiDrivers.length;
      console.log(`[DriversAPI] Fetched ${apiDrivers.length} drivers`);

      // Get or create the carrier for CCYQ - use exact SCAC code match only
      let carrier = await prisma.carrier.findFirst({
        where: { scacCode: this.config.carrierCode }
      });

      if (!carrier) {
        // Create a default carrier for the drivers
        carrier = await prisma.carrier.create({
          data: {
            name: 'Contract Freighters',
            scacCode: this.config.carrierCode,
            status: 'ACTIVE'
          }
        });
        console.log(`[DriversAPI] Created carrier: ${carrier.name} (ID: ${carrier.id})`);
      }

      const carrierId = carrier.id;

      // Process drivers in batches
      const batchSize = 100;
      for (let i = 0; i < apiDrivers.length; i += batchSize) {
        const batch = apiDrivers.slice(i, i + batchSize);

        for (const apiDriver of batch) {
          try {
            const driverData = this.mapToDriver(apiDriver, carrierId);

            // Find existing by externalDriverId first, then by number
            let existing = await prisma.carrierDriver.findFirst({
              where: { externalDriverId: driverData.externalDriverId }
            });

            if (!existing) {
              existing = await prisma.carrierDriver.findFirst({
                where: {
                  carrierId,
                  number: driverData.number
                }
              });
            }

            if (existing) {
              await prisma.carrierDriver.update({
                where: { id: existing.id },
                data: {
                  ...driverData,
                  updatedAt: new Date()
                }
              });
              result.updated++;
            } else {
              await prisma.carrierDriver.create({
                data: driverData
              });
              result.created++;
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Driver ${apiDriver.refNum}: ${message}`);
          }
        }

        // Log progress
        const processed = Math.min(i + batchSize, apiDrivers.length);
        console.log(`[DriversAPI] Processed ${processed}/${apiDrivers.length} drivers`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to fetch drivers: ${message}`);
      console.error('[DriversAPI] Sync error:', message);
    }

    this.lastSyncAt = new Date();
    this.lastSyncResult = result;

    const summary = `Synced: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors`;
    console.log(`[DriversAPI] ${summary}`);

    return result;
  }

  // Get sync status
  getSyncStatus(): { lastSyncAt: Date | null; lastResult: DriverSyncResult | null } {
    return {
      lastSyncAt: this.lastSyncAt,
      lastResult: this.lastSyncResult
    };
  }
}

// Singleton instance
let driversApiServiceInstance: DriversApiService | null = null;

export const getDriversApiService = (): DriversApiService => {
  if (!driversApiServiceInstance) {
    driversApiServiceInstance = new DriversApiService();
  }
  return driversApiServiceInstance;
};
