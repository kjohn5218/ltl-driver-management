// KPI Dashboard Types
export interface KPIMetric {
  currentWeek: number | null;
  lastWeek: number | null;
  weekVariance: number | null;
  ytd: number | null;
  ytdVariance: number | null;
}

export interface KPIDashboardData {
  dateRange: {
    currentWeekStart: string;
    currentWeekEnd: string;
    lastWeekStart: string;
    lastWeekEnd: string;
    ytdStart: string;
    ytdEnd: string;
  };
  metrics: {
    totalMiles: KPIMetric;
    totalCost: KPIMetric;
    costPerMile: KPIMetric;
    headhaulLoadFactor: KPIMetric;
    backhaulLoadFactor: KPIMetric;
    overallLoadFactor: KPIMetric;
    linehaulOnTime: KPIMetric;
    avgOutboundDelay: KPIMetric;
  };
}

// CCFS vs Contract Monthly Report Types
export interface MonthlyCostData {
  month: string; // YYYY-MM
  monthLabel: string; // "Jan 2025"
  ccfsCost: number;
  contractPowerCost: number;
  totalCost: number;
  contractPowerPercent: number;
  ccfsMiles: number;
  contractPowerMiles: number;
  totalMiles: number;
  contractPowerMilesPercent: number;
}

export interface CCFSContractReportData {
  summary: {
    totalCost: number;
    ccfsCost: number;
    contractPowerCost: number;
    contractPowerPercent: number;
    totalMiles: number;
    ccfsMiles: number;
    contractPowerMiles: number;
    contractPowerMilesPercent: number;
  };
  monthly: MonthlyCostData[];
}

// Cost Per Mile Analysis Types
export interface LaneCPM {
  lane: string; // e.g., "ABQDEN"
  originCode: string;
  destinationCode: string;
  totalCost: number;
  laborCost: number;
  equipmentCost: number;
  fuelCost: number;
  miles: number;
  trips: number;
  cpm: number;
  priorMonthCPM: number | null;
  costVariance: number | null;
  milesVariance: number | null;
}

export interface EmployerCPM {
  employer: string;
  totalCost: number;
  laborCost: number;
  equipmentCost: number;
  fuelCost: number;
  totalMiles: number;
  trips: number;
  cpm: number;
  priorMonthCPM: number | null;
  costVariance: number | null;
}

export interface CostPerMileData {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  gauges: {
    lhCostPerMile: number;
    ccfsCostPerMile: number;
    contractedCostPerMile: number;
  };
  summary: {
    totalMiles: number;
    totalCost: number;
    contractPowerCost: number;
    contractPowerMileage: number;
    contractPowerCostPercent: number;
    contractPowerMileagePercent: number;
  };
  byLane: LaneCPM[];
  byEmployer: EmployerCPM[];
}

// Enhanced Load Factor Types
export interface LaneLoadFactor {
  lane: string;
  originCode: string;
  destinationCode: string;
  weight: number;
  capacity: number;
  loadFactorPercent: number;
  wowVariance: number | null;
  momVariance: number | null;
  yoyVariance: number | null;
}

export interface TerminalLoadFactor {
  terminal: string;
  terminalName: string;
  weight: number;
  capacity: number;
  loadFactorPercent: number;
  wowVariance: number | null;
  momVariance: number | null;
  yoyVariance: number | null;
  lanes: LaneLoadFactor[];
}

export interface EnhancedLoadFactorData {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  gauges: {
    overall: number;
    headhaul: number;
    backhaul: number;
  };
  headhaulByTerminal: TerminalLoadFactor[];
  backhaulByTerminal: TerminalLoadFactor[];
}

// Filter Types
export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  terminalIds?: number[];
  week?: string; // ISO week format
  year?: number;
}
