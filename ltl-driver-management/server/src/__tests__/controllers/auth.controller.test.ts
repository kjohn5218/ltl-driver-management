/**
 * Authentication Controller Tests
 */

import { Request, Response } from 'express';
import { prismaMock } from '../mocks/prisma.mock';
import { register, login, getProfile } from '../../controllers/auth.controller';
import { createMockUser } from '../utils/testHelpers';
import * as passwordUtils from '../../utils/password.utils';
import * as jwtUtils from '../../utils/jwt.utils';

// Mock the password and jwt utils
jest.mock('../../utils/password.utils');
jest.mock('../../utils/jwt.utils');

const mockPasswordUtils = passwordUtils as jest.Mocked<typeof passwordUtils>;
const mockJwtUtils = jwtUtils as jest.Mocked<typeof jwtUtils>;

describe('Auth Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn();
    responseStatus = jest.fn().mockReturnThis();

    mockReq = {
      body: {},
      user: undefined
    };

    mockRes = {
      json: responseJson,
      status: responseStatus
    };
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
        role: 'DISPATCHER'
      };

      mockReq.body = newUser;

      // User doesn't exist
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Hash password
      mockPasswordUtils.hashPassword.mockResolvedValue('hashedpassword');

      // Create user
      const createdUser = {
        id: 1,
        email: newUser.email,
        name: newUser.name,
        role: 'DISPATCHER' as const,
        createdAt: new Date()
      };
      prismaMock.user.create.mockResolvedValue(createdUser as any);

      // Generate token
      mockJwtUtils.generateToken.mockReturnValue('test-token');

      await register(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User created successfully',
          user: expect.objectContaining({
            email: newUser.email
          }),
          token: 'test-token'
        })
      );
    });

    it('should return 409 if user already exists', async () => {
      mockReq.body = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User'
      };

      // User already exists
      prismaMock.user.findUnique.mockResolvedValue(createMockUser() as any);

      await register(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(409);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'User already exists'
      });
    });

    it('should handle registration errors', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      prismaMock.user.findUnique.mockRejectedValue(new Error('Database error'));

      await register(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Failed to create user'
      });
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      mockReq.body = credentials;

      const mockUser = createMockUser({
        email: credentials.email,
        password: 'hashedpassword',
        homeLocationId: 1
      });

      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        homeLocation: {
          id: 1,
          code: 'LAX',
          name: 'Los Angeles',
          city: 'Los Angeles',
          state: 'CA'
        }
      } as any);

      mockPasswordUtils.verifyPassword.mockResolvedValue(true);
      mockJwtUtils.generateToken.mockReturnValue('login-token');

      await login(mockReq as Request, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Login successful',
          token: 'login-token',
          user: expect.objectContaining({
            email: credentials.email
          })
        })
      );
    });

    it('should return 401 for non-existent user', async () => {
      mockReq.body = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      prismaMock.user.findUnique.mockResolvedValue(null);

      await login(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Invalid credentials'
      });
    });

    it('should return 401 for invalid password', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      prismaMock.user.findUnique.mockResolvedValue(createMockUser() as any);
      mockPasswordUtils.verifyPassword.mockResolvedValue(false);

      await login(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Invalid credentials'
      });
    });

    it('should return 401 for SSO-only users', async () => {
      mockReq.body = {
        email: 'sso@example.com',
        password: 'password123'
      };

      const ssoUser = createMockUser({
        email: 'sso@example.com',
        password: '',
        ssoProvider: 'AZURE_AD'
      } as any);

      prismaMock.user.findUnique.mockResolvedValue(ssoUser as any);

      await login(mockReq as Request, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          ssoOnly: true,
          ssoProvider: 'AZURE_AD'
        })
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile when authenticated', async () => {
      const mockUser = createMockUser();
      (mockReq as any).user = mockUser;

      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        homeLocation: null
      } as any);

      await getProfile(mockReq as any, mockRes as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockUser.email
        })
      );
    });

    it('should return 401 when not authenticated', async () => {
      (mockReq as any).user = undefined;

      await getProfile(mockReq as any, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'Unauthorized'
      });
    });

    it('should return 404 when user not found', async () => {
      const mockUser = createMockUser();
      (mockReq as any).user = mockUser;

      prismaMock.user.findUnique.mockResolvedValue(null);

      await getProfile(mockReq as any, mockRes as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({
        message: 'User not found'
      });
    });
  });
});
