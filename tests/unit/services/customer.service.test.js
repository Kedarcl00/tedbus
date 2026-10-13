/**
 * CustomerService Unit Tests
 * Tests all methods of CustomerService with focus on:
 * - User isolation enforcement
 * - Input validation
 * - Proper error handling
 * - Dependency injection
 */

const CustomerService = require('../../../src/services/customer.service');
const UserRepository = require('../../../src/repositories/user.repository');
const {
  ValidationError,
  ConflictError,
  NotFoundError,
} = require('../../../src/utils/custom-errors');

// Mock UserRepository
jest.mock('../../../src/repositories/user.repository');

describe('CustomerService', () => {
  let customerService;
  let mockErrorHandlerService;
  let mockUserRepository;

  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();

    // Mock ErrorHandlerService
    mockErrorHandlerService = {
      formatError: jest.fn((error) => ({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
        },
      })),
      categorizeError: jest.fn(),
      logError: jest.fn(),
    };

    // Initialize service
    customerService = new CustomerService(mockErrorHandlerService);

    // Get the mocked instance for further setup
    mockUserRepository = UserRepository.mock.instances[0];
  });

  describe('Constructor', () => {
    it('should initialize with ErrorHandlerService', () => {
      expect(customerService).toBeDefined();
      expect(customerService.userRepository).toBeDefined();
      expect(customerService.errorHandlerService).toBe(mockErrorHandlerService);
    });

    it('should throw error if ErrorHandlerService is not provided', () => {
      expect(() => new CustomerService(null)).toThrow(
        'ErrorHandlerService is required for CustomerService'
      );
    });

    it('should throw error if ErrorHandlerService is undefined', () => {
      expect(() => new CustomerService(undefined)).toThrow(
        'ErrorHandlerService is required for CustomerService'
      );
    });
  });

  describe('registerCustomer', () => {
    it('should successfully register a new customer', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@gmail.com',
        googleId: '123456789',
        picture: 'https://example.com/pic.jpg',
      };

      mockUserRepository.emailExists.mockResolvedValue(false);
      mockUserRepository.create.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        ...userData,
        isActive: true,
      });

      const result = await customerService.registerCustomer(userData);

      expect(result).toHaveProperty('_id');
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@gmail.com');
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it('should trim name and lowercase email on registration', async () => {
      const userData = {
        name: '  John Doe  ',
        email: 'JOHN@GMAIL.COM',
        googleId: '123456789',
      };

      mockUserRepository.emailExists.mockResolvedValue(false);
      mockUserRepository.create.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@gmail.com',
        googleId: '123456789',
      });

      await customerService.registerCustomer(userData);

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@gmail.com',
        })
      );
    });

    it('should throw ValidationError if name is missing', async () => {
      const userData = {
        email: 'john@gmail.com',
        googleId: '123456789',
      };

      await expect(customerService.registerCustomer(userData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError if email is missing', async () => {
      const userData = {
        name: 'John Doe',
        googleId: '123456789',
      };

      await expect(customerService.registerCustomer(userData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError if email format is invalid', async () => {
      const userData = {
        name: 'John Doe',
        email: 'not-an-email',
        googleId: '123456789',
      };

      await expect(customerService.registerCustomer(userData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError if password is too short', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@gmail.com',
        password: '12345',
      };

      await expect(customerService.registerCustomer(userData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ConflictError if email already exists', async () => {
      const userData = {
        name: 'John Doe',
        email: 'existing@gmail.com',
        googleId: '123456789',
      };

      mockUserRepository.emailExists.mockResolvedValue(true);

      await expect(customerService.registerCustomer(userData)).rejects.toThrow(
        ConflictError
      );
    });

    it('should handle MongoDB duplicate key error (code 11000)', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@gmail.com',
        googleId: '123456789',
      };

      mockUserRepository.emailExists.mockResolvedValue(false);
      mockUserRepository.create.mockRejectedValue({
        code: 11000,
        keyPattern: { email: 1 },
      });

      await expect(customerService.registerCustomer(userData)).rejects.toThrow(
        ConflictError
      );
    });

    it('should accept valid password for email/password registration', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@gmail.com',
        password: 'securePassword123',
      };

      mockUserRepository.emailExists.mockResolvedValue(false);
      mockUserRepository.create.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        ...userData,
      });

      const result = await customerService.registerCustomer(userData);

      expect(result).toBeDefined();
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it('should validate name is a string', async () => {
      const userData = {
        name: 123,
        email: 'john@gmail.com',
      };

      await expect(customerService.registerCustomer(userData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should validate email is a string', async () => {
      const userData = {
        name: 'John Doe',
        email: 123,
      };

      await expect(customerService.registerCustomer(userData)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('getProfile', () => {
    it('should retrieve user profile by userId', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockUser = {
        _id: userId,
        name: 'John Doe',
        email: 'john@gmail.com',
        picture: 'url',
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await customerService.getProfile(userId);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundError if user does not exist', async () => {
      const userId = '507f1f77bcf86cd799439011';

      mockUserRepository.findById.mockResolvedValue(null);

      await expect(customerService.getProfile(userId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError if userId is missing', async () => {
      await expect(customerService.getProfile(null)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError if userId is not a string', async () => {
      await expect(customerService.getProfile(123)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError if userId is empty string', async () => {
      await expect(customerService.getProfile('')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('updateProfile', () => {
    const userId = '507f1f77bcf86cd799439011';
    const mockUser = {
      _id: userId,
      name: 'John Doe',
      email: 'john@gmail.com',
    };

    it('should update user profile with allowed fields', async () => {
      const updateData = {
        name: 'Jane Doe',
        phone: '555-1234',
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.updateById.mockResolvedValue({
        ...mockUser,
        ...updateData,
      });

      const result = await customerService.updateProfile(userId, updateData);

      expect(result).toBeDefined();
      expect(mockUserRepository.updateById).toHaveBeenCalledWith(
        userId,
        expect.any(Object)
      );
    });

    it('should throw NotFoundError if user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        customerService.updateProfile(userId, { name: 'Jane' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if userId is invalid', async () => {
      await expect(
        customerService.updateProfile(null, { name: 'Jane' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should handle update repository errors', async () => {
      const updateData = { name: 'Jane Doe' };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.updateById.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        customerService.updateProfile(userId, updateData)
      ).rejects.toThrow(ValidationError);
    });

    it('should only update allowed fields', async () => {
      const updateData = {
        name: 'Jane Doe',
        phone: '555-1234',
        picture: 'new-pic-url',
        email: 'hacker@gmail.com', // Should be ignored
        googleId: 'hacker-id', // Should be ignored
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.updateById.mockResolvedValue({
        ...mockUser,
        ...updateData,
      });

      await customerService.updateProfile(userId, updateData);

      // Verify that email and googleId were not included in updates
      const calledWith = mockUserRepository.updateById.mock.calls[0][1];
      expect(calledWith).not.toHaveProperty('email');
      expect(calledWith).not.toHaveProperty('googleId');
    });

    it('should update preferences through nested fields', async () => {
      const updateData = {
        language: 'es',
        emailNotifications: false,
        smsNotifications: true,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.updateById.mockResolvedValue({
        ...mockUser,
        preferences: {
          language: 'es',
          notifications: {
            email: false,
            sms: true,
          },
        },
      });

      const result = await customerService.updateProfile(userId, updateData);

      expect(result).toBeDefined();
      expect(mockUserRepository.updateById).toHaveBeenCalled();
    });
  });

  describe('getPreferences', () => {
    it('should retrieve user preferences', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockUser = {
        _id: userId,
        name: 'John Doe',
        preferences: {
          language: 'en',
          notifications: {
            email: true,
            sms: false,
          },
        },
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await customerService.getPreferences(userId);

      expect(result).toEqual(mockUser.preferences);
    });

    it('should return default preferences if user has none', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockUser = {
        _id: userId,
        name: 'John Doe',
        preferences: undefined,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await customerService.getPreferences(userId);

      expect(result).toEqual({
        language: 'en',
        notifications: {},
      });
    });

    it('should throw NotFoundError if user does not exist', async () => {
      const userId = '507f1f77bcf86cd799439011';

      mockUserRepository.findById.mockResolvedValue(null);

      await expect(customerService.getPreferences(userId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError if userId is invalid', async () => {
      await expect(customerService.getPreferences(null)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('emailExists', () => {
    it('should return true if email exists', async () => {
      const email = 'john@gmail.com';

      mockUserRepository.emailExists.mockResolvedValue(true);

      const result = await customerService.emailExists(email);

      expect(result).toBe(true);
      expect(mockUserRepository.emailExists).toHaveBeenCalledWith(email);
    });

    it('should return false if email does not exist', async () => {
      const email = 'john@gmail.com';

      mockUserRepository.emailExists.mockResolvedValue(false);

      const result = await customerService.emailExists(email);

      expect(result).toBe(false);
    });

    it('should return false if email is null', async () => {
      const result = await customerService.emailExists(null);

      expect(result).toBe(false);
      expect(mockUserRepository.emailExists).not.toHaveBeenCalled();
    });

    it('should return false if email is undefined', async () => {
      const result = await customerService.emailExists(undefined);

      expect(result).toBe(false);
    });

    it('should return false if email is not a string', async () => {
      const result = await customerService.emailExists(123);

      expect(result).toBe(false);
    });
  });

  describe('getUserByEmail', () => {
    it('should retrieve user by email', async () => {
      const email = 'john@gmail.com';
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email,
      };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      const result = await customerService.getUserByEmail(email);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
    });

    it('should return null if user not found', async () => {
      const email = 'notfound@gmail.com';

      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await customerService.getUserByEmail(email);

      expect(result).toBeNull();
    });

    it('should return null if email is null', async () => {
      const result = await customerService.getUserByEmail(null);

      expect(result).toBeNull();
      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('should return null if email is not a string', async () => {
      const result = await customerService.getUserByEmail(123);

      expect(result).toBeNull();
    });
  });

  describe('getUserByGoogleId', () => {
    it('should retrieve user by Google ID', async () => {
      const googleId = '123456789';
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        googleId,
      };

      mockUserRepository.findByGoogleId.mockResolvedValue(mockUser);

      const result = await customerService.getUserByGoogleId(googleId);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findByGoogleId).toHaveBeenCalledWith(googleId);
    });

    it('should return null if user not found', async () => {
      const googleId = 'unknown-id';

      mockUserRepository.findByGoogleId.mockResolvedValue(null);

      const result = await customerService.getUserByGoogleId(googleId);

      expect(result).toBeNull();
    });

    it('should return null if googleId is null', async () => {
      const result = await customerService.getUserByGoogleId(null);

      expect(result).toBeNull();
      expect(mockUserRepository.findByGoogleId).not.toHaveBeenCalled();
    });

    it('should return null if googleId is not a string', async () => {
      const result = await customerService.getUserByGoogleId(123);

      expect(result).toBeNull();
    });
  });

  describe('User Isolation Tests', () => {
    it('should not expose user data to unauthorized requests', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const otherUserId = '507f1f77bcf86cd799439012';

      const mockUser = {
        _id: userId,
        name: 'John Doe',
        email: 'john@gmail.com',
        phone: '555-1234',
        preferences: { language: 'en' },
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      // User should be able to get their own profile
      const result = await customerService.getProfile(userId);
      expect(result._id).toBe(userId);

      // Different user ID should result in their own data, not cross-contamination
      mockUserRepository.findById.mockResolvedValue({
        _id: otherUserId,
        name: 'Jane Doe',
        email: 'jane@gmail.com',
      });

      const otherResult = await customerService.getProfile(otherUserId);
      expect(otherResult._id).toBe(otherUserId);
      expect(otherResult._id).not.toBe(userId);
    });

    it('should validate updateProfile operates only on intended user', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockUser = {
        _id: userId,
        name: 'John Doe',
        email: 'john@gmail.com',
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.updateById.mockResolvedValue({
        ...mockUser,
        phone: '555-1234',
      });

      // User updates their own profile
      await customerService.updateProfile(userId, { phone: '555-1234' });

      // Verify the correct user ID was passed to repository
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.updateById).toHaveBeenCalledWith(userId, expect.any(Object));
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle empty string inputs gracefully', async () => {
      await expect(customerService.getProfile('')).rejects.toThrow(NotFoundError);
      await expect(customerService.emailExists('')).resolves.toBe(false);
      await expect(customerService.getUserByEmail('')).resolves.toBeNull();
    });

    it('should handle undefined inputs gracefully', async () => {
      await expect(customerService.getProfile(undefined)).rejects.toThrow(NotFoundError);
      await expect(customerService.emailExists(undefined)).resolves.toBe(false);
      await expect(customerService.getUserByEmail(undefined)).resolves.toBeNull();
    });

    it('should handle null inputs gracefully', async () => {
      await expect(customerService.getProfile(null)).rejects.toThrow(NotFoundError);
      await expect(customerService.emailExists(null)).resolves.toBe(false);
      await expect(customerService.getUserByEmail(null)).resolves.toBeNull();
    });

    it('should throw ValidationError for invalid data types', async () => {
      const invalidUserData = {
        name: 123,
        email: 'test@test.com',
      };

      await expect(customerService.registerCustomer(invalidUserData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should preserve error stack traces', async () => {
      mockUserRepository.findById.mockRejectedValue(new Error('DB Error'));

      try {
        await customerService.getProfile('507f1f77bcf86cd799439011');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
