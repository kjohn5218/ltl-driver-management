/**
 * Expected Shipments Mock Service
 *
 * This service simulates fetching anticipated shipment volume data from an external TMS system.
 * In production, this would be replaced with actual API calls to the TMS forecasting system.
 */

export interface ExpectedLaneVolume {
  originTerminalCode: string;
  destinationTerminalCode: string;
  laneName: string;
  forecastDate: Date;

  // Volume metrics
  expectedShipmentCount: number;
  expectedPieces: number;
  expectedWeight: number;
  expectedCube?: number;

  // Service breakdown
  guaranteedCount: number;
  standardCount: number;
  expeditedCount: number;

  // Special handling
  hazmatCount: number;
  highValueCount: number;
  oversizeCount: number;

  // Trailer planning
  estimatedTrailers: number;
  trailerUtilization: number;

  // Confidence
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ExpectedShipmentDetail {
  externalProNumber?: string;
  originTerminalCode: string;
  destinationTerminalCode: string;
  forecastDate: Date;

  // Shipment details
  pieces: number;
  weight: number;
  cube?: number;

  // Service and handling
  serviceLevel: 'STANDARD' | 'GUARANTEED' | 'EXPEDITED';
  isHazmat: boolean;
  hazmatClass?: string;
  isHighValue: boolean;
  isOversize: boolean;

  // Customer info
  shipperName?: string;
  shipperCity?: string;
  consigneeName?: string;
  consigneeCity?: string;

  // Planning
  estimatedPickupTime?: Date;
  estimatedDeliveryTime?: Date;
  appointmentRequired: boolean;

  // External status
  externalStatus?: string;
}

// Sample terminal pairs (lanes) for mock data
const sampleLanes = [
  { origin: 'DEN', destination: 'SLC', name: 'DEN-SLC' },
  { origin: 'DEN', destination: 'ABQ', name: 'DEN-ABQ' },
  { origin: 'DEN', destination: 'PHX', name: 'DEN-PHX' },
  { origin: 'DEN', destination: 'GJT', name: 'DEN-GJT' },
  { origin: 'SLC', destination: 'DEN', name: 'SLC-DEN' },
  { origin: 'ABQ', destination: 'DEN', name: 'ABQ-DEN' },
  { origin: 'ABQ', destination: 'ELP', name: 'ABQ-ELP' },
  { origin: 'PHX', destination: 'DEN', name: 'PHX-DEN' },
  { origin: 'PHX', destination: 'TUS', name: 'PHX-TUS' },
  { origin: 'GJT', destination: 'DEN', name: 'GJT-DEN' },
  { origin: 'LAX', destination: 'PHX', name: 'LAX-PHX' },
  { origin: 'DAL', destination: 'ABQ', name: 'DAL-ABQ' },
  { origin: 'ELP', destination: 'ABQ', name: 'ELP-ABQ' },
  { origin: 'TUS', destination: 'PHX', name: 'TUS-PHX' },
];

// Sample consignees for detail data
const sampleConsignees = [
  { name: 'Mountain States Supply', city: 'Denver', state: 'CO' },
  { name: 'Western Distribution Center', city: 'Salt Lake City', state: 'UT' },
  { name: 'Desert Freight Solutions', city: 'Phoenix', state: 'AZ' },
  { name: 'Southwest Logistics', city: 'Albuquerque', state: 'NM' },
  { name: 'Pacific Coast Warehouse', city: 'Los Angeles', state: 'CA' },
  { name: 'Heartland Distributors', city: 'Dallas', state: 'TX' },
  { name: 'Alpine Supply Co', city: 'Grand Junction', state: 'CO' },
  { name: 'Sonoran Products', city: 'Tucson', state: 'AZ' },
];

const sampleShippers = [
  { name: 'Global Manufacturing Inc', city: 'Chicago', state: 'IL' },
  { name: 'National Parts Warehouse', city: 'Memphis', state: 'TN' },
  { name: 'West Coast Suppliers', city: 'Seattle', state: 'WA' },
  { name: 'Midwest Industrial Supply', city: 'Kansas City', state: 'MO' },
  { name: 'Southern Distribution LLC', city: 'Atlanta', state: 'GA' },
  { name: 'East Coast Exports', city: 'Newark', state: 'NJ' },
  { name: 'Rocky Mountain Industries', city: 'Denver', state: 'CO' },
  { name: 'Southwest Components', city: 'El Paso', state: 'TX' },
];

// Generate a random PRO number prefix (simulates external system format)
const generateExternalProNumber = (): string => {
  const prefix = ['TMS', 'EXT', 'PRE'][Math.floor(Math.random() * 3)];
  const num = Math.floor(Math.random() * 90000000) + 10000000;
  return `${prefix}${num}`;
};

// Generate lane volume data
const generateLaneVolume = (
  lane: { origin: string; destination: string; name: string },
  forecastDate: Date
): ExpectedLaneVolume => {
  // Base shipment count with some variance
  const baseCount = Math.floor(Math.random() * 40) + 10; // 10-50 shipments

  // Service level distribution (typical: 70% standard, 20% guaranteed, 10% expedited)
  const guaranteedCount = Math.floor(baseCount * (Math.random() * 0.15 + 0.15)); // 15-30%
  const expeditedCount = Math.floor(baseCount * (Math.random() * 0.1 + 0.05)); // 5-15%
  const standardCount = baseCount - guaranteedCount - expeditedCount;

  // Special handling (small percentages)
  const hazmatCount = Math.floor(baseCount * (Math.random() * 0.05 + 0.02)); // 2-7%
  const highValueCount = Math.floor(baseCount * (Math.random() * 0.03 + 0.01)); // 1-4%
  const oversizeCount = Math.floor(baseCount * (Math.random() * 0.02)); // 0-2%

  // Calculate totals
  const avgPieces = Math.floor(Math.random() * 3) + 2; // 2-5 pieces per shipment
  const avgWeight = Math.floor(Math.random() * 800) + 200; // 200-1000 lbs per shipment
  const expectedPieces = baseCount * avgPieces;
  const expectedWeight = baseCount * avgWeight;
  const expectedCube = Math.floor(expectedWeight * 0.015); // Rough cube estimate

  // Trailer planning (assume ~20,000 lbs per trailer)
  const estimatedTrailers = parseFloat((expectedWeight / 20000).toFixed(1));
  const trailerUtilization = parseFloat((Math.random() * 30 + 60).toFixed(1)); // 60-90%

  // Confidence level based on forecast horizon
  const daysOut = Math.ceil((forecastDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const confidenceLevel = daysOut <= 1 ? 'HIGH' : daysOut <= 3 ? 'MEDIUM' : 'LOW';

  return {
    originTerminalCode: lane.origin,
    destinationTerminalCode: lane.destination,
    laneName: lane.name,
    forecastDate,
    expectedShipmentCount: baseCount,
    expectedPieces,
    expectedWeight,
    expectedCube,
    guaranteedCount,
    standardCount,
    expeditedCount,
    hazmatCount,
    highValueCount,
    oversizeCount,
    estimatedTrailers,
    trailerUtilization,
    confidenceLevel,
  };
};

// Generate individual shipment details
const generateShipmentDetails = (
  laneVolume: ExpectedLaneVolume,
  count: number
): ExpectedShipmentDetail[] => {
  const details: ExpectedShipmentDetail[] = [];

  for (let i = 0; i < count; i++) {
    const consignee = sampleConsignees[Math.floor(Math.random() * sampleConsignees.length)];
    const shipper = sampleShippers[Math.floor(Math.random() * sampleShippers.length)];

    // Determine service level
    const rand = Math.random();
    let serviceLevel: 'STANDARD' | 'GUARANTEED' | 'EXPEDITED';
    if (rand < 0.1) serviceLevel = 'EXPEDITED';
    else if (rand < 0.3) serviceLevel = 'GUARANTEED';
    else serviceLevel = 'STANDARD';

    // Random special handling flags
    const isHazmat = Math.random() < 0.05;
    const isHighValue = Math.random() < 0.03;
    const isOversize = Math.random() < 0.02;
    const appointmentRequired = serviceLevel === 'GUARANTEED' && Math.random() < 0.3;

    // Generate pickup/delivery times
    const pickupDate = new Date(laneVolume.forecastDate);
    pickupDate.setHours(6 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));

    const deliveryDate = new Date(pickupDate);
    deliveryDate.setDate(deliveryDate.getDate() + 1 + Math.floor(Math.random() * 3));
    deliveryDate.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));

    details.push({
      externalProNumber: Math.random() < 0.7 ? generateExternalProNumber() : undefined,
      originTerminalCode: laneVolume.originTerminalCode,
      destinationTerminalCode: laneVolume.destinationTerminalCode,
      forecastDate: laneVolume.forecastDate,
      pieces: Math.floor(Math.random() * 5) + 1,
      weight: Math.floor(Math.random() * 1500) + 100,
      cube: Math.random() < 0.5 ? parseFloat((Math.random() * 50 + 5).toFixed(2)) : undefined,
      serviceLevel,
      isHazmat,
      hazmatClass: isHazmat ? ['3', '8', '9', '2.1'][Math.floor(Math.random() * 4)] : undefined,
      isHighValue,
      isOversize,
      shipperName: shipper.name,
      shipperCity: shipper.city,
      consigneeName: consignee.name,
      consigneeCity: consignee.city,
      estimatedPickupTime: pickupDate,
      estimatedDeliveryTime: deliveryDate,
      appointmentRequired,
      externalStatus: ['BOOKED', 'CONFIRMED', 'PENDING_PICKUP'][Math.floor(Math.random() * 3)],
    });
  }

  return details;
};

/**
 * Expected Shipments Mock Service
 */
export const expectedShipmentsMockService = {
  /**
   * Get expected lane volumes for a date range
   */
  getLaneVolumes: async (
    startDate: Date,
    endDate: Date,
    originTerminalCode?: string,
    destinationTerminalCode?: string
  ): Promise<ExpectedLaneVolume[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 150));

    const volumes: ExpectedLaneVolume[] = [];

    // Filter lanes if specific terminals requested
    let filteredLanes = sampleLanes;
    if (originTerminalCode) {
      filteredLanes = filteredLanes.filter(l => l.origin === originTerminalCode);
    }
    if (destinationTerminalCode) {
      filteredLanes = filteredLanes.filter(l => l.destination === destinationTerminalCode);
    }

    // Generate data for each day in range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      for (const lane of filteredLanes) {
        volumes.push(generateLaneVolume(lane, new Date(currentDate)));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return volumes;
  },

  /**
   * Get expected lane volumes aggregated (totals across dates)
   */
  getLaneVolumesAggregated: async (
    startDate: Date,
    endDate: Date,
    originTerminalCode?: string
  ): Promise<ExpectedLaneVolume[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 150));

    // Filter lanes by origin if specified
    let filteredLanes = sampleLanes;
    if (originTerminalCode) {
      filteredLanes = filteredLanes.filter(l => l.origin === originTerminalCode);
    }

    // Generate aggregated data per lane
    return filteredLanes.map(lane => {
      const baseVolume = generateLaneVolume(lane, startDate);

      // Calculate days in range and multiply counts
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const multiplier = days > 1 ? days * 0.85 : 1; // Slightly reduce for aggregation

      return {
        ...baseVolume,
        expectedShipmentCount: Math.floor(baseVolume.expectedShipmentCount * multiplier),
        expectedPieces: Math.floor(baseVolume.expectedPieces * multiplier),
        expectedWeight: Math.floor(baseVolume.expectedWeight * multiplier),
        expectedCube: baseVolume.expectedCube ? Math.floor(baseVolume.expectedCube * multiplier) : undefined,
        guaranteedCount: Math.floor(baseVolume.guaranteedCount * multiplier),
        standardCount: Math.floor(baseVolume.standardCount * multiplier),
        expeditedCount: Math.floor(baseVolume.expeditedCount * multiplier),
        hazmatCount: Math.floor(baseVolume.hazmatCount * multiplier),
        highValueCount: Math.floor(baseVolume.highValueCount * multiplier),
        oversizeCount: Math.floor(baseVolume.oversizeCount * multiplier),
        estimatedTrailers: parseFloat((baseVolume.estimatedTrailers * multiplier).toFixed(1)),
      };
    });
  },

  /**
   * Get detailed expected shipments for a lane
   */
  getLaneShipmentDetails: async (
    originTerminalCode: string,
    destinationTerminalCode: string,
    forecastDate: Date
  ): Promise<ExpectedShipmentDetail[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const lane = sampleLanes.find(
      l => l.origin === originTerminalCode && l.destination === destinationTerminalCode
    );

    if (!lane) {
      return [];
    }

    const volume = generateLaneVolume(lane, forecastDate);
    return generateShipmentDetails(volume, volume.expectedShipmentCount);
  },

  /**
   * Get summary statistics for all lanes on a date
   */
  getDailySummary: async (forecastDate: Date): Promise<{
    totalShipments: number;
    totalPieces: number;
    totalWeight: number;
    totalTrailers: number;
    hazmatShipments: number;
    guaranteedShipments: number;
    laneCount: number;
  }> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const volumes = sampleLanes.map(lane => generateLaneVolume(lane, forecastDate));

    return {
      totalShipments: volumes.reduce((sum, v) => sum + v.expectedShipmentCount, 0),
      totalPieces: volumes.reduce((sum, v) => sum + v.expectedPieces, 0),
      totalWeight: volumes.reduce((sum, v) => sum + v.expectedWeight, 0),
      totalTrailers: parseFloat(volumes.reduce((sum, v) => sum + v.estimatedTrailers, 0).toFixed(1)),
      hazmatShipments: volumes.reduce((sum, v) => sum + v.hazmatCount, 0),
      guaranteedShipments: volumes.reduce((sum, v) => sum + v.guaranteedCount, 0),
      laneCount: volumes.length,
    };
  },

  /**
   * Sync expected shipments from TMS (would be called by a scheduled job)
   */
  syncFromTMS: async (): Promise<{ synced: number; errors: number }> => {
    // Simulate API delay for sync operation
    await new Promise(resolve => setTimeout(resolve, 500));

    // In production, this would call the external TMS API
    // and upsert records into the expected_shipments table
    return {
      synced: Math.floor(Math.random() * 50) + 100,
      errors: Math.floor(Math.random() * 5),
    };
  },
};
