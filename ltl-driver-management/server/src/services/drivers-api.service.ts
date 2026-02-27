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
  // Additional fields from API
  department: string | null;
  jobTitle: string | null;
  active: boolean;
  hireDate: number | null; // Unix timestamp
  termDate: number | null; // Unix timestamp
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
  private mapToDriver(apiDriver: ApiDriver, carrierId: number, locationId: number | null): {
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
    driverType: string;
    hrStatus: string;
    locationId: number | null;
    jobTitle: string | null;
    dateOfHire: Date | null;
  } {
    const cdlInfo = this.extractCdlInfo(apiDriver.skills);
    const medicalExpiration = this.extractMedicalExpiration(apiDriver.skills);
    const endorsements = this.extractEndorsements(apiDriver.skills);

    // Determine driver type: T for temp drivers, E for regular employees
    const isTemp = /temp/i.test(apiDriver.refNum);
    const driverType = isTemp ? 'T' : 'E';

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
      active: apiDriver.active, // Use API's active status
      driverType,
      hrStatus: apiDriver.active ? 'Active' : 'Inactive', // Set from API's active field
      locationId,
      jobTitle: apiDriver.jobTitle || null,
      dateOfHire: apiDriver.hireDate ? new Date(apiDriver.hireDate * 1000) : null
    };
  }

  // Check if driver number contains letters and is not a temp driver
  // These drivers should be assigned to "Other" carrier instead of CCFS
  private shouldAssignToOtherCarrier(driverNumber: string): boolean {
    if (!driverNumber) return false;

    // Check if contains any letters
    const hasLetters = /[a-zA-Z]/.test(driverNumber);

    // Check if contains "Temp" (case-insensitive)
    const isTemp = /temp/i.test(driverNumber);

    // Assign to Other if has letters AND is not a temp driver
    return hasLetters && !isTemp;
  }

  // Sync drivers from external API
  async syncDrivers(): Promise<DriverSyncResult> {
    const result: DriverSyncResult = { created: 0, updated: 0, errors: [], total: 0 };
    let assignedToOther = 0;
    let markedInactive = 0;
    const processedExternalIds: Set<string> = new Set();

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

      const defaultCarrierId = carrier.id;

      // Get the "Other" carrier (ID 5014) for drivers with alphanumeric numbers
      const otherCarrier = await prisma.carrier.findFirst({
        where: { id: 5014 }
      });
      const otherCarrierId = otherCarrier?.id || defaultCarrierId;

      if (otherCarrier) {
        console.log(`[DriversAPI] Using "Other" carrier (ID: ${otherCarrierId}) for alphanumeric driver numbers`);
      } else {
        console.log(`[DriversAPI] Warning: "Other" carrier (ID: 5014) not found, using default carrier`);
      }

      // Build location code -> id map for linking drivers to locations
      const locations = await prisma.location.findMany({
        select: { id: true, code: true }
      });
      const locationMap = new Map<string, number>();
      for (const loc of locations) {
        locationMap.set(loc.code.toUpperCase(), loc.id);
      }
      console.log(`[DriversAPI] Loaded ${locationMap.size} locations for mapping`);

      // Only sync drivers with these job titles
      const allowedJobTitles = [
        'CDL A1',
        'Linehaul Driver 1',
        'CDL A',
        'Linehaul Driver',
        'Operations Supervisor',
        'Service Center Manager',
        'CDL A 0-90 DAYS',
        'CDL B1'
      ];
      const allowedJobTitlesLower = allowedJobTitles.map(t => t.toLowerCase());

      // Filter to only allowed job titles
      const filteredDrivers = apiDrivers.filter(d =>
        d.jobTitle && allowedJobTitlesLower.includes(d.jobTitle.toLowerCase())
      );
      console.log(`[DriversAPI] Filtered to ${filteredDrivers.length} drivers with allowed job titles`);

      // Process drivers in batches
      const batchSize = 100;

      for (let i = 0; i < filteredDrivers.length; i += batchSize) {
        const batch = filteredDrivers.slice(i, i + batchSize);

        for (const apiDriver of batch) {
          try {
            // Determine which carrier to assign based on driver number
            // Drivers with alphanumeric numbers (not containing "Temp") go to "Other" carrier
            const carrierId = this.shouldAssignToOtherCarrier(apiDriver.refNum)
              ? otherCarrierId
              : defaultCarrierId;

            if (carrierId === otherCarrierId && otherCarrier) {
              assignedToOther++;
            }

            // Look up locationId from serviceCenterCode
            const locationId = apiDriver.serviceCenterCode
              ? locationMap.get(apiDriver.serviceCenterCode.toUpperCase()) || null
              : null;

            const driverData = this.mapToDriver(apiDriver, carrierId, locationId);

            // Track this external ID as processed (active in HR)
            processedExternalIds.add(driverData.externalDriverId);

            // Find existing by externalDriverId first, then by driver number, then by name
            let existing = await prisma.carrierDriver.findFirst({
              where: { externalDriverId: driverData.externalDriverId }
            });

            if (!existing) {
              // Try matching by driver number
              existing = await prisma.carrierDriver.findFirst({
                where: {
                  carrierId,
                  number: driverData.number
                }
              });
            }

            if (!existing) {
              // Try matching by name (for merging duplicates)
              existing = await prisma.carrierDriver.findFirst({
                where: {
                  carrierId,
                  name: { equals: driverData.name, mode: 'insensitive' }
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
        const processed = Math.min(i + batchSize, filteredDrivers.length);
        console.log(`[DriversAPI] Processed ${processed}/${filteredDrivers.length} drivers`);
      }

      // Mark drivers NOT in the API response as inactive (they are no longer in HR system)
      // Only update drivers that have an externalDriverId (meaning they were previously synced)
      // and are currently marked as active in HR
      if (processedExternalIds.size > 0) {
        const inactiveResult = await prisma.carrierDriver.updateMany({
          where: {
            externalDriverId: { not: null },
            hrStatus: 'Active',
            NOT: {
              externalDriverId: { in: Array.from(processedExternalIds) }
            }
          },
          data: {
            hrStatus: 'Inactive'
          }
        });
        markedInactive = inactiveResult.count;

        if (markedInactive > 0) {
          console.log(`[DriversAPI] Marked ${markedInactive} drivers as HR Inactive (no longer in API)`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to fetch drivers: ${message}`);
      console.error('[DriversAPI] Sync error:', message);
    }

    this.lastSyncAt = new Date();
    this.lastSyncResult = result;

    const summary = `Synced: ${result.created} created, ${result.updated} updated, ${markedInactive} marked inactive, ${result.errors.length} errors`;
    console.log(`[DriversAPI] ${summary}`);
    if (assignedToOther > 0) {
      console.log(`[DriversAPI] ${assignedToOther} drivers assigned to "Other" carrier (alphanumeric driver numbers)`);
    }

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
