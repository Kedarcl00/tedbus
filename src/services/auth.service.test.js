/**
 * AuthService Unit Tests
 * Tests authentication, session validation, and user access verification
 * Covers all methods with unit and edge case tests
 */

const AuthService = require('./auth.service');
const {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  ConflictError,
} = require('../utils/custom-errors');

describe('AuthService', () => {
  let authService;
  let mockCustomerService;
  let mockErrorHandlerService;

  beforeEach(() => {
    // Create mock services
    mockCustomerService = {
      emailExists: jest.fn(),
      registerCustomer: jest.fn(),
      getUserByEmail: jest.fn(),
      getUserByGoogleId: jest.fn(),
    };

    mockErrorHandlerService = {
      formatError: jest.fn(),
      categorizeError: jest.fn(),
    };

    // Instantiate AuthService with mocks
    authService = new AuthService(mockCustomerService, mockErrorHandlerService);
  });

  describe('constructor', () => {
    it('should throw error if CustomerService is not provided', () => {
      expect(() => {
        new AuthService(null, mockErrorHandlerService);
      }).toThrow('CustomerService is required for AuthService');
    });

    it('should throw error if ErrorHandlerService is not provided', () => {
      expect(() => {
        new AuthService(mockCustomerService, null);
      }).toThrow('ErrorHandlerService is required for AuthService');
    });

    it('should initialize successfully with both services', () => {
      const service = new AuthService(mockCustomerService, mockErrorHandlerService);
      expect(service.customerService).toBe(mockCustomerService);
      expect(service.errorHandlerService).toBe(mockErrorHandlerService);
    });
  });

  describe('authenticateGoogleUser', () => {
    const validGoogleId = '123456789';
    const validUserData = {
      name: 'John Doe',
      email: 'john@gmail.com',
      picture: 'https://example.com/pic.jpg',
    };

    it('should authenticate and return new user when email does not exist', async () => {
      const newUser = {
        _id: '507f1f77bcf86cd799439011',
        googleId: validGoogleId,
        name: 'John Doe',
        email: 'john@gmail.com',
        profilePicture: 'https://example.com/pic.jpg',
      };

      mockCustomerService.emailExists.mockResolvedValue(false);
      mockCustomerService.registerCustomer.mockResolvedValue(newUser);

      const result = await authService.authenticateGoogleUser(validGoogleId, validUserData);

      expect(result).toEqual({
        id: newUser._id,
        googleId: validGoogleId,
        name: 'John Doe',
        email: 'john@gmail.com',
        picture: 'https://example.com/pic.jpg',
      });

      expect(mockCustomerService.emailExists).toHaveBeenCalledWith('john@gmail.com');
      expect(mockCustomerService.registerCustomer).toHaveBeenCalledWith({
        googleId: validGoogleId,
        name: 'John Doe',
        email: 'john@gmail.com',
        picture: 'https://example.com/pic.jpg',
      });
    });

    it('should authenticate and return existing user when email already exists', async () => {
      const existingUser = {
        _id: '507f1f77bcf86cd799439012',
        googleId: validGoogleId,
        name: 'John Doe',
        email: 'john@gmail.com',
        profilePicture: 'https://example.com/pic.jpg',
      };

      mockCustomerService.emailExists.mockResolvedValue(true);
      mockCustomerService.getUserByEmail.mockResolvedValue(existingUser);

      const result = await authService.authenticateGoogleUser(validGoogleId, validUserData);

      expect(result).toEqual({
        id: existingUser._id,
        googleId: validGoogleId,
        name: 'John Doe',
        email: 'john@gmail.com',
        picture: 'https://example.com/pic.jpg',
      });

      expect(mockCustomerService.emailExists).toHaveBeenCalledWith('john@gmail.com');
      expect(mockCustomerService.getUserByEmail).toHaveBeenCalledWith('john@gmail.com');
      expect(mockCustomerService.registerCustomer).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if googleId is missing', async () => {
      await expect(
        authService.authenticateGoogleUser(null, validUserData)
      ).rejects.toThrow(ValidationError);

      await expect(
        authService.authenticateGoogleUser(null, validUserData)
      ).rejects.toThrow('Invalid Google ID provided');
    });

    it('should throw ValidationError if googleId is empty string', async () => {
      await expect(
        authService.authenticateGoogleUser('', validUserData)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if userData is missing', async () => {
      await expect(
        authService.authenticateGoogleUser(validGoogleId, null)
      ).rejects.toThrow(ValidationError);

      await expect(
        authService.authenticateGoogleUser(validGoogleId, null)
      ).rejects.toThrow('User data is required for authentication');
    });

    it('should throw ValidationError if email is missing from userData', async () => {
      const userData = {
        name: 'John Doe',
        picture: 'https://example.com/pic.jpg',
      };

      await expect(
        authService.authenticateGoogleUser(validGoogleId, userData)
      ).rejects.toThrow(ValidationError);

      await expect(
        authService.authenticateGoogleUser(validGoogleId, userData)
      ).rejects.toThrow('Email is required for user authentication');
    });

    it('should throw ValidationError if name is missing from userData', async () => {
      const userData = {
        email: 'john@gmail.com',
        picture: 'https://example.com/pic.jpg',
      };

      await expect(
        authService.authenticateGoogleUser(validGoogleId, userData)
      ).rejects.toThrow(ValidationError);

      await expect(
        authService.authenticateGoogleUser(validGoogleId, userData)
      ).rejects.toThrow('User name is required for authentication');
    });

    it('should handle user with missing picture field', async () => {
      const userDataNoPicture = {
        name: 'John Doe',
        email: 'john@gmail.com',
      };

      const newUser = {
        _id: '507f1f77bcf86cd799439011',
        googleId: validGoogleId,
        name: 'John Doe',
        email: 'john@gmail.com',
        profilePicture: null,
      };

      mockCustomerService.emailExists.mockResolvedValue(false);
      mockCustomerService.registerCustomer.mockResolvedValue(newUser);

      const result = await authService.authenticateGoogleUser(validGoogleId, userDataNoPicture);

      expect(result.picture).toBeNull();
    });

    it('should throw ConflictError if user creation fails', async () => {
      mockCustomerService.emailExists.mockResolvedValue(false);
      mockCustomerService.registerCustomer.mockResolvedValue(null);

      await expect(
        authService.authenticateGoogleUser(validGoogleId, validUserData)
      ).rejects.toThrow(ConflictError);

      await expect(
        authService.authenticateGoogleUser(validGoogleId, validUserData)
      ).rejects.toThrow('Authentication failed during user registration');
    });

    it('should wrap unexpected errors in ConflictError', async () => {
      mockCustomerService.emailExists.mockRejectedValue(
        new Error('Database connection error')
      );

      await expect(
        authService.authenticateGoogleUser(validGoogleId, validUserData)
      ).rejects.toThrow(ConflictError);

      await expect(
        authService.authenticateGoogleUser(validGoogleId, validUserData)
      ).rejects.toThrow('Authentication failed during user registration');
    });
  });

  describe('validateSession', () => {
    it('should return valid session with userId when user already attached to request', async () => {
      const req = {
        user: {
          id: '507f1f77bcf86cd799439011',
          googleId: '123456789',
          email: 'john@gmail.com',
        },
      };

      const result = await authService.validateSession(req);

      expect(result).toEqual({
        isValid: true,
        userId: '507f1f77bcf86cd799439011',
      });
    });

    it('should validate session using googleId from session object', async () => {
      const req = {
        session: {
          googleId: '123456789',
        },
      };

      const user = {
        _id: '507f1f77bcf86cd799439011',
        googleId: '123456789',
        name: 'John Doe',
        email: 'john@gmail.com',
      };

      mockCustomerService.getUserByGoogleId.mockResolvedValue(user);

      const result = await authService.validateSession(req);

      expect(result).toEqual({
        isValid: true,
        userId: '507f1f77bcf86cd799439011',
      });

      expect(mockCustomerService.getUserByGoogleId).toHaveBeenCalledWith('123456789');
    });

    it('should validate session using googleId from x-google-id header', async () => {
      const req = {
        headers: {
          'x-google-id': '123456789',
        },
      };

      const user = {
        _id: '507f1f77bcf86cd799439011',
        googleId: '123456789',
      };

      mockCustomerService.getUserByGoogleId.mockResolvedValue(user);

      const result = await authService.validateSession(req);

      expect(result).toEqual({
        isValid: true,
        userId: '507f1f77bcf86cd799439011',
      });
    });

    it('should validate session using googleId from request body', async () => {
      const req = {
        headers: {}, // Ensure headers exists so it doesn't match x-google-id
        body: {
          googleId: '123456789',
        },
      };

      const user = {
        _id: '507f1f77bcf86cd799439011',
        googleId: '123456789',
      };

      mockCustomerService.getUserByGoogleId.mockResolvedValue(user);

      const result = await authService.validateSession(req);

      expect(result).toEqual({
        isValid: true,
        userId: '507f1f77bcf86cd799439011',
      });
    });

    it('should return invalid session when no googleId found', async () => {
      const req = {};

      const result = await authService.validateSession(req);

      expect(result).toEqual({
        isValid: false,
      });
    });

    it('should return invalid session when googleId is empty string', async () => {
      const req = {
        session: {
          googleId: '   ',
        },
      };

      const result = await authService.validateSession(req);

      expect(result).toEqual({
        isValid: false,
      });
    });

    it('should return invalid session when user not found', async () => {
      const req = {
        session: {
          googleId: '123456789',
        },
      };

      mockCustomerService.getUserByGoogleId.mockResolvedValue(null);

      const result = await authService.validateSession(req);

      expect(result).toEqual({
        isValid: false,
      });
    });

    it('should return invalid session on database error', async () => {
      const req = {
        session: {
          googleId: '123456789',
        },
      };

      mockCustomerService.getUserByGoogleId.mockRejectedValue(
        new Error('Database error')
      );

      const result = await authService.validateSession(req);

      expect(result).toEqual({
        isValid: false,
      });
    });
  });

  describe('getAuthenticatedUserId', () => {
    it('should return authenticated user ID when user attached to request', () => {
      const req = {
        user: {
          id: '507f1f77bcf86cd799439011',
          googleId: '123456789',
          name: 'John Doe',
        },
      };

      const userId = authService.getAuthenticatedUserId(req);

      expect(userId).toBe('507f1f77bcf86cd799439011');
    });

    it('should throw AuthenticationError when req.user is missing', () => {
      const req = {};

      expect(() => {
        authService.getAuthenticatedUserId(req);
      }).toThrow(AuthenticationError);

      expect(() => {
        authService.getAuthenticatedUserId(req);
      }).toThrow('Authentication required');
    });

    it('should throw AuthenticationError when req.user.id is missing', () => {
      const req = {
        user: {
          googleId: '123456789',
          name: 'John Doe',
        },
      };

      expect(() => {
        authService.getAuthenticatedUserId(req);
      }).toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when user.id is empty string', () => {
      const req = {
        user: {
          id: '   ',
        },
      };

      expect(() => {
        authService.getAuthenticatedUserId(req);
      }).toThrow(AuthenticationError);

      expect(() => {
        authService.getAuthenticatedUserId(req);
      }).toThrow('Invalid authentication state');
    });

    it('should throw AuthenticationError when user.id is not a string', () => {
      const req = {
        user: {
          id: 12345, // Should be string
        },
      };

      expect(() => {
        authService.getAuthenticatedUserId(req);
      }).toThrow(AuthenticationError);
    });
  });

  describe('verifyUserAccess', () => {
    it('should return true when userId matches resourceOwnerId', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const resourceOwnerId = '507f1f77bcf86cd799439011';

      const result = await authService.verifyUserAccess(userId, resourceOwnerId);

      expect(result).toBe(true);
    });

    it('should throw AuthorizationError when userId does not match resourceOwnerId', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const resourceOwnerId = '507f1f77bcf86cd799439012';

      await expect(
        authService.verifyUserAccess(userId, resourceOwnerId)
      ).rejects.toThrow(AuthorizationError);

      await expect(
        authService.verifyUserAccess(userId, resourceOwnerId)
      ).rejects.toThrow('You do not have permission to access this resource');
    });

    it('should throw AuthorizationError when userId is missing', async () => {
      const resourceOwnerId = '507f1f77bcf86cd799439012';

      await expect(
        authService.verifyUserAccess(null, resourceOwnerId)
      ).rejects.toThrow(AuthorizationError);

      await expect(
        authService.verifyUserAccess(null, resourceOwnerId)
      ).rejects.toThrow('Invalid user ID provided');
    });

    it('should throw AuthorizationError when resourceOwnerId is missing', async () => {
      const userId = '507f1f77bcf86cd799439011';

      await expect(
        authService.verifyUserAccess(userId, null)
      ).rejects.toThrow(AuthorizationError);

      await expect(
        authService.verifyUserAccess(userId, null)
      ).rejects.toThrow('Invalid resource owner ID provided');
    });

    it('should throw AuthorizationError when userId is empty string', async () => {
      const resourceOwnerId = '507f1f77bcf86cd799439012';

      await expect(
        authService.verifyUserAccess('', resourceOwnerId)
      ).rejects.toThrow(AuthorizationError);
    });

    it('should throw AuthorizationError when resourceOwnerId is empty string', async () => {
      const userId = '507f1f77bcf86cd799439011';

      await expect(
        authService.verifyUserAccess(userId, '')
      ).rejects.toThrow(AuthorizationError);
    });

    it('should throw AuthorizationError when userId is not a string', async () => {
      const userId = 12345;
      const resourceOwnerId = '507f1f77bcf86cd799439012';

      await expect(
        authService.verifyUserAccess(userId, resourceOwnerId)
      ).rejects.toThrow(AuthorizationError);
    });

    it('should throw AuthorizationError when resourceOwnerId is not a string', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const resourceOwnerId = 12345;

      await expect(
        authService.verifyUserAccess(userId, resourceOwnerId)
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('Integration tests', () => {
    it('should complete authentication flow: login -> validate -> access check', async () => {
      // Step 1: User authenticates
      const googleId = '123456789';
      const userData = {
        name: 'John Doe',
        email: 'john@gmail.com',
        picture: 'https://example.com/pic.jpg',
      };

      const newUser = {
        _id: '507f1f77bcf86cd799439011',
        googleId,
        name: userData.name,
        email: userData.email,
        profilePicture: userData.picture,
      };

      mockCustomerService.emailExists.mockResolvedValue(false);
      mockCustomerService.registerCustomer.mockResolvedValue(newUser);

      const authenticatedUser = await authService.authenticateGoogleUser(googleId, userData);
      expect(authenticatedUser.id).toBe('507f1f77bcf86cd799439011');

      // Step 2: Subsequent request validates session
      const req = {
        user: {
          id: authenticatedUser.id,
          googleId,
        },
      };

      const sessionValid = await authService.validateSession(req);
      expect(sessionValid.isValid).toBe(true);

      // Step 3: Extract user ID for service calls
      const userId = authService.getAuthenticatedUserId(req);
      expect(userId).toBe('507f1f77bcf86cd799439011');

      // Step 4: Verify access to own resource
      const hasAccess = await authService.verifyUserAccess(
        userId,
        '507f1f77bcf86cd799439011'
      );
      expect(hasAccess).toBe(true);

      // Step 5: Verify access is denied to other's resource
      await expect(
        authService.verifyUserAccess(userId, '507f1f77bcf86cd799439012')
      ).rejects.toThrow(AuthorizationError);
    });
  });
});
