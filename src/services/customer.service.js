/**
 * CustomerService - User profile and account management service
 * Handles user registration, profile retrieval, preferences, and user data management
 * Delegates data access to UserRepository
 */

const UserRepository = require('../repositories/user.repository');
const { ValidationError, ConflictError, NotFoundError } = require('../utils/custom-errors');

class CustomerService {
  /**
   * Constructor for dependency injection
   * @param {ErrorHandlerService} errorHandlerService - Service for error formatting
   */
  constructor(errorHandlerService) {
    if (!errorHandlerService) {
      throw new Error('ErrorHandlerService is required for CustomerService');
    }

    this.userRepository = new UserRepository();
    this.errorHandlerService = errorHandlerService;
  }

  /**
   * Register new customer account
   * Creates user if email doesn't exist, throws ConflictError if duplicate email
   * Supports both Google OAuth and email/password registration
   *
   * @async
   * @param {Object} userData - User registration data
   * @param {string} userData.name - User's full name
   * @param {string} userData.email - User's email address
   * @param {string} [userData.password] - Password for email/password registration (optional for Google)
   * @param {string} [userData.googleId] - Google user ID (for OAuth registration)
   * @param {string} [userData.picture] - Profile picture URL
   * @returns {Promise<Object>} Created user object
   * @throws {ValidationError} If required fields are missing or invalid
   * @throws {ConflictError} If email already registered
   *
   * @example
   * const user = await customerService.registerCustomer({
   *   name: 'John Doe',
   *   email: 'john@gmail.com',
   *   googleId: '123456789',
   *   picture: 'url'
   * });
   */
  async registerCustomer(userData) {
    // Validate required fields
    if (!userData.name || typeof userData.name !== 'string') {
      throw new ValidationError(
        'User name is required and must be a string',
        { field: 'name' }
      );
    }

    if (!userData.email || typeof userData.email !== 'string') {
      throw new ValidationError(
        'Email is required and must be a valid string',
        { field: 'email' }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      throw new ValidationError(
        'Invalid email format',
        { field: 'email', format: 'email@domain.com' }
      );
    }

    // Check if email already exists
    const emailExists = await this.emailExists(userData.email);
    if (emailExists) {
      throw new ConflictError(
        'Email already registered',
        { email: userData.email }
      );
    }

    // Validate password if provided (for email/password registration)
    if (userData.password && typeof userData.password === 'string') {
      if (userData.password.length < 6) {
        throw new ValidationError(
          'Password must be at least 6 characters long',
          { field: 'password', minLength: 6 }
        );
      }
    }

    try {
      // Create new user in database
      const user = await this.userRepository.create({
        name: userData.name.trim(),
        email: userData.email.toLowerCase().trim(),
        password: userData.password || null,
        googleId: userData.googleId || null,
        picture: userData.picture || null,
        profilePicture: userData.picture || null,
        isActive: true,
      });

      return user;
    } catch (error) {
      // Handle duplicate key errors from MongoDB
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new ConflictError(
          `${field} already exists`,
          { field }
        );
      }

      throw new ConflictError(
        'Failed to register user',
        { originalError: error.message }
      );
    }
  }

  /**
   * Get customer profile by user ID
   * Retrieves complete user profile information
   *
   * @async
   * @param {string} userId - MongoDB user ID
   * @returns {Promise<Object>} User profile object
   * @throws {NotFoundError} If user not found
   *
   * @example
   * const profile = await customerService.getProfile('507f1f77bcf86cd799439011');
   */
  async getProfile(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new NotFoundError('User');
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  /**
   * Update customer profile
   * Allows user to update their profile information
   *
   * @async
   * @param {string} userId - MongoDB user ID
   * @param {Object} updateData - Data to update
   * @param {string} [updateData.name] - New name
   * @param {string} [updateData.phone] - Phone number
   * @param {string} [updateData.picture] - Profile picture URL
   * @returns {Promise<Object>} Updated user profile
   * @throws {NotFoundError} If user not found
   * @throws {ValidationError} If update data is invalid
   *
   * @example
   * const updated = await customerService.updateProfile(userId, { phone: '555-1234' });
   */
  async updateProfile(userId, updateData) {
    if (!userId || typeof userId !== 'string') {
      throw new NotFoundError('User');
    }

    // Validate that user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Prepare update object with allowed fields
    const allowedUpdates = {
      name: updateData.name,
      phone: updateData.phone,
      picture: updateData.picture,
      profilePicture: updateData.profilePicture || updateData.picture,
      'preferences.language': updateData.language,
      'preferences.notifications.email': updateData.emailNotifications,
      'preferences.notifications.sms': updateData.smsNotifications,
    };

    // Remove undefined fields
    const cleanUpdates = {};
    Object.keys(allowedUpdates).forEach(key => {
      if (allowedUpdates[key] !== undefined) {
        cleanUpdates[key] = allowedUpdates[key];
      }
    });

    try {
      const updated = await this.userRepository.updateById(userId, cleanUpdates);
      if (!updated) {
        throw new NotFoundError('User');
      }
      return updated;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ValidationError(
        'Failed to update profile',
        { originalError: error.message }
      );
    }
  }

  /**
   * Get customer preferences
   * Retrieves user-specific preferences like language and notifications
   *
   * @async
   * @param {string} userId - MongoDB user ID
   * @returns {Promise<Object>} User preferences object
   * @throws {NotFoundError} If user not found
   *
   * @example
   * const prefs = await customerService.getPreferences(userId);
   */
  async getPreferences(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new NotFoundError('User');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    return user.preferences || { language: 'en', notifications: {} };
  }

  /**
   * Check if email exists in database
   * Used during registration to prevent duplicates
   * Used by AuthService to check if user already exists
   *
   * @async
   * @param {string} email - Email to check
   * @returns {Promise<boolean>} True if email exists, false otherwise
   *
   * @example
   * const exists = await customerService.emailExists('john@gmail.com');
   */
  async emailExists(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }
    return this.userRepository.emailExists(email);
  }

  /**
   * Get user by email address
   * Used by AuthService to find existing user during Google login
   *
   * @async
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User object or null if not found
   *
   * @example
   * const user = await customerService.getUserByEmail('john@gmail.com');
   */
  async getUserByEmail(email) {
    if (!email || typeof email !== 'string') {
      return null;
    }
    return this.userRepository.findByEmail(email);
  }

  /**
   * Get user by Google ID
   * Used by AuthService during session validation
   *
   * @async
   * @param {string} googleId - Google user ID
   * @returns {Promise<Object|null>} User object or null if not found
   *
   * @example
   * const user = await customerService.getUserByGoogleId('123456789');
   */
  async getUserByGoogleId(googleId) {
    if (!googleId || typeof googleId !== 'string') {
      return null;
    }
    return this.userRepository.findByGoogleId(googleId);
  }
}

module.exports = CustomerService;
