/**
 * TMS Mock Service
 *
 * This service simulates fetching shipment data from an external TMS system.
 * In production, this would be replaced with actual API calls to the TMS.
 */

export interface TMSConsignee {
  name: string;
  city: string;
  state: string;
}

export interface TMSShipper {
  name: string;
  city: string;
  state: string;
}

export interface TMSHazmat {
  unNumber: string;
  hazardClass: string;
  packingGroup?: string;
  shippingName: string;
  isBulk: boolean;
  isLimitedQty: boolean;
}

export interface TMSShipment {
  proNumber: string;
  destTerminal: string;
  destTerminalSub?: string;
  scans: number;
  pieces: number;
  weight: number;
  consignee: TMSConsignee;
  shipper: TMSShipper;
  expDeliveryDate: string;
  loadedTerminal: string;
  unloadedTerminal?: string;
  hazmat?: TMSHazmat;
}

export interface TMSTripData {
  tripNumber: string;
  manifestNumber: string;
  originCode: string;
  destCode: string;
  driverName?: string;
  trailerNumber?: string;
  effort: string;
  timeDue?: string;
  lastLoad?: string;
  dispatchedAt?: Date;
  arrivedAt?: Date;
  shipments: TMSShipment[];
}

// Sample data generators for mock service
const sampleConsignees = [
  { name: 'Mba', city: 'Grand Junction', state: 'CO' },
  { name: 'Keenan Dahl Of Grand Junc', city: 'Grand Junction', state: 'CO' },
  { name: 'Double T Excavation/ Dock P-U', city: 'Fruita', state: 'CO' },
  { name: 'Fox Theatre San Juan Cinema', city: 'Montrose', state: 'CO' },
  { name: 'Ced All Phase Grand Junction', city: 'Grand Junction', state: 'CO' },
  { name: 'Ces', city: 'Grand Junction', state: 'CO' },
  { name: 'Ccfs - Gjt', city: 'Grand Junction', state: 'CO' },
  { name: 'Quality Pools & Spas Plus Inc.', city: 'Grand Junction', state: 'CO' },
  { name: 'Kourtney Reese', city: 'Montrose', state: 'CO' },
  { name: 'Flower Motor Co', city: 'Montrose', state: 'CO' },
  { name: 'Information Technology Sol Co', city: 'Grand Junction', state: 'CO' },
  { name: 'Ramblebine Brewing', city: 'Grand Junction', state: 'CO' },
  { name: 'Gallaghers Flooring Llc', city: 'Grand Junction', state: 'CO' },
  { name: 'Restaurant Tea & Coffee Svc', city: 'Grand Junction', state: 'CO' },
  { name: 'Dahl Inc', city: 'Montrose', state: 'CO' },
  { name: 'Barney Brothers Off Road', city: 'Grand Junction', state: 'CO' },
  { name: 'Happy Stop Superstore', city: 'Grand Junction', state: 'CO' },
  { name: 'Dawn Carey / Dawn Carey', city: 'Grand Junction', state: 'CO' },
  { name: 'Reed Bumgarner / Reed Bumgarner', city: 'Grand Junction', state: 'CO' },
  { name: 'Nextran Truck Center - Grand Junction', city: 'Fruita', state: 'CO' },
  { name: 'Discover Goodwill', city: 'Grand Junction', state: 'CO' },
  { name: 'Gordon Composites', city: 'Montrose', state: 'CO' },
  { name: 'Abc Supply Co Inc', city: 'Grand Junction', state: 'CO' },
  { name: 'Eaglite Glass', city: 'Grand Junction', state: 'CO' },
  { name: 'Bolinger And Queen', city: 'Olathe', state: 'CO' },
  { name: 'Irrigation System Of W Colorad', city: 'Fruita', state: 'CO' },
  { name: 'Brickyard', city: 'Grand Junction', state: 'CO' },
  { name: 'Timberleaf Trailers', city: 'Grand Junction', state: 'CO' },
  { name: 'American Furniture Warehouse', city: 'Grand Junction', state: 'CO' },
  { name: 'Keiths Htg & Ac', city: 'Montrose', state: 'CO' },
  { name: 'Toms Electric Motor', city: 'Montrose', state: 'CO' },
  { name: 'Sybar Press', city: 'Montrose', state: 'CO' },
  { name: 'Ferrellgas - Grand Junction', city: 'Grand Junction', state: 'CO' },
];

const sampleShippers = [
  { name: 'Malouf Companies', city: 'Laurens', state: 'SC' },
  { name: 'Mti Baths', city: 'Sugar Hill', state: 'GA' },
  { name: 'Parts Fulfillment Center-48', city: 'West Valley City', state: 'UT' },
  { name: 'Mountain States Concessions', city: 'Salt Lake City', state: 'UT' },
  { name: 'Keystone Technologies', city: 'Kansas City', state: 'MO' },
  { name: 'Cme Wire & Cable', city: 'Santa Fe Springs', state: 'CA' },
  { name: 'Crosscountry Freight Solutions Bis', city: 'Bismarck', state: 'ND' },
  { name: 'Conely Company', city: 'Salt Lake City', state: 'UT' },
  { name: 'Prime Cabinetry', city: 'Gastonia', state: 'NC' },
  { name: 'Aer Sales', city: 'Albuquerque', state: 'NM' },
  { name: 'Ingram Micro', city: 'Mira Loma', state: 'CA' },
  { name: 'Bsg Denver', city: 'Denver', state: 'CO' },
  { name: 'Cartwright Distributing Inc', city: 'Denver', state: 'CO' },
  { name: 'Royal Cup Coffee', city: 'Denver', state: 'CO' },
  { name: 'Kohler Co', city: 'Kohler', state: 'WI' },
  { name: 'Wheel Pros 1025', city: 'West Valley', state: 'UT' },
  { name: 'American Distributiors', city: 'Bensenville', state: 'IL' },
  { name: 'Adsf/Spa Cover', city: 'Commerce City', state: 'CO' },
  { name: 'Trend Transport', city: 'Commerce City', state: 'CO' },
  { name: 'Nextran Truck Center', city: 'Commerce City', state: 'CO' },
  { name: 'Jay Florence', city: 'Aurora', state: 'CO' },
  { name: 'United Western Denver Llc', city: 'Denver', state: 'CO' },
  { name: 'Abc Supply Co.,inc. # 049', city: 'Denver', state: 'CO' },
  { name: 'C R Laurence', city: 'Denver', state: 'CO' },
  { name: 'Colorado Spears Mfg. Co.', city: 'Denver', state: 'CO' },
  { name: 'Spears Mfg Co', city: 'Denver', state: 'CO' },
  { name: 'Sunset Stone', city: 'Castle Rock', state: 'CO' },
  { name: 'Dexter Distribution Group Br09', city: 'Frederick', state: 'CO' },
  { name: 'Kellyspicers Paper (Den)', city: 'Denver', state: 'CO' },
  { name: 'Lennox Industries Inc', city: 'Denver', state: 'CO' },
  { name: 'Essex Brownell Inc.', city: 'Denver', state: 'CO' },
  { name: 'Fairbank Equipment - Evans Co', city: 'Evans', state: 'CO' },
];

const terminalSubLocations = ['SOUTH2', 'NORTH2', 'WEST2', 'EAST2', 'GJT-MN'];

// Hazmat materials database
const hazmatMaterials: TMSHazmat[] = [
  {
    unNumber: 'UN2794',
    hazardClass: '8',
    packingGroup: undefined,
    shippingName: 'BATTERIES, WET, FILLED WITH ACID, ELECTRIC',
    isBulk: false,
    isLimitedQty: false,
  },
  {
    unNumber: 'UN1760',
    hazardClass: '8',
    packingGroup: 'II',
    shippingName: 'CORROSIVE LIQUID, N.O.S.',
    isBulk: false,
    isLimitedQty: false,
  },
  {
    unNumber: 'UN1993',
    hazardClass: '3',
    packingGroup: 'III',
    shippingName: 'FLAMMABLE LIQUID, N.O.S.',
    isBulk: false,
    isLimitedQty: false,
  },
  {
    unNumber: 'UN1950',
    hazardClass: '2.1',
    packingGroup: undefined,
    shippingName: 'AEROSOLS',
    isBulk: false,
    isLimitedQty: true,
  },
  {
    unNumber: 'UN3082',
    hazardClass: '9',
    packingGroup: 'III',
    shippingName: 'ENVIRONMENTALLY HAZARDOUS SUBSTANCE, LIQUID, N.O.S.',
    isBulk: false,
    isLimitedQty: false,
  },
];

// Generate a random pro number
const generateProNumber = (): string => {
  const prefix = Math.random() > 0.5 ? '' : '0';
  const num = Math.floor(Math.random() * 9000000000) + 1000000000;
  return `${prefix}${num}`;
};

// Generate a random date within next 7 days
const generateDeliveryDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + Math.floor(Math.random() * 7) + 1);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
};

// Generate mock shipments for a trip
const generateMockShipments = (
  destTerminal: string,
  count: number,
  hazmatProbability: number = 0.05
): TMSShipment[] => {
  const shipments: TMSShipment[] = [];

  for (let i = 0; i < count; i++) {
    const consignee = sampleConsignees[Math.floor(Math.random() * sampleConsignees.length)];
    const shipper = sampleShippers[Math.floor(Math.random() * sampleShippers.length)];
    const subLocation = terminalSubLocations[Math.floor(Math.random() * terminalSubLocations.length)];

    const isHazmat = Math.random() < hazmatProbability;
    const hazmat = isHazmat
      ? hazmatMaterials[Math.floor(Math.random() * hazmatMaterials.length)]
      : undefined;

    const scans = Math.floor(Math.random() * 3) + 1;
    const pieces = scans + Math.floor(Math.random() * 3);
    const weight = Math.floor(Math.random() * 3000) + 50;

    shipments.push({
      proNumber: generateProNumber(),
      destTerminal,
      destTerminalSub: subLocation,
      scans,
      pieces,
      weight,
      consignee,
      shipper,
      expDeliveryDate: `Exp Delv: ${generateDeliveryDate()}`,
      loadedTerminal: 'DEN',
      unloadedTerminal: destTerminal,
      hazmat,
    });
  }

  return shipments;
};

/**
 * TMS Mock Service
 */
export const tmsMockService = {
  /**
   * Get trip data with shipments from TMS
   */
  getTripData: async (_tripId: number, tripNumber: string): Promise<TMSTripData> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Parse trip number to get origin/dest codes (e.g., "5760U-DEN-GJT" or just "5760U")
    const parts = tripNumber.split('-');
    const manifestNumber = parts[0] || tripNumber.slice(0, 5);
    const originCode = parts[1] || 'DEN';
    const destCode = parts[2] || 'GJT';

    // Generate realistic shipment count
    const shipmentCount = Math.floor(Math.random() * 25) + 15; // 15-40 shipments

    return {
      tripNumber,
      manifestNumber,
      originCode,
      destCode,
      driverName: 'DENGJT2',
      trailerNumber: `${Math.floor(Math.random() * 9000) + 1000}`,
      effort: `${Math.floor(Math.random() * 2) + 1} hr ${Math.floor(Math.random() * 60)} min`,
      lastLoad: `Dec ${Math.floor(Math.random() * 10) + 20} ${Math.floor(Math.random() * 12) + 1}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')} pm`,
      dispatchedAt: new Date(),
      arrivedAt: undefined,
      shipments: generateMockShipments(destCode, shipmentCount, 0.08),
    };
  },

  /**
   * Get all shipments for a trip
   */
  getTripShipments: async (_tripId: number): Promise<TMSShipment[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const shipmentCount = Math.floor(Math.random() * 25) + 15;
    return generateMockShipments('GJT', shipmentCount, 0.08);
  },

  /**
   * Get only hazmat shipments for a trip
   */
  getHazmatShipments: async (_tripId: number): Promise<TMSShipment[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate shipments with higher hazmat probability and filter
    const allShipments = generateMockShipments('GJT', 30, 0.15);
    return allShipments.filter(s => s.hazmat !== undefined);
  },

  /**
   * Get trip totals
   */
  getTripTotals: async (shipments: TMSShipment[]): Promise<{
    totalScans: number;
    totalPieces: number;
    totalWeight: number;
  }> => {
    return {
      totalScans: shipments.reduce((sum, s) => sum + s.scans, 0),
      totalPieces: shipments.reduce((sum, s) => sum + s.pieces, 0),
      totalWeight: shipments.reduce((sum, s) => sum + s.weight, 0),
    };
  },
};
