/**
 * Jest test setup file
 * Configures mocks and test environment
 */

import { prismaMock } from './mocks/prisma.mock';

// Mock the prisma client
jest.mock('../index', () => ({
  prisma: prismaMock
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-12345';
process.env.COOKIE_SECRET = 'test-cookie-secret';

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  jest.resetAllMocks();
});
