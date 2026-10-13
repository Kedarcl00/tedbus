/**
 * AuthController Tests - Unit tests for authentication request handling
 * Tests the controller layer delegation to services and HTTP response formatting
 */

const AuthController = require('./auth.controller');
const {
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
} = require('../utils/custom-errors');

describe('AuthController', () => {
  let authController;
  let mockAuthService;
  let mockCustomerService;
  let mockErrorHandlerService;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Mock services
    mockAuthService = {
      authenticateGoogleUser: jest.fn(),
      validateSession: jest.fn(),
      getAuthenticatedUserId: jest.fn(),
      verifyUserAccess: jest.fn(),
    };

    mockCustomerService = {
      registerCustomer: jest.fn(),
      getProfile: jest.fn(),
      emailExists: jest.fn(),
      getUserByEmail: jest.fn(),
      getUserByGoogleId: jest.fn(),
    };

    mockErrorHandlerService = {
      formatError: jest.fn((error) => ({
        success: false,
        error: {
          code: error.code || 'UNKNOWN',
          message: error.message,
          statusCode: error.statusCode || 500,
          details: error.details || {},
        },
      })),
      logError: jest.fn(),
    };

    // Mock Express objects
    mockReq = {
      body: {},
      user: null,
      session: {
        destroy: jest.fn((cb) => cb()),
      },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Create controller with mocked services
    authController = new AuthController(
      mockAuthService,
      mockCustomerService,
      mockErrorHandlerService
    );
  });

  describe('Constructor', () => {
    it('should throw error if AuthService not provided', () => {
      expect(() => {
        new AuthController(null, mockCustomerService, mockErrorHandlerService);
      }).toThrow('AuthService is required for AuthController');
    });

    it('should throw error if CustomerService not provided', () => {
      expect(() => {
        new AuthController(mockAuthService, null, mockErrorHandlerService);
      }).toThrow('CustomerService is required for AuthController');
    });

    it('should throw error if ErrorHandlerService not provided', () => {
      expect(() => {
        new AuthController(mockAuthService, mockCustomerService, null);
      }).toThrow('ErrorHandlerService is required for AuthController');
    });

    it('should initialize with all required services', () => {
      expect(authController.authService).toBe(mockAuthService);
      expect(authController.customerService).toBe(mockCustomerService);
      expect(authController.errorHandlerService).toBe(mockErrorHandlerService);
    });
  });

  describe('login()', () => {
    it('should authenticate user and return 200 with user object', async () => {
      // Arrange
      mockReq.body = {
        googleId: '123456789',
        name: 'John Doe',
        email: 'john@gmail.com',
        picture: 'https://example.com/pic.jpg',
      };

      const mockUser = {
        id: '507f1f77bcf86cd799439011',
        googleId: '123456789',
        name: 'John Doe',
        email: 'john@gmail.com',
        picture: 'https://example.com/pic.jpg',
      };

      mockAuthService.authenticateGoogleUser.mockResolvedValue(mockUser);

      // Act
      await authController.login(mockReq, mockRes, mockNext);

      // Assert
      expect(mockAuthService.authenticateGoogleUser).toHaveBeenCalledWith(
        '123456789',
        {
          name: 'John Doe',
          email: 'john@gmail.com',
          picture: 'https://example.com/pic.jpg',
        }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        user: mockUser,
      });
    });

    it('should return 400 if googleId is missing', async () => {
      // Arrange
      mockReq.body = {
        name: 'John Doe',
        email: 'john@gmail.com',
      };

      // Act
      await authController.login(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if name is missing', async () => {
      // Arrange
      mockReq.body = {
        googleId: '123456789',
        email: 'john@gmail.com',
      };

      // Act
      await authController.login(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if email is missing', async () => {
      // Arrange
      mockReq.body = {
        googleId: '123456789',
        name: 'John Doe',
      };

      // Act
      await authController.login(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should pass ValidationError to next() if AuthService throws', async () => {
      // Arrange
      mockReq.body = {
        googleId: '123456789',
        name: 'John Doe',
        email: 'john@gmail.com',
      };

      const validationError = new ValidationError('Invalid email');
      mockAuthService.authenticateGoogleUser.mockRejectedValue(validationError);

      // Act
      await authController.login(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(validationError);
    });

    it('should handle picture field as optional', async () => {
      // Arrange
      mockReq.body = {
        googleId: '123456789',
        name: 'John Doe',
        email: 'john@gmail.com',
      };

      const mockUser = {
        id: '507f1f77bcf86cd799439011',
        googleId: '123456789',
        name: 'John Doe',
        email: 'john@gmail.com',
        picture: null,
      };

      mockAuthService.authenticateGoogleUser.mockResolvedValue(mockUser);

      // Act
      await authController.login(mockReq, mockRes, mockNext);

      // Assert
      expect(mockAuthService.authenticateGoogleUser).toHaveBeenCalledWith(
        '123456789',
        {
          name: 'John Doe',
          email: 'john@gmail.com',
          picture: null,
        }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('register()', () => {
    it('should register user and return 201 with user object', async () => {
      // Arrange
      mockReq.body = {
        name: 'Jane Doe',
        email: 'jane@gmail.com',
        password: 'SecurePass123!',
      };

      const mockUser = {
        _id: '507f1f77bcf86cd799439012',
        name: 'Jane Doe',
        email: 'jane@gmail.com',
      };

      mockCustomerService.registerCustomer.mockResolvedValue(mockUser);

      // Act
      await authController.register(mockReq, mockRes, mockNext);

      // Assert
      expect(mockCustomerService.registerCustomer).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@gmail.com',
        password: 'SecurePass123!',
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        user: {
          id: '507f1f77bcf86cd799439012',
          name: 'Jane Doe',
          email: 'jane@gmail.com',
        },
      });
    });

    it('should return 400 if name is missing', async () => {
      // Arrange
      mockReq.body = {
        email: 'jane@gmail.com',
        password: 'SecurePass123!',
      };

      // Act
      await authController.register(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if email is missing', async () => {
      // Arrange
      mockReq.body = {
        name: 'Jane Doe',
        password: 'SecurePass123!',
      };

      // Act
      await authController.register(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if password is missing', async () => {
      // Arrange
      mockReq.body = {
        name: 'Jane Doe',
        email: 'jane@gmail.com',
      };

      // Act
      await authController.register(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if email format is invalid', async () => {
      // Arrange
      mockReq.body = {
        name: 'Jane Doe',
        email: 'invalid-email',
        password: 'SecurePass123!',
      };

      // Act
      await authController.register(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.error.message).toContain('Invalid email format');
    });

    it('should return 400 if password is less than 6 characters', async () => {
      // Arrange
      mockReq.body = {
        name: 'Jane Doe',
        email: 'jane@gmail.com',
        password: 'short',
      };

      // Act
      await authController.register(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.error.message).toContain('at least 6 characters');
    });

    it('should pass ConflictError to next() if email already registered', async () => {
      // Arrange
      mockReq.body = {
        name: 'Jane Doe',
        email: 'existing@gmail.com',
        password: 'SecurePass123!',
      };

      const conflictError = new ConflictError('Email already registered');
      mockCustomerService.registerCustomer.mockRejectedValue(conflictError);

      // Act
      await authController.register(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(conflictError);
    });
  });

  describe('logout()', () => {
    it('should destroy session and return 200 with success message', async () => {
      // Act
      await authController.logout(mockReq, mockRes, mockNext);

      // Assert
      expect(mockReq.session.destroy).toHaveBeenCalled();
      expect(mockReq.user).toBeNull();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful',
      });
    });

    it('should return 200 even if session.destroy throws error', async () => {
      // Arrange
      mockReq.session.destroy.mockImplementation((cb) => {
        cb(new Error('Session destroy failed'));
      });

      // Act
      await authController.logout(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful',
      });
    });

    it('should handle missing session gracefully', async () => {
      // Arrange
      mockReq.session = null;

      // Act
      await authController.logout(mockReq, mockRes, mockNext);

      // Assert
      expect(mockReq.user).toBeNull();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful',
      });
    });
  });

  describe('getCurrentUser()', () => {
    it('should return current user profile when authenticated', async () => {
      // Arrange
      mockReq.user = { id: '507f1f77bcf86cd799439011' };

      const mockUserProfile = {
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@gmail.com',
        profilePicture: 'https://example.com/pic.jpg',
        googleId: '123456789',
      };

      mockAuthService.getAuthenticatedUserId.mockReturnValue('507f1f77bcf86cd799439011');
      mockCustomerService.getProfile.mockResolvedValue(mockUserProfile);

      // Act
      await authController.getCurrentUser(mockReq, mockRes, mockNext);

      // Assert
      expect(mockAuthService.getAuthenticatedUserId).toHaveBeenCalledWith(mockReq);
      expect(mockCustomerService.getProfile).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        user: {
          id: '507f1f77bcf86cd799439011',
          name: 'John Doe',
          email: 'john@gmail.com',
          picture: 'https://example.com/pic.jpg',
          googleId: '123456789',
        },
      });
    });

    it('should return 401 if user not authenticated', async () => {
      // Arrange
      const authError = new AuthenticationError('Authentication required. Please log in to continue.');
      mockAuthService.getAuthenticatedUserId.mockImplementation(() => {
        throw authError;
      });

      // Act
      await authController.getCurrentUser(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(authError);
    });

    it('should handle user without profile picture', async () => {
      // Arrange
      mockReq.user = { id: '507f1f77bcf86cd799439011' };

      const mockUserProfile = {
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@gmail.com',
      };

      mockAuthService.getAuthenticatedUserId.mockReturnValue('507f1f77bcf86cd799439011');
      mockCustomerService.getProfile.mockResolvedValue(mockUserProfile);

      // Act
      await authController.getCurrentUser(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        user: {
          id: '507f1f77bcf86cd799439011',
          name: 'John Doe',
          email: 'john@gmail.com',
          picture: null,
          googleId: null,
        },
      });
    });

    it('should pass NotFoundError to next() if user profile not found', async () => {
      // Arrange
      mockReq.user = { id: '507f1f77bcf86cd799439011' };

      const notFoundError = new NotFoundError('User');
      mockAuthService.getAuthenticatedUserId.mockReturnValue('507f1f77bcf86cd799439011');
      mockCustomerService.getProfile.mockRejectedValue(notFoundError);

      // Act
      await authController.getCurrentUser(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(notFoundError);
    });
  });
});
