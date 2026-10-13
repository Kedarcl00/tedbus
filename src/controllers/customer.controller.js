/**
 * CustomerController - Handles user profile and preference request/response processing
 * Thin request handler that delegates all business logic to CustomerService
 * Enforces user isolation and proper HTTP status codes
 */

const {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} = require('../utils/custom-errors');

/**
 * CustomerController class for handling user profile HTTP requests
 * Delegates to CustomerService for user management logic
 * Returns standardized response format with proper HTTP status codes
 *
 * @class CustomerController
 */
class CustomerController {
  /**
   * Constructor for dependency injection
   * @param {CustomerService} customerService - Service for user profile management
   * @param {ErrorHandlerService} errorHandlerService - Service for error formatting and response handling
   * @throws {Error} If any required service is not provided
   */
  constructor(customerService, errorHandlerService) {
    if (!customerService) {
      throw new Error('CustomerService is required for CustomerController');
    }
    if (!errorHandlerService) {
      throw new Error('ErrorHandlerService is required for CustomerController');
    }

    this.customerService = customerService;
    this.errorHandlerService = errorHandlerService;
  }

  /**
   * Handle GET /users/profile request
   * Retrieves the authenticated user's profile information
   * Enforces user isolation: user can only view their own profile
   *
   * @async
   * @param {Object} req - Express request object
   * @param {Object} req.user - Authenticated user object (set by auth middleware)
   * @param {string} req.user.id - Authenticated user ID from session
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function for error handling
   * @returns {void} Sends JSON response with status code 200 on success
   *
   * @example
   * // Successful profile retrieval
   * GET /users/profile
   * Headers: Authorization: Bearer {...}
   * Response: 200 OK
   * {
   *   success: true,
   *   data: {
   *     id: "507f1f77bcf86cd799439011",
   *     name: "John Doe",
   *     email: "john@gmail.com",
   *     picture: "https://example.com/pic.jpg",
   *     preferences: { language: "en", notifications: {} }
   *   }
   * }
   *
   * @example
   * // User not authenticated
   * GET /users/profile
   * Response: 401 Unauthorized
   * {
   *   success: false,
   *   error: {
   *     code: "UNAUTHORIZED",
   *     message: "Authentication required",
   *     statusCode: 401
   *   }
   * }
   *
   * @example
   * // User profile not found (rare, but can occur if user deleted)
   * GET /users/profile
   * Response: 404 Not Found
   * {
   *   success: false,
   *   error: {
   *     code: "NOT_FOUND",
   *     message: "User not found",
   *     statusCode: 404
   *   }
   * }
   */
  async getProfile(req, res, next) {
    try {
      // Extract authenticated user ID from request context
      // Set by auth middleware after validating session
      const userId = req.user?.id;

      // Verify user is authenticated
      if (!userId) {
        return res.status(401).json(
          this.errorHandlerService.formatError(
            new AuthenticationError('Authentication required')
          )
        );
      }

      // Call CustomerService to retrieve profile
      // Service enforces that profile belongs to authenticated user
      const profile = await this.customerService.getProfile(userId);

      // Return 200 OK with user profile
      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      // Pass error to error handler middleware via next(error)
      // This allows centralized error handling and formatting
      next(error);
    }
  }

  /**
   * Handle PUT /users/profile request
   * Updates the authenticated user's profile information
   * Enforces user isolation: user can only update their own profile
   * Validates request body before updating
   *
   * @async
   * @param {Object} req - Express request object
   * @param {Object} req.user - Authenticated user object (set by auth middleware)
   * @param {string} req.user.id - Authenticated user ID from session
   * @param {Object} req.body - Request body containing profile update data
   * @param {string} [req.body.name] - Updated user name
   * @param {string} [req.body.phone] - Updated phone number
   * @param {string} [req.body.picture] - Updated profile picture URL
   * @param {string} [req.body.language] - Updated language preference
   * @param {boolean} [req.body.emailNotifications] - Email notification preference
   * @param {boolean} [req.body.smsNotifications] - SMS notification preference
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function for error handling
   * @returns {void} Sends JSON response with status code 200 on success
   *
   * @example
   * // Successful profile update
   * PUT /users/profile
   * Headers: Authorization: Bearer {...}
   * Body: { name: "Jane Doe", phone: "555-1234", language: "es" }
   * Response: 200 OK
   * {
   *   success: true,
   *   data: {
   *     id: "507f1f77bcf86cd799439011",
   *     name: "Jane Doe",
   *     email: "john@gmail.com",
   *     phone: "555-1234",
   *     picture: "https://example.com/pic.jpg",
   *     preferences: { language: "es", notifications: {} }
   *   }
   * }
   *
   * @example
   * // Validation error - invalid data
   * PUT /users/profile
   * Headers: Authorization: Bearer {...}
   * Body: { name: "" }
   * Response: 400 Bad Request
   * {
   *   success: false,
   *   error: {
   *     code: "VALIDATION_ERROR",
   *     message: "Invalid profile data provided",
   *     statusCode: 400,
   *     details: { field: "name", reason: "cannot be empty" }
   *   }
   * }
   *
   * @example
   * // User not authenticated
   * PUT /users/profile
   * Response: 401 Unauthorized
   * {
   *   success: false,
   *   error: {
   *     code: "UNAUTHORIZED",
   *     message: "Authentication required",
   *     statusCode: 401
   *   }
   * }
   *
   * @example
   * // User profile not found
   * PUT /users/profile
   * Response: 404 Not Found
   * {
   *   success: false,
   *   error: {
   *     code: "NOT_FOUND",
   *     message: "User not found",
   *     statusCode: 404
   *   }
   * }
   */
  async updateProfile(req, res, next) {
    try {
      // Extract authenticated user ID from request context
      // Set by auth middleware after validating session
      const userId = req.user?.id;

      // Verify user is authenticated
      if (!userId) {
        return res.status(401).json(
          this.errorHandlerService.formatError(
            new AuthenticationError('Authentication required')
          )
        );
      }

      // Extract update data from request body
      const { name, phone, picture, language, emailNotifications, smsNotifications } = req.body;

      // Validate that at least one field is provided for update
      if (
        name === undefined &&
        phone === undefined &&
        picture === undefined &&
        language === undefined &&
        emailNotifications === undefined &&
        smsNotifications === undefined
      ) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError(
              'At least one field must be provided for update',
              { required: ['name', 'phone', 'picture', 'language', 'emailNotifications', 'smsNotifications'] }
            )
          )
        );
      }

      // Validate name if provided
      if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError(
              'Name must be a non-empty string',
              { field: 'name' }
            )
          )
        );
      }

      // Validate phone if provided
      if (phone !== undefined && typeof phone !== 'string') {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError(
              'Phone must be a string',
              { field: 'phone' }
            )
          )
        );
      }

      // Validate picture if provided (should be a valid URL)
      if (picture !== undefined && typeof picture !== 'string') {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError(
              'Picture URL must be a string',
              { field: 'picture' }
            )
          )
        );
      }

      // Validate language if provided
      if (language !== undefined && typeof language !== 'string') {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError(
              'Language must be a string',
              { field: 'language' }
            )
          )
        );
      }

      // Validate notification preferences if provided
      if (emailNotifications !== undefined && typeof emailNotifications !== 'boolean') {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError(
              'Email notifications must be a boolean',
              { field: 'emailNotifications' }
            )
          )
        );
      }

      if (smsNotifications !== undefined && typeof smsNotifications !== 'boolean') {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError(
              'SMS notifications must be a boolean',
              { field: 'smsNotifications' }
            )
          )
        );
      }

      // Prepare update data object with validated fields
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;
      if (picture !== undefined) updateData.picture = picture;
      if (language !== undefined) updateData.language = language;
      if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
      if (smsNotifications !== undefined) updateData.smsNotifications = smsNotifications;

      // Call CustomerService to update profile
      // Service enforces that profile belongs to authenticated user
      const updatedProfile = await this.customerService.updateProfile(userId, updateData);

      // Return 200 OK with updated user profile
      return res.status(200).json({
        success: true,
        data: updatedProfile,
      });
    } catch (error) {
      // Pass error to error handler middleware via next(error)
      // This allows centralized error handling and formatting
      next(error);
    }
  }

  /**
   * Handle GET /users/preferences request
   * Retrieves the authenticated user's preferences
   * Enforces user isolation: user can only view their own preferences
   *
   * @async
   * @param {Object} req - Express request object
   * @param {Object} req.user - Authenticated user object (set by auth middleware)
   * @param {string} req.user.id - Authenticated user ID from session
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function for error handling
   * @returns {void} Sends JSON response with status code 200 on success
   *
   * @example
   * // Successful preferences retrieval
   * GET /users/preferences
   * Headers: Authorization: Bearer {...}
   * Response: 200 OK
   * {
   *   success: true,
   *   data: {
   *     language: "en",
   *     notifications: {
   *       email: true,
   *       sms: false
   *     }
   *   }
   * }
   *
   * @example
   * // User not authenticated
   * GET /users/preferences
   * Response: 401 Unauthorized
   * {
   *   success: false,
   *   error: {
   *     code: "UNAUTHORIZED",
   *     message: "Authentication required",
   *     statusCode: 401
   *   }
   * }
   *
   * @example
   * // User profile not found
   * GET /users/preferences
   * Response: 404 Not Found
   * {
   *   success: false,
   *   error: {
   *     code: "NOT_FOUND",
   *     message: "User not found",
   *     statusCode: 404
   *   }
   * }
   */
  async getPreferences(req, res, next) {
    try {
      // Extract authenticated user ID from request context
      // Set by auth middleware after validating session
      const userId = req.user?.id;

      // Verify user is authenticated
      if (!userId) {
        return res.status(401).json(
          this.errorHandlerService.formatError(
            new AuthenticationError('Authentication required')
          )
        );
      }

      // Call CustomerService to retrieve preferences
      // Service enforces that preferences belong to authenticated user
      const preferences = await this.customerService.getPreferences(userId);

      // Return 200 OK with user preferences
      return res.status(200).json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      // Pass error to error handler middleware via next(error)
      // This allows centralized error handling and formatting
      next(error);
    }
  }
}

module.exports = CustomerController;
