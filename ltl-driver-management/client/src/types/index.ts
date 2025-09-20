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
  phoneNumber?: string;
  email?: string;
  licenseNumber?: string;
  active: boolean;
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
  
  // Relations
  drivers?: CarrierDriver[];
  
  createdAt: string;
  updatedAt: string;
  _count?: {
    bookings: number;
    documents: number;
    preferredRoutes: number;
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
  
  // Rate confirmation tracking
  confirmationToken?: string;
  confirmationSentAt?: string;
  confirmationSentVia?: string;
  confirmationSignedAt?: string;
  confirmationSignedBy?: string;
  confirmationIpAddress?: string;
  confirmationSignature?: string;
  signedPdfPath?: string;
  
  createdAt: string;
  updatedAt: string;
  carrier?: Carrier;
  route?: Route;
  invoice?: Invoice;
  lineItems?: BookingLineItem[];
  childBookings?: Booking[];
  parentBooking?: Booking;
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