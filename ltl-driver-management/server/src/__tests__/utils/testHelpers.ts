/**
 * Test Helpers
 * Utility functions for creating test data
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

/**
 * Generate a test JWT token
 */
export function generateTestToken(userId: number, role: string = 'ADMIN'): string {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Create a mock user
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    password: '$2a$10$hashedpassword',
    role: 'ADMIN',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Create a mock carrier
 */
export function createMockCarrier(overrides: Partial<MockCarrier> = {}): MockCarrier {
  return {
    id: 1,
    carrierName: 'Test Carrier',
    mcNumber: 'MC123456',
    dotNumber: 'DOT789',
    vendorNumber: 'VEND001',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Create a mock booking
 */
export function createMockBooking(overrides: Partial<MockBooking> = {}): MockBooking {
  return {
    id: 1,
    bookingNumber: 'BK-2024-001',
    carrierId: 1,
    status: 'PENDING',
    originLocationId: 1,
    destinationLocationId: 2,
    pickupDate: new Date(),
    deliveryDate: new Date(),
    agreedRate: 500,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Create a mock invoice
 */
export function createMockInvoice(overrides: Partial<MockInvoice> = {}): MockInvoice {
  return {
    id: 1,
    invoiceNumber: 'INV-2024-001',
    bookingId: 1,
    amount: 500,
    status: 'PENDING',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Create a mock location
 */
export function createMockLocation(overrides: Partial<MockLocation> = {}): MockLocation {
  return {
    id: 1,
    code: 'LAX',
    name: 'Los Angeles Terminal',
    address: '123 Main St',
    city: 'Los Angeles',
    state: 'CA',
    zipCode: '90001',
    latitude: 34.0522,
    longitude: -118.2437,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Create mock equipment (truck)
 */
export function createMockTruck(overrides: Partial<MockTruck> = {}): MockTruck {
  return {
    id: 1,
    unitNumber: 'TRK001',
    vin: '1HGBH41JXMN109186',
    make: 'Freightliner',
    model: 'Cascadia',
    year: 2022,
    type: 'DAYCAB',
    status: 'AVAILABLE',
    currentLocationId: 1,
    carrierId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Create mock equipment (trailer)
 */
export function createMockTrailer(overrides: Partial<MockTrailer> = {}): MockTrailer {
  return {
    id: 1,
    unitNumber: 'TRL001',
    type: 'DRY_VAN',
    length: 53,
    status: 'AVAILABLE',
    currentLocationId: 1,
    carrierId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

// Type definitions for mocks
interface MockUser {
  id: number;
  email: string;
  name: string;
  password: string;
  role: string;
  active: boolean;
  homeLocationId?: number | null;
  ssoProvider?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockCarrier {
  id: number;
  carrierName: string;
  mcNumber: string | null;
  dotNumber: string | null;
  vendorNumber: string | null;
  active: boolean;
  status?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockBooking {
  id: number;
  bookingNumber: string;
  carrierId: number;
  status: string;
  originLocationId: number | null;
  destinationLocationId: number | null;
  pickupDate: Date | null;
  deliveryDate: Date | null;
  agreedRate: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockInvoice {
  id: number;
  invoiceNumber: string;
  bookingId: number;
  amount: number;
  status: string;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface MockLocation {
  id: number;
  code: string;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MockTruck {
  id: number;
  unitNumber: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  type: string;
  status: string;
  currentLocationId: number | null;
  carrierId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockTrailer {
  id: number;
  unitNumber: string;
  type: string;
  length: number | null;
  status: string;
  currentLocationId: number | null;
  carrierId: number | null;
  createdAt: Date;
  updatedAt: Date;
}
