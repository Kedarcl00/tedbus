/**
 * CustomerController Tests - Unit tests for user profile request handling
 * Tests the controller layer delegation to services and HTTP response formatting
 */

const CustomerController = require('./customer.controller');
const {
  ValidationError,
  AuthenticationError,
  NotFoundError,
} = require('../utils/custom-errors');

describe('CustomerController', () => {
  let customerController;
  let mockCustomerService;
  let mockErrorHandlerService;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Mock services
    mockCustomerService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      getPreferences: jest.fn(),
      registerCustomer: jest.fn(),
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
      user: {
        id: '507f1f77bcf86cd799439011',
      },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Create controller with mocked services
    customerController = new CustomerController(
      mockCustomerService,
      mockErrorHandlerService
    );
  });

  describe('Constructor', () => {
    it('should throw error if CustomerService not provided', () => {
      expect(() => {
        new CustomerController(null, mockErrorHandlerService);
      }).toThrow('CustomerService is required for CustomerController');
    });

    it('should throw error if ErrorHandlerService not provided', () => {
      expect(() => {
        new CustomerController(mockCustomerService, null);
      }).toThrow('ErrorHandlerService is required for CustomerController');
    });

    it('should initialize with all required services', () => {
      expect(customerController.customerService).toBe(mockCustomerService);
      expect(customerController.errorHandlerService).toBe(mockErrorHandlerService);
    });
  });

  describe('getProfile()', () => {
    it('should return 200 with user profile for authenticated user', async () => {
      // Arrange
      const mockProfile = {
        id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@gmail.com',
        picture: 'https://example.com/pic.jpg',
        preferences: { language: 'en', notifications: {} },
      };

      mockCustomerService.getProfile.mockResolvedValue(mockProfile);

      // Act
      await customerController.getProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockCustomerService.getProfile).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockProfile,
      });
    });

    it('should return 401 if user is not authenticated', async () => {
      // Arrange
      mockReq.user = null;

      // Act
      await customerController.getProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalled();
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 if user.id is not present', async () => {
      // Arrange
      mockReq.user = {};

      // Act
      await customerController.getProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should pass NotFoundError to next() if CustomerService throws', async () => {
      // Arrange
      const notFoundError = new NotFoundError('User');
      mockCustomerService.getProfile.mockRejectedValue(notFoundError);

      // Act
      await customerController.getProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(notFoundError);
    });

    it('should pass generic error to next() on unexpected error', async () => {
      // Arrange
      const unexpectedError = new Error('Database connection failed');
      mockCustomerService.getProfile.mockRejectedValue(unexpectedError);

      // Act
      await customerController.getProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(unexpectedError);
    });
  });

  describe('updateProfile()', () => {
    it('should return 200 with updated profile when valid data provided', async () => {
      // Arrange
      mockReq.body = {
        name: 'Jane Doe',
        phone: '555-1234',
        language: 'es',
      };

      const mockUpdatedProfile = {
        id: '507f1f77bcf86cd799439011',
        name: 'Jane Doe',
        email: 'john@gmail.com',
        phone: '555-1234',
        picture: 'https://example.com/pic.jpg',
        preferences: { language: 'es', notifications: {} },
      };

      mockCustomerService.updateProfile.mockResolvedValue(mockUpdatedProfile);

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockCustomerService.updateProfile).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        {
          name: 'Jane Doe',
          phone: '555-1234',
          language: 'es',
        }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedProfile,
      });
    });

    it('should return 400 if no update fields provided', async () => {
      // Arrange
      mockReq.body = {};

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if name is empty string', async () => {
      // Arrange
      mockReq.body = { name: '' };

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if name is not a string', async () => {
      // Arrange
      mockReq.body = { name: 123 };

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should return 400 if phone is not a string', async () => {
      // Arrange
      mockReq.body = { phone: 123 };

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should return 400 if picture is not a string', async () => {
      // Arrange
      mockReq.body = { picture: 123 };

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should return 400 if language is not a string', async () => {
      // Arrange
      mockReq.body = { language: 123 };

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should return 400 if emailNotifications is not a boolean', async () => {
      // Arrange
      mockReq.body = { emailNotifications: 'yes' };

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should return 400 if smsNotifications is not a boolean', async () => {
      // Arrange
      mockReq.body = { smsNotifications: 'yes' };

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', async () => {
      // Arrange
      mockReq.user = null;
      mockReq.body = { name: 'Jane Doe' };

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalled();
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 if user.id is not present', async () => {
      // Arrange
      mockReq.user = {};
      mockReq.body = { name: 'Jane Doe' };

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should pass NotFoundError to next() if CustomerService throws', async () => {
      // Arrange
      mockReq.body = { name: 'Jane Doe' };
      const notFoundError = new NotFoundError('User');
      mockCustomerService.updateProfile.mockRejectedValue(notFoundError);

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(notFoundError);
    });

    it('should pass ValidationError to next() if CustomerService throws', async () => {
      // Arrange
      mockReq.body = { name: 'Jane Doe' };
      const validationError = new ValidationError('Invalid profile data');
      mockCustomerService.updateProfile.mockRejectedValue(validationError);

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(validationError);
    });

    it('should handle partial updates with only phone provided', async () => {
      // Arrange
      mockReq.body = { phone: '555-9999' };

      const mockUpdatedProfile = {
        id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@gmail.com',
        phone: '555-9999',
        picture: 'https://example.com/pic.jpg',
        preferences: { language: 'en', notifications: {} },
      };

      mockCustomerService.updateProfile.mockResolvedValue(mockUpdatedProfile);

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockCustomerService.updateProfile).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { phone: '555-9999' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle multiple field updates', async () => {
      // Arrange
      mockReq.body = {
        name: 'Jane Doe',
        phone: '555-1234',
        picture: 'https://example.com/newpic.jpg',
        language: 'es',
        emailNotifications: true,
        smsNotifications: false,
      };

      const mockUpdatedProfile = {
        id: '507f1f77bcf86cd799439011',
        name: 'Jane Doe',
        email: 'john@gmail.com',
        phone: '555-1234',
        picture: 'https://example.com/newpic.jpg',
        preferences: {
          language: 'es',
          notifications: { email: true, sms: false },
        },
      };

      mockCustomerService.updateProfile.mockResolvedValue(mockUpdatedProfile);

      // Act
      await customerController.updateProfile(mockReq, mockRes, mockNext);

      // Assert
      expect(mockCustomerService.updateProfile).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        {
          name: 'Jane Doe',
          phone: '555-1234',
          picture: 'https://example.com/newpic.jpg',
          language: 'es',
          emailNotifications: true,
          smsNotifications: false,
        }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getPreferences()', () => {
    it('should return 200 with user preferences for authenticated user', async () => {
      // Arrange
      const mockPreferences = {
        language: 'en',
        notifications: {
          email: true,
          sms: false,
        },
      };

      mockCustomerService.getPreferences.mockResolvedValue(mockPreferences);

      // Act
      await customerController.getPreferences(mockReq, mockRes, mockNext);

      // Assert
      expect(mockCustomerService.getPreferences).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockPreferences,
      });
    });

    it('should return default preferences if not set', async () => {
      // Arrange
      const mockPreferences = {
        language: 'en',
        notifications: {},
      };

      mockCustomerService.getPreferences.mockResolvedValue(mockPreferences);

      // Act
      await customerController.getPreferences(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockPreferences,
      });
    });

    it('should return 401 if user is not authenticated', async () => {
      // Arrange
      mockReq.user = null;

      // Act
      await customerController.getPreferences(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalled();
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 if user.id is not present', async () => {
      // Arrange
      mockReq.user = {};

      // Act
      await customerController.getPreferences(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should pass NotFoundError to next() if CustomerService throws', async () => {
      // Arrange
      const notFoundError = new NotFoundError('User');
      mockCustomerService.getPreferences.mockRejectedValue(notFoundError);

      // Act
      await customerController.getPreferences(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(notFoundError);
    });

    it('should pass generic error to next() on unexpected error', async () => {
      // Arrange
      const unexpectedError = new Error('Database connection failed');
      mockCustomerService.getPreferences.mockRejectedValue(unexpectedError);

      // Act
      await customerController.getPreferences(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(unexpectedError);
    });
  });
});
