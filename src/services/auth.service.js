/**
 * AuthService - Authentication and session management service
 * Handles user authentication via Google ID, session validation, and user access verification
 * Manages authentication state and enforces user isolation checks
 */

const {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  ConflictError,
} = require('../utils/custom-errors');

/**
 * AuthService class for managing authentication and authorization
 * Provides methods for:
 * - Authenticating users via Google
 * - Validating sessions
 * - Extracting authenticated user IDs
 * - Verifying user access to resources (user isolation)
 *
 * @class AuthService
 */
class AuthService {
  /**
   * Constructor for dependency injection
   * @param {CustomerService} customerService - Service for user profile management and lookup
   * @param {ErrorHandlerService} errorHandlerService - Service for error formatting
   */
  constructor(customerService, errorHandlerService) {
    if (!customerService) {
      throw new Error('CustomerService is required for AuthService');
    }
    if (!errorHandlerService) {
      throw new Error('ErrorHandlerService is required for AuthService');
    }

    this.customerService = customerService;
    this.errorHandlerService = errorHandlerService;
  }

  /**
   * Authenticate user via Google ID and store session
   * Validates user data and creates or retrieves user from database
   * Called during login flow to establish authenticated session
   *
   * @async
   * @param {string} googleId - Google user ID from authentication provider
   * @param {Object} userData - User profile data from Google
   * @param {string} userData.name - User's full name
   * @param {string} userData.email - User's email address
   * @param {string} [userData.picture] - URL to user's profile picture
   * @returns {Promise<Object>} Authenticated user object with id, googleId, name, email, picture
   * @throws {ValidationError} If googleId or email is missing/invalid
   * @throws {ConflictError} If user registration encounters issues
   *
   * @example
   * const user = await authService.authenticateGoogleUser(
   *   '123456789',
   *   { name: 'John Doe', email: 'john@gmail.com', picture: 'url' }
   * );
   * // Returns: { id: '507f...', googleId: '123456789', name: 'John Doe', ... }
   */
  async authenticateGoogleUser(googleId, userData) {
    // Validate required fields
    if (!googleId || typeof googleId !== 'string') {
      throw new ValidationError(
        'Invalid Google ID provided',
        { field: 'googleId' }
      );
    }

    if (!userData) {
      throw new ValidationError(
        'User data is required for authentication',
        { field: 'userData' }
      );
    }

    if (!userData.email || typeof userData.email !== 'string') {
      throw new ValidationError(
        'Email is required for user authentication',
        { field: 'email' }
      );
    }

    if (!userData.name || typeof userData.name !== 'string') {
      throw new ValidationError(
        'User name is required for authentication',
        { field: 'name' }
      );
    }

    try {
      // Check if user with this email already exists
      const existingUser = await this.customerService.emailExists(userData.email);

      let user;
      if (existingUser) {
        // User exists, retrieve and return
        user = await this.customerService.getUserByEmail(userData.email);
      } else {
        // New user, register them
        user = await this.customerService.registerCustomer({
          googleId,
          name: userData.name,
          email: userData.email,
          picture: userData.picture || null,
        });
      }

      // Verify user was created/retrieved successfully
      if (!user) {
        throw new ConflictError(
          'Failed to authenticate user',
          { email: userData.email }
        );
      }

      // Return user object for session storage
      return {
        id: user._id || user.id,
        googleId: user.googleId,
        name: user.name,
        email: user.email,
        picture: user.profilePicture || user.picture || null,
      };
    } catch (error) {
      // Re-throw if it's already a service error
      if (error instanceof (ValidationError || ConflictError)) {
        throw error;
      }

      // Wrap unexpected errors
      throw new ConflictError(
        'Authentication failed during user registration',
        { originalError: error.message }
      );
    }
  }

  /**
   * Validate if request contains valid authentication
   * Checks for authenticated user in session/context
   * Used by authentication middleware to verify requests
   *
   * @async
   * @param {Object} req - Express request object
   * @param {Object} [req.user] - Authenticated user object (set by middleware)
   * @param {Object} [req.session] - Session object containing user data
   * @returns {Promise<Object>} Validation result object
   * @returns {Promise<{isValid: boolean, userId?: string}>} - {isValid: true, userId} if valid, {isValid: false} if invalid
   *
   * @example
   * // Valid session
   * const result = await authService.validateSession(req);
   * // Returns: { isValid: true, userId: '507f1f77bcf86cd799439011' }
   *
   * @example
   * // Invalid session
   * const result = await authService.validateSession(req);
   * // Returns: { isValid: false }
   */
  async validateSession(req) {
    try {
      // Check if user is already attached to request (by middleware)
      if (req.user && req.user.id) {
        return {
          isValid: true,
          userId: req.user.id,
        };
      }

      // Check for Google ID in session or headers or body
      const googleId = req.session?.googleId ||
        req.headers['x-google-id'] ||
        (req.body && req.body.googleId);

      if (!googleId) {
        return {
          isValid: false,
        };
      }

      // Verify Google ID is valid string format
      if (typeof googleId !== 'string' || googleId.trim().length === 0) {
        return {
          isValid: false,
        };
      }

      // Try to find user by Google ID
      const user = await this.customerService.getUserByGoogleId(googleId);

      if (!user) {
        return {
          isValid: false,
        };
      }

      // Session is valid, return user ID
      return {
        isValid: true,
        userId: user._id || user.id,
      };
    } catch (error) {
      // On error, consider session invalid for security
      // Log the error but don't expose details
      return {
        isValid: false,
      };
    }
  }

  /**
   * Extract authenticated user ID from request context
   * Used by controllers and services to get current authenticated user
   * Requires user to be authenticated (validateSession to pass first)
   *
   * @param {Object} req - Express request object with authenticated user
   * @param {Object} req.user - User object attached by authentication middleware
   * @param {string} req.user.id - Authenticated user's ID
   * @returns {string} Authenticated user ID (MongoDB ObjectId)
   * @throws {AuthenticationError} If no authenticated user found in request
   *
   * @example
   * // In controller after auth middleware validates
   * const userId = authService.getAuthenticatedUserId(req);
   * const bookings = await bookingService.getBookingsByCustomer(userId);
   *
   * @example
   * // Error case
   * try {
   *   const userId = authService.getAuthenticatedUserId(req); // No user attached
   * } catch (error) {
   *   // Throws: AuthenticationError('Authentication required')
   * }
   */
  getAuthenticatedUserId(req) {
    // Check if request has user attached by middleware
    if (!req.user || !req.user.id) {
      throw new AuthenticationError(
        'Authentication required. Please log in to continue.'
      );
    }

    // Verify user ID is a valid string
    if (typeof req.user.id !== 'string' || req.user.id.trim().length === 0) {
      throw new AuthenticationError(
        'Invalid authentication state. Please log in again.'
      );
    }

    return req.user.id;
  }

  /**
   * Verify user has access to specific resource (user isolation check)
   * Ensures userId matches resourceOwnerId for data security
   * Critical for preventing unauthorized access to other users' data
   *
   * @async
   * @param {string} userId - Authenticated user's ID (from request context)
   * @param {string} resourceOwnerId - The user ID that owns the resource
   * @returns {Promise<boolean>} Returns true if userId matches resourceOwnerId
   * @throws {AuthorizationError} If userId does not match resourceOwnerId
   *
   * @example
   * // User accessing their own booking - allowed
   * await authService.verifyUserAccess(userId, booking.customerId);
   * // Returns: true
   *
   * @example
   * // User accessing another user's booking - forbidden
   * try {
   *   await authService.verifyUserAccess(userId, otherUserId);
   * } catch (error) {
   *   // Throws: AuthorizationError('Insufficient permissions')
   * }
   */
  async verifyUserAccess(userId, resourceOwnerId) {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new AuthorizationError(
        'Invalid user ID provided'
      );
    }

    if (!resourceOwnerId || typeof resourceOwnerId !== 'string') {
      throw new AuthorizationError(
        'Invalid resource owner ID provided'
      );
    }

    // Perform user isolation check
    if (userId !== resourceOwnerId) {
      throw new AuthorizationError(
        'You do not have permission to access this resource'
      );
    }

    // Access granted
    return true;
  }
}

module.exports = AuthService;
