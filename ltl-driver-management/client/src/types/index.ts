export type UserRole = 'ADMIN' | 'DISPATCHER' | 'USER' | 'CARRIER';
export type CarrierStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'NOT_ONBOARDED' | 'ONBOARDED';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type InvoiceStatus = 'PENDING' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type RateType = 'MILE' | 'MILE_FSC' | 'FLAT_RATE';
export type BookingType = 'POWER_ONLY' | 'POWER_AND_TRAILER';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface CarrierDriver {
  id: number;
  carrierId: number;
  name: string;
  number?: string; // Driver number for dispatch
  phoneNumber?: string;
  email?: string;
  licenseNumber?: string;
  active: boolean;
  carrier?: {
    id: number;
    name: string;
    status: CarrierStatus;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Carrier {
  id: number;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  mcNumber?: string;
  dotNumber?: string;
  insuranceExpiration?: string;
  status: CarrierStatus;
  rating?: number;
  ratePerMile?: number;
  onboardingComplete: boolean;
  
  // Additional fields from Excel import
  safetyRating?: string;
  taxId?: string;
  carrierType?: string;
  streetAddress1?: string;
  streetAddress2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  remittanceContact?: string;
  remittanceEmail?: string;
  factoringCompany?: string;
  
  // MyCarrierPackets (MCP) fields
  mcpMonitored: boolean;
  mcpLastSync?: string;
  mcpPacketCompleted: boolean;
  mcpPacketCompletedAt?: string;
  mcpInsuranceExpiration?: string;
  mcpAuthorityStatus?: string;
  mcpSafetyRating?: string;
  mcpRiskScore?: number;
  
  // Carrier type flags
  isCommonCarrier?: boolean;
  isContractCarrier?: boolean;
  isBroker?: boolean;
  
  // Equipment counts
  truckCount?: number;
  trailerCount?: number;
  driverCount?: number;
  
  // MCP assessment statuses
  mcpInsuranceStatus?: string;
  mcpOperationsStatus?: string;
  mcpSafetyStatus?: string;
  mcpPacketStatus?: string;
  mcpTotalPoints?: number;
  
  // Insurance details
  generalLiabilityExpiration?: string;
  generalLiabilityCoverage?: number;
  cargoLiabilityExpiration?: string;
  cargoLiabilityCoverage?: number;
  autoLiabilityExpiration?: string;
  autoLiabilityCoverage?: number;
  
  // Relations
  drivers?: CarrierDriver[];
  documents?: CarrierDocument[];
  
  createdAt: string;
  updatedAt: string;
  _count?: {
    bookings: number;
    documents: number;
    preferredRoutes: number;
    drivers?: number;
  };
}

export interface Route {
  id: number;
  name: string;
  origin: string;
  destination: string;
  originAddress?: string;
  originCity?: string;
  originState?: string;
  originZipCode?: string;
  originContact?: string;
  destinationAddress?: string;
  destinationCity?: string;
  destinationState?: string;
  destinationZipCode?: string;
  destinationContact?: string;
  distance: number;
  runTime?: number; // Run time in minutes
  active: boolean;
  standardRate?: number;
  frequency?: string;
  departureTime?: string;
  arrivalTime?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    bookings: number;
    preferredBy: number;
  };
}

export interface BookingLineItem {
  id: number;
  bookingId: number;
  category: string;
  description: string;
  amount: number;
  quantity: number;
  unitPrice?: number;
  ccfsUnitNumber?: string;
  receiptPath?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: number;
  creator?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface Booking {
  id: number;
  carrierId: number | null;
  routeId: number | null;
  bookingDate: string;
  rate: number;
  status: BookingStatus;
  billable: boolean;
  notes?: string;
  driverName?: string;
  phoneNumber?: string;
  carrierEmail?: string;
  carrierReportTime?: string;
  type: BookingType;
  trailerLength?: number;
  
  // Document uploads
  uploadedDocuments?: Array<{
    id: number;
    filename: string;
    documentType: string;
    filePath?: string;
    uploadedAt: string;
    uploadedBy?: string;
  }>;
  
  // Multi-leg booking fields
  parentBookingId?: number;
  legNumber?: number;
  isParent?: boolean;
  bookingGroupId?: string;
  
  // Rate calculation fields
  rateType: RateType;
  baseRate?: number;
  fscRate?: number;
  
  // Origin-destination booking fields
  origin?: string;
  destination?: string;
  estimatedMiles?: number;
  manifestNumber?: string;
  
  // Route information fields for custom bookings
  routeName?: string;
  routeFrequency?: string;
  routeStandardRate?: number;
  routeRunTime?: number;
  
  // Origin details
  originAddress?: string;
  originCity?: string;
  originState?: string;
  originZipCode?: string;
  originContact?: string;
  originTimeZone?: string;
  originLatitude?: number;
  originLongitude?: number;
  
  // Destination details
  destinationAddress?: string;
  destinationCity?: string;
  destinationState?: string;
  destinationZipCode?: string;
  destinationContact?: string;
  destinationTimeZone?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  
  // Time fields
  departureTime?: string;
  arrivalTime?: string;
  
  // Multi-leg time arrays
  legDepartureTimes?: string; // JSON array: ["18:00", "02:30"]
  legArrivalTimes?: string;   // JSON array: ["04:45", "11:15"]
  
  // Rate confirmation tracking
  confirmationToken?: string;
  confirmationSentAt?: string;
  confirmationSentVia?: string;
  confirmationSignedAt?: string;
  confirmationSignedBy?: string;
  confirmationIpAddress?: string;
  confirmationSignature?: string;
  signedPdfPath?: string;
  
  // Document tracking
  hasUploadedDocuments?: boolean;
  documentUploadToken?: string;
  documentUploadTokenCreatedAt?: string;
  
  createdAt: string;
  updatedAt: string;
  carrier?: Carrier;
  route?: Route;
  invoice?: Invoice;
  lineItems?: BookingLineItem[];
  childBookings?: Booking[];
  parentBooking?: Booking;
  documents?: BookingDocument[];
}

export interface Invoice {
  id: number;
  bookingId: number;
  invoiceNumber: string;
  amount: number;
  status: InvoiceStatus;
  createdAt: string;
  paidAt?: string;
  booking?: Booking;
}

export interface CarrierDocument {
  id: number;
  carrierId: number;
  documentType: string;
  filename: string;
  filePath: string;
  uploadedAt: string;
}

export interface BookingDocument {
  id: number;
  bookingId: number;
  documentType: string;
  filename: string;
  filePath: string;
  uploadedAt: string;
  legNumber?: number;
  notes?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface Location {
  id: number;
  code: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  contact?: string;
  phone?: string;
  hours?: string;
  timeZone?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ==================== DISPATCH & FLEET MANAGEMENT ====================

// Enums
export type TripStatus = 'PLANNED' | 'ASSIGNED' | 'DISPATCHED' | 'IN_TRANSIT' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED';
export type EquipmentStatus = 'AVAILABLE' | 'DISPATCHED' | 'IN_TRANSIT' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
export type TruckType = 'DAY_CAB' | 'SLEEPER' | 'STRAIGHT_TRUCK';
export type TrailerType = 'DRY_VAN_53' | 'DRY_VAN_28' | 'PUP_TRAILER' | 'REEFER_53' | 'REEFER_28' | 'FLATBED' | 'STEP_DECK' | 'TANKER' | 'INTERMODAL';
export type DollyType = 'A_DOLLY' | 'B_DOLLY';
export type EquipmentConfig = 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'ROCKY_MOUNTAIN' | 'TURNPIKE';
export type PayPeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED' | 'EXPORTED';
export type TripPayStatus = 'PENDING' | 'CALCULATED' | 'REVIEWED' | 'APPROVED' | 'PAID' | 'DISPUTED';
export type RateCardType = 'DRIVER' | 'CARRIER' | 'LINEHAUL' | 'OD_PAIR' | 'DEFAULT';
export type RateMethod = 'PER_MILE' | 'FLAT_RATE' | 'HOURLY' | 'PERCENTAGE';
export type AccessorialType = 'LAYOVER' | 'DETENTION' | 'BREAKDOWN' | 'HELPER' | 'TRAINER' | 'HAZMAT' | 'TEAM_DRIVER' | 'STOP_CHARGE' | 'FUEL_SURCHARGE' | 'OTHER';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type EquipmentType = 'TRUCK' | 'TRAILER' | 'DOLLY';
export type DelayType = 'WEATHER' | 'TRAFFIC' | 'BREAKDOWN' | 'DETENTION' | 'LOADING' | 'UNLOADING' | 'REST' | 'ACCIDENT' | 'CUSTOMS' | 'DISPATCH' | 'OTHER';

// Terminal
export interface Terminal {
  id: number;
  code: string;
  name: string;
  address?: string;
  city: string;
  state: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  equipmentRequirements?: TerminalEquipmentRequirement[];
  _count?: {
    trucks: number;
    trailers: number;
    dollies: number;
    linehaulProfilesOrigin: number;
    linehaulProfilesDestination: number;
  };
}

export interface TerminalEquipmentRequirement {
  id: number;
  terminalId: number;
  equipmentType: string;
  minCount: number;
  maxCount?: number;
  dayOfWeek?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Equipment
export interface EquipmentTruck {
  id: number;
  unitNumber: string;
  truckType: TruckType;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  currentTerminalId?: number;
  status: EquipmentStatus;
  assignedDriverId?: number;
  lastLocationUpdate?: string;
  maintenanceStatus?: string;
  maintenanceNotes?: string;
  nextMaintenanceDate?: string;
  externalFleetId?: string;
  owned?: boolean;
  leaseExpiration?: string;
  licensePlate?: string;
  licensePlateState?: string;
  fuelType?: string;
  createdAt: string;
  updatedAt: string;
  currentTerminal?: Terminal;
  assignedDriver?: CarrierDriver;
  _count?: {
    linehaulTrips: number;
  };
}

export interface EquipmentTrailer {
  id: number;
  unitNumber: string;
  trailerType: TrailerType;
  lengthFeet?: number;
  capacityWeight?: number;
  capacityCube?: number;
  currentTerminalId?: number;
  status: EquipmentStatus;
  currentLocation?: string;
  externalFleetId?: string;
  owned?: boolean;
  leaseExpiration?: string;
  licensePlate?: string;
  licensePlateState?: string;
  lastInspectionDate?: string;
  nextInspectionDate?: string;
  maintenanceStatus?: string;
  maintenanceNotes?: string;
  createdAt: string;
  updatedAt: string;
  currentTerminal?: Terminal;
  _count?: {
    primaryTrips: number;
    secondaryTrips: number;
  };
}

export interface EquipmentDolly {
  id: number;
  unitNumber: string;
  dollyType: DollyType;
  currentTerminalId?: number;
  status: EquipmentStatus;
  externalFleetId?: string;
  lastInspectionDate?: string;
  nextInspectionDate?: string;
  maintenanceStatus?: string;
  maintenanceNotes?: string;
  createdAt: string;
  updatedAt: string;
  currentTerminal?: Terminal;
  _count?: {
    linehaulTrips: number;
  };
}

// Linehaul Profile
export interface LinehaulProfile {
  id: number;
  profileCode: string;
  name: string;
  originTerminalId: number;
  destinationTerminalId: number;
  origin?: string;  // For display when mapped from Route
  destination?: string;  // For display when mapped from Route
  standardDepartureTime?: string;
  standardArrivalTime?: string;
  distanceMiles?: number;
  transitTimeMinutes?: number;
  equipmentConfig: EquipmentConfig;
  requiresTeamDriver: boolean;
  hazmatRequired: boolean;
  frequency?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  originTerminal?: Terminal;
  destinationTerminal?: Terminal;
  _count?: {
    linehaulTrips: number;
    rateCards: number;
  };
}

// Linehaul Trip
export interface LinehaulTrip {
  id: number;
  tripNumber: string;
  linehaulProfileId?: number;
  dispatchDate: string;
  plannedDeparture?: string;
  actualDeparture?: string;
  plannedArrival?: string;
  actualArrival?: string;
  status: TripStatus;
  driverId?: number;
  driverExternalId?: string;
  teamDriverId?: number;
  truckId?: number;
  trailerId?: number;
  trailer2Id?: number;
  dollyId?: number;
  actualMileage?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  linehaulProfile?: LinehaulProfile;
  driver?: CarrierDriver;
  teamDriver?: CarrierDriver;
  truck?: EquipmentTruck;
  trailer?: EquipmentTrailer;
  trailer2?: EquipmentTrailer;
  dolly?: EquipmentDolly;
  shipments?: TripShipment[];
  delays?: TripDelay[];
  tripPay?: TripPay;
  _count?: {
    shipments: number;
    delays: number;
  };
}

// Trip Shipment
export interface TripShipment {
  id: number;
  tripId: number;
  proNumber: string;
  origin?: string;
  destination?: string;
  weight?: number;
  pieces?: number;
  commodity?: string;
  deliveryNotes?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Trip Delay
export interface TripDelay {
  id: number;
  tripId: number;
  delayType: DelayType;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  location?: string;
  description?: string;
  billable: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Rate Card
export interface RateCard {
  id: number;
  rateType: RateCardType;
  entityId?: number;
  originTerminalId?: number;
  destinationTerminalId?: number;
  linehaulProfileId?: number;
  rateMethod: RateMethod;
  rateAmount: number;
  minimumAmount?: number;
  maximumAmount?: number;
  effectiveDate: string;
  expirationDate?: string;
  equipmentType?: string;
  priority: number;
  externalRateId?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  originTerminal?: Terminal;
  destinationTerminal?: Terminal;
  linehaulProfile?: LinehaulProfile;
  accessorialRates?: AccessorialRate[];
  _count?: {
    accessorialRates: number;
    tripPays: number;
  };
}

export interface AccessorialRate {
  id: number;
  rateCardId: number;
  accessorialType: AccessorialType;
  rateAmount: number;
  rateMethod: RateMethod;
  minimumCharge?: number;
  maximumCharge?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// Pay Period
export interface PayPeriod {
  id: number;
  periodStart: string;
  periodEnd: string;
  status: PayPeriodStatus;
  closedAt?: string;
  closedBy?: number;
  exportedAt?: string;
  exportedBy?: number;
  exportBatchId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  tripPays?: TripPay[];
  _count?: {
    tripPays: number;
  };
}

// Trip Pay
export interface TripPay {
  id: number;
  tripId: number;
  payPeriodId?: number;
  driverId?: number;
  driverExternalId?: string;
  rateCardId?: number;
  basePay?: number;
  mileagePay?: number;
  accessorialPay?: number;
  bonusPay?: number;
  deductions?: number;
  totalGrossPay?: number;
  splitPercentage?: number;
  splitType?: string;
  status: TripPayStatus;
  calculatedAt?: string;
  reviewedBy?: number;
  reviewedAt?: string;
  approvedBy?: number;
  approvedAt?: string;
  paidAt?: string;
  externalPayrollId?: string;
  exportedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  trip?: LinehaulTrip;
  payPeriod?: PayPeriod;
  driver?: CarrierDriver;
  rateCard?: RateCard;
}

// API Response types for dispatch module
export interface TripsResponse {
  trips: LinehaulTrip[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface EquipmentResponse<T> {
  trucks?: T[];
  trailers?: T[];
  dollies?: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PayPeriodsResponse {
  payPeriods: PayPeriod[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TripPaysResponse {
  tripPays: TripPay[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RateCardsResponse {
  rateCards: RateCard[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==================== MANIFEST & DISPATCH OPERATIONS ====================

// Theme
export type ThemeMode = 'light' | 'dark';

// Manifest Status
export type ManifestStatus = 'OPEN' | 'CLOSED' | 'IN_TRANSIT' | 'DELIVERED';

// Manifest
export interface Manifest {
  id: number;
  manifestNumber: string;
  tripId?: number;
  originTerminalId: number;
  destinationTerminalId: number;
  status: ManifestStatus;
  sealNumber?: string;
  createdAt: string;
  updatedAt: string;
  originTerminal?: Terminal;
  destinationTerminal?: Terminal;
  trip?: LinehaulTrip;
  shipments?: ManifestShipment[];
  _count?: {
    shipments: number;
  };
}

export interface ManifestShipment {
  id: number;
  manifestId: number;
  proNumber: string;
  consignee: string;
  location?: string;
  loadedCount: number;
  totalCount: number;
  hazmat: boolean;
  weight?: number;
  pieces?: number;
  specialInstructions?: string;
  createdAt: string;
  updatedAt: string;
}

// Dispatch Operations
export interface DispatchTripRequest {
  driverId: number;
  manifestId?: number;
  dollyId?: number;
  sealNumber?: string;
  originTerminalId: number;
  destinationTerminalId: number;
  isOwnerOperator: boolean;
  powerUnitId: number;
  trailerId?: number;
  notes?: string;
}

export interface ArriveTripData {
  id: number;
  tripNumber: string;
  driverName: string;
  manifests: string[];
  powerUnit: string;
  trailers: string[];
  converterDollies: string[];
  tripType: 'Linehaul' | 'Regional';
  status: TripStatus;
  plannedArrival?: string;
}

export interface DispatchBoardStats {
  averageMilageLate: number;
  headHaulLoadFactor: number;
  totalLoads: number;
  outboundLoads: number;
  inboundLoads: number;
}

// Transfer Scans
export interface TransferShipmentRequest {
  shipmentIds: number[];
  targetManifestId?: number;
  newManifestNumber?: string;
  originTerminalId?: number;
  destinationTerminalId?: number;
}

// Hazmat BOL
export interface HazmatBOLRequest {
  manifestNumber?: string;
  proNumber?: string;
  terminalId: number;
  printerId?: string;
}

// API Response types for manifests
export interface ManifestsResponse {
  manifests: Manifest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}