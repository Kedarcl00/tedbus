/**
 * AuthController - Handles authentication request/response processing
 * Thin request handler that delegates all business logic to AuthService and CustomerService
 * Enforces user isolation and proper HTTP status codes
 */

const {
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
} = require('../utils/custom-errors');

/**
 * AuthController class for handling authentication HTTP requests
 * Delegates to AuthService for authentication logic and CustomerService for user management
 * Returns standardized response format with proper HTTP status codes
 *
 * @class AuthController
 */
class AuthController {
  /**
   * Constructor for dependency injection
   * @param {AuthService} authService - Service for authentication and session management
   * @param {CustomerService} customerService - Service for user profile management
   * @param {ErrorHandlerService} errorHandlerService - Service for error formatting and response handling
   * @throws {Error} If any required service is not provided
   */
  constructor(authService, customerService, errorHandlerService) {
    if (!authService) {
      throw new Error('AuthService is required for AuthController');
    }
    if (!customerService) {
      throw new Error('CustomerService is required for AuthController');
    }
    if (!errorHandlerService) {
      throw new Error('ErrorHandlerService is required for AuthController');
    }

    this.authService = authService;
    this.customerService = customerService;
    this.errorHandlerService = errorHandlerService;
  }

  /**
   * Handle user login with Google authentication
   * Authenticates user via Google ID and creates session
   * If user is new, registers them in the system
   * Returns authenticated user object for client-side session storage
   *
   * @async
   * @param {Object} req - Express request object
   * @param {Object} req.body - Request body containing Google user data
   * @param {string} req.body.googleId - Google user ID from authentication provider
   * @param {string} req.body.name - User's full name
   * @param {string} req.body.email - User's email address
   * @param {string} [req.body.picture] - URL to user's profile picture
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function for error handling
   * @returns {void} Sends JSON response with status code 200 on success
   *
   * @example
   * // Successful login
   * POST /auth/login
   * Body: { googleId: "123456789", name: "John", email: "john@gmail.com", picture: "url" }
   * Response: 200 OK
   * {
   *   success: true,
   *   user: {
   *     id: "507f1f77bcf86cd799439011",
   *     googleId: "123456789",
   *     name: "John",
   *     email: "john@gmail.com",
   *     picture: "url"
   *   }
   * }
   *
   * @example
   * // Validation error - missing googleId
   * POST /auth/login
   * Body: { name: "John", email: "john@gmail.com" }
   * Response: 400 Bad Request
   * {
   *   success: false,
   *   error: {
   *     code: "VALIDATION_ERROR",
   *     message: "Invalid Google ID provided",
   *     statusCode: 400,
   *     details: { field: "googleId" }
   *   }
   * }
   */
  async login(req, res, next) {
    try {
      // Extract Google user data from request body
      const { googleId, name, email, picture } = req.body;

      // Validate required fields
      if (!googleId || !name || !email) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError(
              'Missing required authentication fields',
              { required: ['googleId', 'name', 'email'] }
            )
          )
        );
      }

      // Authenticate user via AuthService
      // Returns existing user or creates new user if first login
      const user = await this.authService.authenticateGoogleUser(
        googleId,
        {
          name,
          email,
          picture: picture || null,
        }
      );

      // Return 200 OK with authenticated user object
      return res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      // Pass error to error handler middleware via next(error)
      // This allows centralized error handling and formatting
      next(error);
    }
  }

  /**
   * Handle user registration with email and password
   * Creates new user account after validation
   * Returns 201 Created on successful registration
   *
   * @async
   * @param {Object} req - Express request object
   * @param {Object} req.body - Request body containing registration data
   * @param {string} req.body.name - User's full name
   * @param {string} req.body.email - User's email address
   * @param {string} req.body.password - User's password
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function for error handling
   * @returns {void} Sends JSON response with status code 201 on success
   *
   * @example
   * // Successful registration
   * POST /auth/register
   * Body: { name: "Jane", email: "jane@gmail.com", password: "SecurePass123!" }
   * Response: 201 Created
   * {
   *   success: true,
   *   user: {
   *     id: "507f1f77bcf86cd799439012",
   *     name: "Jane",
   *     email: "jane@gmail.com"
   *   }
   * }
   *
   * @example
   * // Validation error - invalid email format
   * POST /auth/register
   * Body: { name: "Jane", email: "invalid-email", password: "SecurePass123!" }
   * Response: 400 Bad Request
   * {
   *   success: false,
   *   error: {
   *     code: "VALIDATION_ERROR",
   *     message: "Invalid email format",
   *     statusCode: 400,
   *     details: { field: "email" }
   *   }
   * }
   *
   * @example
   * // Conflict error - email already registered
   * POST /auth/register
   * Body: { name: "Jane", email: "existing@gmail.com", password: "SecurePass123!" }
   * Response: 409 Conflict
   * {
   *   success: false,
   *   error: {
   *     code: "CONFLICT",
   *     message: "Email already registered",
   *     statusCode: 409
   *   }
   * }
   */
  async register(req, res, next) {
    try {
      // Extract user registration data from request body
      const { name, email, password } = req.body;

      // Validate required fields
      if (!name || !email || !password) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError(
              'Missing required registration fields',
              { required: ['name', 'email', 'password'] }
            )
          )
        );
      }

      // Validate email format (basic validation - full validation in service)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError(
              'Invalid email format',
              { field: 'email' }
            )
          )
        );
      }

      // Validate password minimum length
      if (password.length < 6) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError(
              'Password must be at least 6 characters long',
              { field: 'password', minLength: 6 }
            )
          )
        );
      }

      // Register customer via CustomerService
      // Service handles business logic validation and database persistence
      const user = await this.customerService.registerCustomer({
        name,
        email,
        password,
      });

      // Return 201 Created with newly registered user object
      return res.status(201).json({
        success: true,
        user: {
          id: user._id || user.id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      // Pass error to error handler middleware via next(error)
      next(error);
    }
  }

  /**
   * Handle user logout
   * Clears session/cookies and invalidates authentication
   * Returns 200 OK on successful logout
   *
   * @async
   * @param {Object} req - Express request object
   * @param {Object} req.session - Session object (Express session middleware)
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function for error handling
   * @returns {void} Sends JSON response with status code 200
   *
   * @example
   * // Successful logout
   * POST /auth/logout
   * Response: 200 OK
   * {
   *   success: true,
   *   message: "Logout successful"
   * }
   *
   * @example
   * // Logout without active session
   * POST /auth/logout
   * Response: 200 OK
   * {
   *   success: true,
   *   message: "Logout successful"
   * }
   */
  async logout(req, res, next) {
    try {
      // Clear session data if Express session middleware is configured
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            // Log but don't fail logout on session destroy error
            console.error('Session destroy error:', err);
          }
        });
      }

      // Clear user object from request
      req.user = null;

      // Return 200 OK with success message
      return res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      // Even if logout fails, return 200 to clear client-side session
      return res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    }
  }

  /**
   * Get current authenticated user profile
   * Returns the user object for the authenticated user from request context
   * Requires authentication (request.user must be set by auth middleware)
   * Returns 401 Unauthorized if user not authenticated
   *
   * @async
   * @param {Object} req - Express request object
   * @param {Object} req.user - Authenticated user object (set by auth middleware)
   * @param {string} req.user.id - Authenticated user's ID
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function for error handling
   * @returns {void} Sends JSON response with status code 200 on success, 401 if not authenticated
   *
   * @example
   * // Authenticated user
   * GET /auth/me
   * Headers: { Authorization: "Bearer <token>" }
   * Response: 200 OK
   * {
   *   success: true,
   *   user: {
   *     id: "507f1f77bcf86cd799439011",
   *     name: "John",
   *     email: "john@gmail.com",
   *     picture: "url"
   *   }
   * }
   *
   * @example
   * // Not authenticated
   * GET /auth/me
   * Response: 401 Unauthorized
   * {
   *   success: false,
   *   error: {
   *     code: "UNAUTHORIZED",
   *     message: "Authentication required. Please log in to continue.",
   *     statusCode: 401
   *   }
   * }
   */
  async getCurrentUser(req, res, next) {
    try {
      // Extract authenticated user ID from request
      // Throws AuthenticationError if user not authenticated
      const userId = this.authService.getAuthenticatedUserId(req);

      // Retrieve full user profile from database
      const user = await this.customerService.getProfile(userId);

      // Return 200 OK with current user object
      return res.status(200).json({
        success: true,
        user: {
          id: user._id || user.id,
          name: user.name,
          email: user.email,
          picture: user.profilePicture || user.picture || null,
          googleId: user.googleId || null,
        },
      });
    } catch (error) {
      // Pass error to error handler middleware via next(error)
      next(error);
    }
  }
}

module.exports = AuthController;
