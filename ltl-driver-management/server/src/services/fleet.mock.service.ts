/**
 * Fleet Mock Service
 *
 * This service simulates fetching equipment data from an external Fleet Management system.
 * In production, this would be replaced with actual API calls to the Fleet program.
 */

import { EquipmentStatus, TrailerType, TruckType, DollyType } from '@prisma/client';

export interface FleetTrailer {
  id: number;
  unitNumber: string;
  trailerType: TrailerType;
  lengthFeet: number;
  capacityWeight: number;
  capacityCube?: number;
  status: EquipmentStatus;
  currentLocation?: string;
  licensePlate?: string;
  licensePlateState?: string;
  lastInspectionDate?: Date;
  nextInspectionDate?: Date;
  maintenanceStatus?: string;
  maintenanceNotes?: string;
  owned: boolean;
  externalFleetId?: string;
}

export interface FleetTruck {
  id: number;
  unitNumber: string;
  truckType: TruckType;
  make: string;
  model: string;
  year: number;
  vin?: string;
  status: EquipmentStatus;
  licensePlate?: string;
  licensePlateState?: string;
  fuelType?: string;
  maintenanceStatus?: string;
  maintenanceNotes?: string;
  owned: boolean;
  externalFleetId?: string;
}

export interface FleetDolly {
  id: number;
  unitNumber: string;
  dollyType: DollyType;
  status: EquipmentStatus;
  lastInspectionDate?: Date;
  nextInspectionDate?: Date;
  maintenanceStatus?: string;
  maintenanceNotes?: string;
  externalFleetId?: string;
}

export interface FleetTerminal {
  id: number;
  code: string;
  name: string;
  address?: string;
  city: string;
  state: string;
  zipCode?: string;
  phone?: string;
  contact?: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  active: boolean;
}

// Mock terminal data - simulating data from Fleet program
const mockTerminals: FleetTerminal[] = [
  { id: 1, code: 'PHX', name: 'Phoenix Terminal', city: 'Phoenix', state: 'AZ', zipCode: '85034', timezone: 'America/Phoenix', active: true, phone: '602-555-0100' },
  { id: 2, code: 'DEN', name: 'Denver Terminal', city: 'Denver', state: 'CO', zipCode: '80239', timezone: 'America/Denver', active: true, phone: '303-555-0100' },
  { id: 3, code: 'LAX', name: 'Los Angeles Terminal', city: 'Los Angeles', state: 'CA', zipCode: '90058', timezone: 'America/Los_Angeles', active: true, phone: '323-555-0100' },
  { id: 4, code: 'TUS', name: 'Tucson Terminal', city: 'Tucson', state: 'AZ', zipCode: '85706', timezone: 'America/Phoenix', active: true, phone: '520-555-0100' },
  { id: 5, code: 'GJT', name: 'Grand Junction Terminal', city: 'Grand Junction', state: 'CO', zipCode: '81501', timezone: 'America/Denver', active: true, phone: '970-555-0100' },
  { id: 6, code: 'ABQ', name: 'Albuquerque Terminal', city: 'Albuquerque', state: 'NM', zipCode: '87102', timezone: 'America/Denver', active: true, phone: '505-555-0100' },
  { id: 7, code: 'ELP', name: 'El Paso Terminal', city: 'El Paso', state: 'TX', zipCode: '79901', timezone: 'America/Denver', active: true, phone: '915-555-0100' },
  { id: 8, code: 'SLC', name: 'Salt Lake City Terminal', city: 'Salt Lake City', state: 'UT', zipCode: '84104', timezone: 'America/Denver', active: true, phone: '801-555-0100' },
  { id: 9, code: 'LAS', name: 'Las Vegas Terminal', city: 'Las Vegas', state: 'NV', zipCode: '89101', timezone: 'America/Los_Angeles', active: true, phone: '702-555-0100' },
  { id: 10, code: 'SAN', name: 'San Diego Terminal', city: 'San Diego', state: 'CA', zipCode: '92101', timezone: 'America/Los_Angeles', active: true, phone: '619-555-0100' },
];

// Mock trailer data - simulating data from Fleet program
const mockTrailers: FleetTrailer[] = [
  // 53' Dry Vans
  { id: 1, unitNumber: 'TRL-5301', trailerType: 'DRY_VAN_53', lengthFeet: 53, capacityWeight: 45000, status: 'AVAILABLE', currentLocation: 'PHX', owned: true, externalFleetId: 'FL-TRL-001' },
  { id: 2, unitNumber: 'TRL-5302', trailerType: 'DRY_VAN_53', lengthFeet: 53, capacityWeight: 45000, status: 'AVAILABLE', currentLocation: 'PHX', owned: true, externalFleetId: 'FL-TRL-002' },
  { id: 3, unitNumber: 'TRL-5303', trailerType: 'DRY_VAN_53', lengthFeet: 53, capacityWeight: 45000, status: 'DISPATCHED', currentLocation: 'DEN', owned: true, externalFleetId: 'FL-TRL-003' },
  { id: 4, unitNumber: 'TRL-5304', trailerType: 'DRY_VAN_53', lengthFeet: 53, capacityWeight: 45000, status: 'AVAILABLE', currentLocation: 'PHX', owned: true, externalFleetId: 'FL-TRL-004' },
  { id: 5, unitNumber: 'TRL-5305', trailerType: 'DRY_VAN_53', lengthFeet: 53, capacityWeight: 45000, status: 'IN_TRANSIT', currentLocation: 'In Transit', owned: true, externalFleetId: 'FL-TRL-005' },
  { id: 6, unitNumber: 'TRL-5306', trailerType: 'DRY_VAN_53', lengthFeet: 53, capacityWeight: 45000, status: 'AVAILABLE', currentLocation: 'LAX', owned: true, externalFleetId: 'FL-TRL-006' },
  { id: 7, unitNumber: 'TRL-5307', trailerType: 'DRY_VAN_53', lengthFeet: 53, capacityWeight: 45000, status: 'MAINTENANCE', currentLocation: 'PHX Shop', maintenanceStatus: 'Brake Repair', owned: true, externalFleetId: 'FL-TRL-007' },
  { id: 8, unitNumber: 'TRL-5308', trailerType: 'DRY_VAN_53', lengthFeet: 53, capacityWeight: 45000, status: 'AVAILABLE', currentLocation: 'TUS', owned: true, externalFleetId: 'FL-TRL-008' },
  { id: 9, unitNumber: 'TRL-5309', trailerType: 'DRY_VAN_53', lengthFeet: 53, capacityWeight: 45000, status: 'AVAILABLE', currentLocation: 'PHX', owned: true, externalFleetId: 'FL-TRL-009' },
  { id: 10, unitNumber: 'TRL-5310', trailerType: 'DRY_VAN_53', lengthFeet: 53, capacityWeight: 45000, status: 'DISPATCHED', currentLocation: 'GJT', owned: true, externalFleetId: 'FL-TRL-010' },

  // 28' Pup Trailers
  { id: 11, unitNumber: 'PUP-2801', trailerType: 'PUP_TRAILER', lengthFeet: 28, capacityWeight: 22500, status: 'AVAILABLE', currentLocation: 'PHX', owned: true, externalFleetId: 'FL-PUP-001' },
  { id: 12, unitNumber: 'PUP-2802', trailerType: 'PUP_TRAILER', lengthFeet: 28, capacityWeight: 22500, status: 'AVAILABLE', currentLocation: 'PHX', owned: true, externalFleetId: 'FL-PUP-002' },
  { id: 13, unitNumber: 'PUP-2803', trailerType: 'PUP_TRAILER', lengthFeet: 28, capacityWeight: 22500, status: 'DISPATCHED', currentLocation: 'DEN', owned: true, externalFleetId: 'FL-PUP-003' },
  { id: 14, unitNumber: 'PUP-2804', trailerType: 'PUP_TRAILER', lengthFeet: 28, capacityWeight: 22500, status: 'AVAILABLE', currentLocation: 'LAX', owned: true, externalFleetId: 'FL-PUP-004' },
  { id: 15, unitNumber: 'PUP-2805', trailerType: 'PUP_TRAILER', lengthFeet: 28, capacityWeight: 22500, status: 'AVAILABLE', currentLocation: 'TUS', owned: true, externalFleetId: 'FL-PUP-005' },
  { id: 16, unitNumber: 'PUP-2806', trailerType: 'PUP_TRAILER', lengthFeet: 28, capacityWeight: 22500, status: 'IN_TRANSIT', currentLocation: 'In Transit', owned: true, externalFleetId: 'FL-PUP-006' },
  { id: 17, unitNumber: 'PUP-2807', trailerType: 'PUP_TRAILER', lengthFeet: 28, capacityWeight: 22500, status: 'AVAILABLE', currentLocation: 'PHX', owned: true, externalFleetId: 'FL-PUP-007' },
  { id: 18, unitNumber: 'PUP-2808', trailerType: 'PUP_TRAILER', lengthFeet: 28, capacityWeight: 22500, status: 'AVAILABLE', currentLocation: 'GJT', owned: true, externalFleetId: 'FL-PUP-008' },

  // 28' Dry Vans
  { id: 19, unitNumber: 'TRL-2801', trailerType: 'DRY_VAN_28', lengthFeet: 28, capacityWeight: 22500, status: 'AVAILABLE', currentLocation: 'PHX', owned: true, externalFleetId: 'FL-DV28-001' },
  { id: 20, unitNumber: 'TRL-2802', trailerType: 'DRY_VAN_28', lengthFeet: 28, capacityWeight: 22500, status: 'AVAILABLE', currentLocation: 'DEN', owned: true, externalFleetId: 'FL-DV28-002' },
  { id: 21, unitNumber: 'TRL-2803', trailerType: 'DRY_VAN_28', lengthFeet: 28, capacityWeight: 22500, status: 'DISPATCHED', currentLocation: 'LAX', owned: true, externalFleetId: 'FL-DV28-003' },
  { id: 22, unitNumber: 'TRL-2804', trailerType: 'DRY_VAN_28', lengthFeet: 28, capacityWeight: 22500, status: 'AVAILABLE', currentLocation: 'TUS', owned: true, externalFleetId: 'FL-DV28-004' },

  // 53' Reefers
  { id: 23, unitNumber: 'RFR-5301', trailerType: 'REEFER_53', lengthFeet: 53, capacityWeight: 42000, status: 'AVAILABLE', currentLocation: 'PHX', owned: true, externalFleetId: 'FL-RFR-001' },
  { id: 24, unitNumber: 'RFR-5302', trailerType: 'REEFER_53', lengthFeet: 53, capacityWeight: 42000, status: 'AVAILABLE', currentLocation: 'LAX', owned: true, externalFleetId: 'FL-RFR-002' },
  { id: 25, unitNumber: 'RFR-5303', trailerType: 'REEFER_53', lengthFeet: 53, capacityWeight: 42000, status: 'MAINTENANCE', currentLocation: 'PHX Shop', maintenanceStatus: 'Reefer Unit Repair', owned: true, externalFleetId: 'FL-RFR-003' },

  // Flatbeds
  { id: 26, unitNumber: 'FLT-4801', trailerType: 'FLATBED', lengthFeet: 48, capacityWeight: 48000, status: 'AVAILABLE', currentLocation: 'PHX', owned: true, externalFleetId: 'FL-FLT-001' },
  { id: 27, unitNumber: 'FLT-4802', trailerType: 'FLATBED', lengthFeet: 48, capacityWeight: 48000, status: 'AVAILABLE', currentLocation: 'DEN', owned: true, externalFleetId: 'FL-FLT-002' },
  { id: 28, unitNumber: 'FLT-5301', trailerType: 'FLATBED', lengthFeet: 53, capacityWeight: 48000, status: 'DISPATCHED', currentLocation: 'GJT', owned: true, externalFleetId: 'FL-FLT-003' },

  // Step Decks
  { id: 29, unitNumber: 'STD-4801', trailerType: 'STEP_DECK', lengthFeet: 48, capacityWeight: 45000, status: 'AVAILABLE', currentLocation: 'PHX', owned: true, externalFleetId: 'FL-STD-001' },
  { id: 30, unitNumber: 'STD-5301', trailerType: 'STEP_DECK', lengthFeet: 53, capacityWeight: 45000, status: 'AVAILABLE', currentLocation: 'LAX', owned: true, externalFleetId: 'FL-STD-002' },
];

// Mock truck data
const mockTrucks: FleetTruck[] = [
  { id: 1, unitNumber: 'TRK-101', truckType: 'SEMI_TRUCK', make: 'Freightliner', model: 'Cascadia', year: 2022, status: 'AVAILABLE', owned: true, externalFleetId: 'FL-TRK-001' },
  { id: 2, unitNumber: 'TRK-102', truckType: 'SEMI_TRUCK', make: 'Freightliner', model: 'Cascadia', year: 2022, status: 'DISPATCHED', owned: true, externalFleetId: 'FL-TRK-002' },
  { id: 3, unitNumber: 'TRK-103', truckType: 'SEMI_TRUCK', make: 'Peterbilt', model: '579', year: 2021, status: 'AVAILABLE', owned: true, externalFleetId: 'FL-TRK-003' },
  { id: 4, unitNumber: 'TRK-104', truckType: 'SEMI_TRUCK', make: 'Kenworth', model: 'T680', year: 2023, status: 'AVAILABLE', owned: true, externalFleetId: 'FL-TRK-004' },
  { id: 5, unitNumber: 'TRK-105', truckType: 'SEMI_TRUCK', make: 'Freightliner', model: 'Cascadia', year: 2022, status: 'IN_TRANSIT', owned: true, externalFleetId: 'FL-TRK-005' },
  { id: 6, unitNumber: 'TRK-106', truckType: 'SEMI_TRUCK', make: 'Peterbilt', model: '389', year: 2020, status: 'AVAILABLE', owned: true, externalFleetId: 'FL-TRK-006' },
  { id: 7, unitNumber: 'TRK-107', truckType: 'SEMI_TRUCK', make: 'Volvo', model: 'VNL', year: 2023, status: 'AVAILABLE', owned: true, externalFleetId: 'FL-TRK-007' },
  { id: 8, unitNumber: 'TRK-108', truckType: 'SEMI_TRUCK', make: 'International', model: 'LT', year: 2021, status: 'MAINTENANCE', maintenanceStatus: 'Engine Service', owned: true, externalFleetId: 'FL-TRK-008' },
  { id: 9, unitNumber: 'TRK-109', truckType: 'STRAIGHT_TRUCK', make: 'Freightliner', model: 'M2', year: 2022, status: 'AVAILABLE', owned: true, externalFleetId: 'FL-TRK-009' },
  { id: 10, unitNumber: 'TRK-110', truckType: 'SEMI_TRUCK', make: 'Kenworth', model: 'W900', year: 2019, status: 'AVAILABLE', owned: true, externalFleetId: 'FL-TRK-010' },
  { id: 11, unitNumber: 'TRK-111', truckType: 'SEMI_TRUCK', make: 'Freightliner', model: 'Cascadia', year: 2023, status: 'AVAILABLE', owned: true, externalFleetId: 'FL-TRK-011' },
  { id: 12, unitNumber: 'TRK-112', truckType: 'SEMI_TRUCK', make: 'Peterbilt', model: '579', year: 2022, status: 'DISPATCHED', owned: true, externalFleetId: 'FL-TRK-012' },
];

// Mock dolly data
const mockDollies: FleetDolly[] = [
  { id: 1, unitNumber: 'DLY-001', dollyType: 'A_DOLLY', status: 'AVAILABLE', externalFleetId: 'FL-DLY-001' },
  { id: 2, unitNumber: 'DLY-002', dollyType: 'A_DOLLY', status: 'AVAILABLE', externalFleetId: 'FL-DLY-002' },
  { id: 3, unitNumber: 'DLY-003', dollyType: 'A_DOLLY', status: 'DISPATCHED', externalFleetId: 'FL-DLY-003' },
  { id: 4, unitNumber: 'DLY-004', dollyType: 'B_DOLLY', status: 'AVAILABLE', externalFleetId: 'FL-DLY-004' },
  { id: 5, unitNumber: 'DLY-005', dollyType: 'A_DOLLY', status: 'AVAILABLE', externalFleetId: 'FL-DLY-005' },
  { id: 6, unitNumber: 'DLY-006', dollyType: 'A_DOLLY', status: 'IN_TRANSIT', externalFleetId: 'FL-DLY-006' },
  { id: 7, unitNumber: 'DLY-007', dollyType: 'B_DOLLY', status: 'MAINTENANCE', maintenanceStatus: 'Axle Repair', externalFleetId: 'FL-DLY-007' },
  { id: 8, unitNumber: 'DLY-008', dollyType: 'A_DOLLY', status: 'AVAILABLE', externalFleetId: 'FL-DLY-008' },
];

/**
 * Fleet Mock Service
 */
export const fleetMockService = {
  /**
   * Get all trailers from Fleet system
   */
  getTrailers: async (filters?: {
    search?: string;
    status?: EquipmentStatus;
    type?: TrailerType;
    limit?: number;
    page?: number;
  }): Promise<{ trailers: FleetTrailer[]; total: number }> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50));

    let filtered = [...mockTrailers];

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(t =>
        t.unitNumber.toLowerCase().includes(searchLower) ||
        t.currentLocation?.toLowerCase().includes(searchLower)
      );
    }

    if (filters?.status) {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    if (filters?.type) {
      filtered = filtered.filter(t => t.trailerType === filters.type);
    }

    const total = filtered.length;
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      trailers: filtered.slice(start, end),
      total,
    };
  },

  /**
   * Get a trailer by unit number
   */
  getTrailerByUnitNumber: async (unitNumber: string): Promise<FleetTrailer | null> => {
    await new Promise(resolve => setTimeout(resolve, 50));
    return mockTrailers.find(t => t.unitNumber === unitNumber) || null;
  },

  /**
   * Get all trucks from Fleet system
   */
  getTrucks: async (filters?: {
    search?: string;
    status?: EquipmentStatus;
    type?: TruckType;
    limit?: number;
    page?: number;
  }): Promise<{ trucks: FleetTruck[]; total: number }> => {
    await new Promise(resolve => setTimeout(resolve, 50));

    let filtered = [...mockTrucks];

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(t =>
        t.unitNumber.toLowerCase().includes(searchLower) ||
        t.make.toLowerCase().includes(searchLower) ||
        t.model.toLowerCase().includes(searchLower)
      );
    }

    if (filters?.status) {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    if (filters?.type) {
      filtered = filtered.filter(t => t.truckType === filters.type);
    }

    const total = filtered.length;
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      trucks: filtered.slice(start, end),
      total,
    };
  },

  /**
   * Get all dollies from Fleet system
   */
  getDollies: async (filters?: {
    search?: string;
    status?: EquipmentStatus;
    type?: DollyType;
    limit?: number;
    page?: number;
  }): Promise<{ dollies: FleetDolly[]; total: number }> => {
    await new Promise(resolve => setTimeout(resolve, 50));

    let filtered = [...mockDollies];

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(d => d.unitNumber.toLowerCase().includes(searchLower));
    }

    if (filters?.status) {
      filtered = filtered.filter(d => d.status === filters.status);
    }

    if (filters?.type) {
      filtered = filtered.filter(d => d.dollyType === filters.type);
    }

    const total = filtered.length;
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      dollies: filtered.slice(start, end),
      total,
    };
  },

  /**
   * Sync trailers from Fleet to local database
   * In production, this would sync with the real Fleet API
   */
  syncTrailersToDatabase: async (): Promise<FleetTrailer[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockTrailers;
  },

  /**
   * Sync trucks from Fleet to local database
   */
  syncTrucksToDatabase: async (): Promise<FleetTruck[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockTrucks;
  },

  /**
   * Sync dollies from Fleet to local database
   */
  syncDolliesToDatabase: async (): Promise<FleetDolly[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockDollies;
  },

  /**
   * Get all terminals from Fleet system
   */
  getTerminals: async (filters?: {
    search?: string;
    active?: boolean;
    limit?: number;
    page?: number;
  }): Promise<{ terminals: FleetTerminal[]; total: number }> => {
    await new Promise(resolve => setTimeout(resolve, 50));

    let filtered = [...mockTerminals];

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(t =>
        t.code.toLowerCase().includes(searchLower) ||
        t.name.toLowerCase().includes(searchLower) ||
        t.city.toLowerCase().includes(searchLower) ||
        t.state.toLowerCase().includes(searchLower)
      );
    }

    if (filters?.active !== undefined) {
      filtered = filtered.filter(t => t.active === filters.active);
    }

    const total = filtered.length;
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      terminals: filtered.slice(start, end),
      total,
    };
  },

  /**
   * Get a terminal by code
   */
  getTerminalByCode: async (code: string): Promise<FleetTerminal | null> => {
    await new Promise(resolve => setTimeout(resolve, 50));
    return mockTerminals.find(t => t.code === code) || null;
  },
};
