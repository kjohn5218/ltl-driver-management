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

export type DriverStatus = 'AVAILABLE' | 'ON_DUTY' | 'DRIVING' | 'SLEEPER_BERTH' | 'OFF_DUTY' | 'PERSONAL_CONVEYANCE' | 'YARD_MOVE';

export interface CarrierDriver {
  id: number;
  carrierId: number;
  name: string;
  number?: string; // Driver number for dispatch
  phoneNumber?: string;
  email?: string;
  licenseNumber?: string;
  active: boolean;
  // Location assignment
  locationId?: number;
  // Dispatch-related fields
  driverStatus?: DriverStatus;
  endorsements?: string;
  hazmatEndorsement?: boolean;
  currentTerminalCode?: string;
  externalDriverId?: string;
  carrier?: {
    id: number;
    name: string;
    status: CarrierStatus;
  };
  location?: {
    id: number;
    code: string;
    name?: string;
    city?: string;
    state?: string;
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
  originTimeZone?: string;
  originLatitude?: number;
  originLongitude?: number;
  destinationAddress?: string;
  destinationCity?: string;
  destinationState?: string;
  destinationZipCode?: string;
  destinationContact?: string;
  destinationTimeZone?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  distance: number;
  runTime?: number; // Run time in minutes
  active: boolean;
  standardRate?: number;
  frequency?: string;
  departureTime?: string;
  arrivalTime?: string;
  headhaul: boolean;
  trailerLoad: boolean;
  interlineTrailer: boolean;
  interlineCarrierId?: number;
  interlineCarrier?: InterlineCarrier;
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
  isPhysicalTerminal: boolean;
  isVirtualTerminal: boolean;
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
export type TripStatus = 'PLANNED' | 'ASSIGNED' | 'DISPATCHED' | 'IN_TRANSIT' | 'ARRIVED' | 'UNLOADING' | 'COMPLETED' | 'CANCELLED';
export type EquipmentStatus = 'AVAILABLE' | 'DISPATCHED' | 'IN_TRANSIT' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
export type TruckType = 'DAY_CAB' | 'SLEEPER' | 'STRAIGHT_TRUCK';
export type TrailerType = 'DRY_VAN_53' | 'DRY_VAN_28' | 'PUP_TRAILER' | 'REEFER_53' | 'REEFER_28' | 'FLATBED' | 'STEP_DECK' | 'TANKER' | 'INTERMODAL';
export type DollyType = 'A_DOLLY' | 'B_DOLLY';
export type EquipmentConfig = 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'ROCKY_MOUNTAIN' | 'TURNPIKE';
export type PayPeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED' | 'EXPORTED';
export type TripPayStatus = 'PENDING' | 'CALCULATED' | 'REVIEWED' | 'APPROVED' | 'PAID' | 'DISPUTED';
export type RateCardType = 'DRIVER' | 'CARRIER' | 'LINEHAUL' | 'OD_PAIR' | 'DEFAULT';
export type RateMethod = 'PER_MILE' | 'FLAT_RATE' | 'HOURLY' | 'PERCENTAGE';
export type AccessorialType = 'LAYOVER' | 'DETENTION' | 'BREAKDOWN' | 'HELPER' | 'TRAINER' | 'HAZMAT' | 'TEAM_DRIVER' | 'STOP_CHARGE' | 'FUEL_SURCHARGE' | 'DROP_HOOK' | 'DROP_HOOK_SINGLE' | 'DROP_HOOK_DOUBLE_TRIPLE' | 'CHAIN_UP' | 'WAIT_TIME' | 'SINGLE_TRAILER' | 'DOUBLE_TRAILER' | 'TRIPLE_TRAILER' | 'CUT_PAY' | 'CUT_PAY_SINGLE_MILES' | 'CUT_PAY_DOUBLE_MILES' | 'CUT_PAY_TRIPLE_MILES' | 'OTHER';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type EquipmentType = 'TRUCK' | 'TRAILER' | 'DOLLY';
export type DelayType = 'WEATHER' | 'TRAFFIC' | 'BREAKDOWN' | 'DETENTION' | 'LOADING' | 'UNLOADING' | 'REST' | 'ACCIDENT' | 'CUSTOMS' | 'DISPATCH' | 'OTHER';

// Arrival and Driver Report Types
export type WaitTimeReason = 'LATE_MEET_DRIVER' | 'DOCK_DELAY' | 'BREAKDOWN';
export type EquipmentIssueType = 'TRAILER' | 'DOLLY';

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
  lastArrivalTerminal?: Terminal;
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
  pintleHook?: boolean;
  createdAt: string;
  updatedAt: string;
  currentTerminal?: Terminal;
  lastArrivalTerminal?: Terminal;
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
  lastArrivalTerminal?: Terminal;
  _count?: {
    linehaulTrips: number;
  };
}

// Interline Carrier
export interface InterlineCarrier {
  id: number;
  code: string;
  name: string;
  scacCode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    linehaulProfiles: number;
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
  headhaul: boolean;
  trailerLoad: boolean;
  interlineTrailer: boolean;
  interlineCarrierId?: number;
  frequency?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  originTerminal?: Terminal;
  destinationTerminal?: Terminal;
  interlineCarrier?: InterlineCarrier;
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
  estimatedArrival?: string;
  lastKnownLatitude?: number;
  lastKnownLongitude?: number;
  lastLocationUpdate?: string;
  status: TripStatus;
  driverId?: number;
  driverExternalId?: string;
  teamDriverId?: number;
  truckId?: number;
  trailerId?: number;
  trailer2Id?: number;
  trailer3Id?: number;
  dollyId?: number;
  dolly2Id?: number;
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
  trailer3?: EquipmentTrailer;
  dolly?: EquipmentDolly;
  dolly2?: EquipmentDolly;
  shipments?: TripShipment[];
  delays?: TripDelay[];
  tripPay?: TripPay;
  loadsheets?: {
    id: number;
    manifestNumber: string;
    linehaulName?: string;
    originTerminalCode?: string;
    destinationTerminalCode?: string;
  }[];
  // Linehaul name from first loadsheet (added by API transformation)
  linehaulName?: string;
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

// Driver Trip Report - stores driver-submitted arrival information for pay verification
export interface DriverTripReport {
  id: number;
  tripId: number;
  driverId?: number;
  dropAndHook?: number;
  chainUpCycles?: number;
  waitTimeStart?: string;
  waitTimeEnd?: string;
  waitTimeMinutes?: number;
  waitTimeReason?: WaitTimeReason;
  notes?: string;
  verified: boolean;
  verifiedBy?: number;
  verifiedAt?: string;
  payApproved: boolean;
  payApprovedBy?: number;
  payApprovedAt?: string;
  arrivedAt: string;
  createdAt: string;
  updatedAt: string;
  trip?: LinehaulTrip;
  driver?: CarrierDriver;
}

// Trip Arrival Data - used when submitting arrival details
export interface TripArrivalData {
  actualArrival?: string;  // ISO datetime string - when the trip actually arrived
  actualMileage?: number;  // Miles driven for this trip
  dropAndHook?: number;
  chainUpCycles?: number;
  waitTimeStart?: string;  // ISO datetime string
  waitTimeEnd?: string;    // ISO datetime string
  waitTimeReason?: WaitTimeReason;
  notes?: string;
  equipmentIssue?: {
    equipmentType: EquipmentIssueType;
    equipmentNumber: string;
    description: string;
  };
}

// Equipment Issue - tracks equipment issues reported by OWNOP drivers
export interface EquipmentIssue {
  id: number;
  tripId: number;
  driverId?: number;
  equipmentType: EquipmentIssueType;
  equipmentNumber: string;
  description: string;
  reportedAt: string;
  resolvedAt?: string;
  resolvedBy?: number;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
  trip?: LinehaulTrip;
  driver?: CarrierDriver;
}

// Driver Morale Rating - tracks driver morale ratings at arrival
export interface DriverMoraleRating {
  id: number;
  tripId: number;
  driverId: number;
  rating: number; // 1-5 star rating (1=Poor, 5=Very Good)
  arrivedAt: string;
  createdAt: string;
  trip?: LinehaulTrip;
  driver?: CarrierDriver;
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
  priority: boolean;
  externalRateId?: string;
  notes?: string;
  active: boolean;
  // Flattened pay rule fields
  autoArrive?: boolean;
  perTrip?: number;
  perCutTrip?: number;
  cutMiles?: number;
  cutMilesType?: string;
  perSingleMile?: number;
  perDoubleMile?: number;
  perTripleMile?: number;
  perWorkHour?: number;
  perStopHour?: number;
  perSingleDH?: number;
  perDoubleDH?: number;
  perTripleDH?: number;
  perChainUp?: number;
  fuelSurcharge?: number;
  // Timestamps and relations
  createdAt: string;
  updatedAt: string;
  originTerminal?: Terminal;
  destinationTerminal?: Terminal;
  linehaulProfile?: LinehaulProfile;
  accessorialRates?: AccessorialRate[];
  // Driver/Carrier info (populated by API for DRIVER/CARRIER rate types)
  driver?: { id: number; name: string; number?: string; workdayEmployeeId?: string | null; carrier?: { id: number; name: string } } | null;
  carrier?: { id: number; name: string } | null;
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

// ==================== LOADSHEET MODULE ====================

// Loadsheet Enums
export type LoadsheetStatus = 'DRAFT' | 'OPEN' | 'LOADING' | 'CLOSED' | 'DISPATCHED' | 'UNLOADED';
export type LoadType = 'PURE' | 'MIX';
export type ConditionStatus = 'OK' | 'REPAIR';
export type HazmatPlacardType = 'CORROSIVE' | 'FLAMMABLE' | 'OTHER' | 'DANGEROUS' | 'OXIDIZER';

// Loadsheet
export interface Loadsheet {
  id: number;
  manifestNumber: string;

  // Header
  trailerNumber: string;
  suggestedTrailerLength?: number;
  pintleHookRequired: boolean;
  targetDispatchTime?: string;
  scheduledDepartDate?: string;
  linehaulName: string;
  preloadManifest?: string;
  originTerminalId?: number;
  originTerminalCode?: string;
  destinationTerminalCode?: string;  // Destination for this leg (from route)
  routeId?: number;                   // Reference to specific route/leg
  linehaulTripId?: number;
  doNotLoadPlacardableHazmat?: boolean;
  doorNumber?: string;

  // Loading Info
  loadDate: string;
  straps?: number;
  closeTime?: string;
  loadType: LoadType;
  loadbars?: number;
  loaderNumber?: string;
  exceptions?: string;
  capacity?: string;
  blankets?: number;
  loaderName?: string;
  sealNumber?: string;
  pieces?: number;      // Total pieces loaded
  weight?: number;      // Total weight in lbs

  // Trailer Condition
  wallCondition: ConditionStatus;
  floorCondition: ConditionStatus;
  roofCondition: ConditionStatus;
  trailerConditionComment?: string;

  // HAZMAT Placards (JSON string array)
  hazmatPlacards?: string;

  // Status
  status: LoadsheetStatus;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
  printedAt?: string;
  lastScanAt?: string;

  // Relations
  originTerminal?: Terminal;
  linehaulTrip?: LinehaulTrip;
  hazmatItems?: LoadsheetHazmatItem[];
  dispatchEntries?: LoadsheetDispatchEntry[];
  freightPlacements?: LoadsheetFreightPlacement[];

  _count?: {
    hazmatItems: number;
    dispatchEntries: number;
  };
}

export interface LoadsheetHazmatItem {
  id: number;
  loadsheetId: number;
  itemNumber: number;  // 1-10 (HM1-HM10)
  proNumber?: string;
  hazmatClass?: string;
  weight?: number;
  createdAt?: string;
}

export interface LoadsheetDispatchEntry {
  id: number;
  loadsheetId: number;
  rowNumber: number;
  dispatchTime?: string;
  dispatchTerminal?: string;
  nextTerminal?: string;
  tractorNumber?: string;
  driverNumber?: string;
  driverName?: string;
  supervisorNumber?: string;
  createdAt?: string;
}

export interface LoadsheetFreightPlacement {
  id: number;
  loadsheetId: number;
  rowNumber: number;
  loose?: string;
  left?: string;
  right?: string;
  createdAt?: string;
}

// Loadsheet API Request/Response types
export interface LoadsheetsResponse {
  loadsheets: Loadsheet[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LoadsheetFilters {
  search?: string;
  status?: LoadsheetStatus;
  linehaulTripId?: number;
  originTerminalId?: number;
  originTerminalCode?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface CreateLoadsheetRequest {
  trailerNumber: string;
  linehaulName: string;
  suggestedTrailerLength?: number;
  pintleHookRequired?: boolean;
  targetDispatchTime?: string;
  scheduledDepartDate?: string;
  preloadManifest?: string;
  originTerminalId?: number;
  originTerminalCode?: string;
  linehaulTripId?: number;
  doNotLoadPlacardableHazmat?: boolean;
  doorNumber?: string;
  loadDate?: string;
  straps?: number;
  closeTime?: string;
  loadType?: LoadType;
  loadbars?: number;
  loaderNumber?: string;
  exceptions?: string;
  capacity?: string;
  blankets?: number;
  loaderName?: string;
  sealNumber?: string;
  pieces?: number;
  weight?: number;
  wallCondition?: ConditionStatus;
  floorCondition?: ConditionStatus;
  roofCondition?: ConditionStatus;
  trailerConditionComment?: string;
  hazmatPlacards?: HazmatPlacardType[];
  hazmatItems?: Omit<LoadsheetHazmatItem, 'id' | 'loadsheetId' | 'createdAt'>[];
  dispatchEntries?: Omit<LoadsheetDispatchEntry, 'id' | 'loadsheetId' | 'createdAt'>[];
  freightPlacements?: Omit<LoadsheetFreightPlacement, 'id' | 'loadsheetId' | 'createdAt'>[];
}

// Duplicate loadsheet check
export interface DuplicateLoadsheet {
  id: number;
  manifestNumber: string;
  trailerNumber: string;
  linehaulName: string;
  loadDate: string;
  status: LoadsheetStatus;
  originTerminalCode?: string;
}

export interface CheckDuplicateLoadsheetsRequest {
  trailerNumber: string;
  originTerminalCode: string;
}

export interface CheckDuplicateLoadsheetsResponse {
  hasDuplicates: boolean;
  duplicates: DuplicateLoadsheet[];
}

// ==================== TRIP DOCUMENT MODULE ====================

// Trip Document Enums
export type TripDocumentType = 'LINEHAUL_MANIFEST' | 'PLACARD_SHEET' | 'HAZMAT_BOL';
export type TripDocumentStatus = 'PENDING' | 'GENERATED' | 'ERROR';

// Trip Document
export interface TripDocument {
  id: number;
  tripId: number;
  documentType: TripDocumentType;
  documentNumber: string;
  status: TripDocumentStatus;
  generatedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  manifestData?: ManifestDocumentData;
  placardData?: PlacardSheetData;
}

// Manifest Document Data
export interface ManifestDocumentData {
  id: number;
  tripDocumentId: number;
  tripDisplay: string;
  manifestNumber: string;
  driverName?: string;
  trailerNumber?: string;
  originCode: string;
  destCode: string;
  effort?: string;
  timeDue?: string;
  lastLoad?: string;
  totalScans: number;
  totalPieces: number;
  totalWeight: number;
  dispatchedAt?: string;
  arrivedAt?: string;
  freightItems?: ManifestFreightItem[];
}

// Manifest Freight Item
export interface ManifestFreightItem {
  id: number;
  manifestDataId: number;
  proNumber: string;
  manifestNumber?: string;  // The loadsheet manifest number this shipment was scanned/loaded to
  destTerminal?: string;
  destTerminalSub?: string;
  scans: number;
  pieces: number;
  weight: number;
  consigneeName?: string;
  consigneeCity?: string;
  shipperName?: string;
  shipperCity?: string;
  expDeliveryDate?: string;
  loadedTerminal?: string;
  unloadedTerminal?: string;
  isHazmat: boolean;
  hazmatClass?: string;
  sortOrder: number;
}

// Placard Sheet Data
export interface PlacardSheetData {
  id: number;
  tripDocumentId: number;
  tripDisplay: string;
  trailerNumber?: string;
  hazmatItems?: PlacardHazmatItem[];
  requiredPlacards?: RequiredPlacard[];
}

// Placard Hazmat Item
export interface PlacardHazmatItem {
  id: number;
  placardDataId: number;
  proNumber: string;
  unNumber: string;
  hazardClass: string;
  packingGroup?: string;
  weight?: number;
  isBulk: boolean;
  isLimitedQty: boolean;
  shippingName: string;
  sortOrder: number;
}

// Required Placard
export interface RequiredPlacard {
  id: number;
  placardDataId: number;
  placardClass: string;
  placardLabel: string;
}

// Trip Documents Response
export interface TripDocumentsResponse {
  documents: TripDocument[];
  hasHazmat: boolean;
}

// ==================== UNIFIED PAYROLL ====================

export type PayrollSource = 'TRIP_PAY' | 'CUT_PAY';

export interface PayrollLineItem {
  id: string;
  source: PayrollSource;
  sourceId: number;
  driverId: number;
  driverName: string;
  driverNumber?: string;
  workdayEmployeeId?: string;
  date: string;
  origin?: string;
  destination?: string;
  tripNumber?: string;
  totalMiles?: number;
  basePay: number;
  mileagePay: number;
  dropAndHookPay: number;
  chainUpPay: number;
  waitTimePay: number;
  otherAccessorialPay: number;
  bonusPay: number;
  deductions: number;
  totalGrossPay: number;
  cutPayType?: string;
  cutPayHours?: number;
  cutPayMiles?: number;
  trailerConfig?: string;
  rateApplied?: number;
  reason?: string;
  status: string;
  notes?: string;
}

export interface PayrollFilters {
  startDate?: string;
  endDate?: string;
  locationId?: number;
  statuses?: string[];
  driverId?: number;
  search?: string;
  source?: 'trip' | 'cut' | 'all';
  page?: number;
  limit?: number;
}

export interface PayrollSummary {
  totalCount: number;
  unapprovedCount: number;
}

export interface UnifiedPayrollResponse {
  items: PayrollLineItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: PayrollSummary;
}

export interface PayrollLineItemUpdate {
  basePay?: number;
  mileagePay?: number;
  accessorialPay?: number;
  bonusPay?: number;
  deductions?: number;
  totalPay?: number;
  rateApplied?: number;
  notes?: string;
}

export interface PayrollExportOptions {
  startDate?: string;
  endDate?: string;
  onlyApproved?: boolean;
}

// ==================== EXPECTED SHIPMENTS MODULE ====================

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type ServiceLevel = 'STANDARD' | 'GUARANTEED' | 'EXPEDITED';
export type DataSource = 'TMS' | 'WMS' | 'MANUAL';

// Expected lane volume - aggregated shipment forecast by lane
export interface ExpectedLaneVolume {
  id?: number;
  externalId?: string;
  forecastDate: string;
  originTerminalCode: string;
  destinationTerminalCode: string;
  laneName?: string;

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
  estimatedTrailers?: number;
  trailerUtilization?: number;

  // Data source tracking
  dataSource?: DataSource;
  confidenceLevel?: ConfidenceLevel;
  lastSyncAt?: string;

  // Metadata
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Expected shipment detail - individual expected shipment
export interface ExpectedShipmentDetail {
  id?: number;
  expectedShipmentId?: number;
  externalProNumber?: string;
  forecastDate: string;
  originTerminalCode: string;
  destinationTerminalCode: string;

  // Shipment details
  pieces: number;
  weight: number;
  cube?: number;

  // Service and handling
  serviceLevel: ServiceLevel;
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
  estimatedPickupTime?: string;
  estimatedDeliveryTime?: string;
  appointmentRequired: boolean;

  // Tracking
  dataSource?: DataSource;
  externalStatus?: string;
  lastSyncAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Expected shipments response
export interface ExpectedShipmentsResponse {
  shipments: ExpectedLaneVolume[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Expected shipments summary
export interface ExpectedShipmentsSummary {
  totalShipments: number;
  totalPieces: number;
  totalWeight: number;
  totalTrailers: number;
  hazmatShipments: number;
  guaranteedShipments: number;
  laneCount: number;
}