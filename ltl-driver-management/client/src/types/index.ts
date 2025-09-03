export type UserRole = 'ADMIN' | 'DISPATCHER' | 'USER' | 'CARRIER';
export type CarrierStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type InvoiceStatus = 'PENDING' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
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
  distance: number;
  standardRate: number;
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

export interface Booking {
  id: number;
  carrierId: number;
  routeId: number;
  bookingDate: string;
  rate: number;
  status: BookingStatus;
  billable: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  carrier?: Carrier;
  route?: Route;
  invoice?: Invoice;
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

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}