/**
 * Error Handler Middleware
 * Catches unhandled errors in the request pipeline and formats standardized responses
 * Must be registered after all other middleware but before final response sends
 *
 * Handles:
 * - ServiceError instances (ValidationError, NotFoundError, AuthenticationError, etc.)
 * - Generic Error objects
 * - Unexpected errors with full stack trace logging
 *
 * Response Format:
 * {
 *   success: false,
 *   error: {
 *     code: "ERROR_CODE",
 *     message: "User-friendly message",
 *     statusCode: 400,
 *     details: { field-specific details }
 *   }
 * }
 *
 * Flow:
 * 1. Receive error from controller/service via next(error)
 * 2. Extract error details and categorize
 * 3. Log error with full context using LoggerService
 * 4. Call ErrorHandlerService.formatError() for standardized format
 * 5. Send formatted response with appropriate HTTP status code
 */

const {
  ServiceError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  BusinessRuleError,
} = require('../utils/custom-errors');

/**
 * Create error handler middleware with dependency injection
 * Catches unhandled errors and formats standardized API responses
 *
 * IMPORTANT: This middleware MUST be registered LAST, after all other middleware and routes.
 * Express error handlers are identified by having 4 parameters (err, req, res, next).
 *
 * @param {ErrorHandlerService} errorHandlerService - Injected ErrorHandlerService for error formatting
 * @param {LoggerService} loggerService - Injected LoggerService for logging errors
 * @returns {Function} Express error middleware function (4 parameters: err, req, res, next)
 *
 * @example
 * const errorMiddleware = createErrorHandlerMiddleware(errorHandlerService, loggerService);
 * // Register after all routes:
 * app.use(errorMiddleware);
 *
 * @example
 * // In a controller, errors are caught and passed to next:
 * try {
 *   const booking = await bookingService.createBooking(userId, data);
 *   res.status(201).json({ success: true, data: booking });
 * } catch (error) {
 *   next(error); // Passes to error handler middleware
 * }
 */
function createErrorHandlerMiddleware(errorHandlerService, loggerService) {
  // Validate dependencies
  if (!errorHandlerService) {
    throw new Error('ErrorHandlerService is required for error handler middleware');
  }

  if (!loggerService) {
    throw new Error('LoggerService is required for error handler middleware');
  }

  /**
   * Express error middleware function
   * MUST have 4 parameters (err, req, res, next) for Express to recognize it as error handler
   *
   * @param {Error|ServiceError} err - The error object thrown by controller or service
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function (for potential chaining)
   */
  return (err, req, res, next) => {
    // Build context information for logging
    const errorContext = {
      userId: req.user?.id || null,
      method: req.method,
      endpoint: req.path,
      url: req.originalUrl,
      timestamp: new Date().toISOString(),
    };

    // Log the error with full context using LoggerService
    // This captures the error for debugging and monitoring
    try {
      loggerService.error(
        `${req.method} ${req.path} - ${err.message}`,
        err,
        errorContext
      );
    } catch (loggingError) {
      // If logging fails, log to console as fallback
      console.error('[ERROR LOGGING FAILED]', loggingError);
    }

    // Format error using ErrorHandlerService
    // This converts the error into the standardized response format
    const formattedError = errorHandlerService.formatError(err);

    // Extract HTTP status code from formatted error
    // Default to 500 if not present
    const statusCode = formattedError.error.statusCode || 500;

    // Send the error response with appropriate HTTP status code
    // Response follows standard format: { success: false, error: { code, message, statusCode, details } }
    res.status(statusCode).json(formattedError);
  };
}

module.exports = createErrorHandlerMiddleware;
