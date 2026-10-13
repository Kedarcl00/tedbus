/**
 * Authentication Middleware
 * Validates incoming requests and attaches authenticated user context
 * Enforces authentication on protected routes while allowing public route access
 *
 * Flow:
 * 1. Check if route requires authentication
 * 2. Extract Google user ID from session or headers
 * 3. Call AuthService.validateSession() to verify user
 * 4. Attach userId to request.user.id for controller use
 * 5. Return 401 Unauthorized if authentication fails
 */

const { AuthenticationError } = require('../utils/custom-errors');

/**
 * List of public routes that don't require authentication
 * All other routes will require a valid authenticated session
 * @type {string[]}
 */
const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/buses',
  '/routes',
  '/search',
  '/health',
];

/**
 * Create authentication middleware with dependency injection
 * Validates requests and attaches user context before controllers process them
 *
 * @param {AuthService} authService - Injected AuthService for session validation
 * @param {ErrorHandlerService} errorHandlerService - Injected ErrorHandlerService for error formatting
 * @returns {Function} Express middleware function
 *
 * @example
 * const authMiddleware = createAuthMiddleware(authService, errorHandlerService);
 * app.use(authMiddleware);
 */
function createAuthMiddleware(authService, errorHandlerService) {
  if (!authService) {
    throw new Error('AuthService is required for authentication middleware');
  }

  if (!errorHandlerService) {
    throw new Error('ErrorHandlerService is required for authentication middleware');
  }

  /**
   * Middleware function that processes requests
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  return async (req, res, next) => {
    try {
      // Check if current route is in the public routes list
      const isPublicRoute = PUBLIC_ROUTES.some(route => {
        // Support both exact matches and prefix matches for nested routes
        return req.path === route || req.path.startsWith(route + '/');
      });

      // If route is public, skip authentication and proceed
      if (isPublicRoute) {
        return next();
      }

      // For protected routes, validate session
      try {
        const validationResult = await authService.validateSession(req);

        // If validation failed, throw authentication error
        if (!validationResult.isValid) {
          throw new AuthenticationError(
            'Authentication required. Please log in to continue.'
          );
        }

        // Attach authenticated user ID to request for controller use
        req.user = req.user || {};
        req.user.id = validationResult.userId;

        // Proceed to next middleware/controller
        return next();
      } catch (error) {
        // If it's already an AuthenticationError, re-throw it
        if (error instanceof AuthenticationError) {
          throw error;
        }

        // Wrap unexpected errors as authentication errors
        throw new AuthenticationError(
          'Authentication failed. Please log in again.'
        );
      }
    } catch (error) {
      // Format and send error response
      errorHandlerService.formatAndSend(res, error, {
        endpoint: req.path,
        method: req.method,
      });
    }
  };
}

module.exports = createAuthMiddleware;
