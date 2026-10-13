/**
 * ErrorHandlerService - Centralized error formatting and categorization
 * Provides standardized error response format across all API endpoints
 * Handles both custom ServiceError instances and generic Error objects
 */

const {
  ServiceError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  BusinessRuleError,
  ConflictError,
  InsufficientSeatsError,
  PaymentError,
  EmailError,
  ERROR_CODES,
} = require('../utils/custom-errors');

/**
 * Standard error response format for all API responses
 * @typedef {Object} ErrorResponse
 * @property {boolean} success - Always false for error responses
 * @property {Object} error - Error details object
 * @property {string} error.code - Machine-readable error code
 * @property {string} error.message - User-friendly error message
 * @property {number} error.statusCode - HTTP status code
 * @property {Object} [error.details] - Optional field-specific error details
 */

class ErrorHandlerService {
  /**
   * Constructor for dependency injection
   * @param {LoggerService} loggerService - Logger service for error logging
   */
  constructor(loggerService) {
    this.loggerService = loggerService;
  }

  /**
   * Map error types to HTTP status codes and error codes
   * Used for categorizing both ServiceError and generic Error instances
   * @private
   */
  static get ERROR_TYPE_MAP() {
    return {
      ValidationError: { statusCode: 400, code: ERROR_CODES.VALIDATION_ERROR },
      AuthenticationError: { statusCode: 401, code: ERROR_CODES.UNAUTHORIZED },
      AuthorizationError: { statusCode: 403, code: ERROR_CODES.FORBIDDEN },
      NotFoundError: { statusCode: 404, code: ERROR_CODES.NOT_FOUND },
      BusinessRuleError: { statusCode: 400, code: ERROR_CODES.BUSINESS_RULE_VIOLATION },
      ConflictError: { statusCode: 409, code: ERROR_CODES.CONFLICT },
      InsufficientSeatsError: { statusCode: 400, code: ERROR_CODES.INSUFFICIENT_SEATS },
      PaymentError: { statusCode: 400, code: ERROR_CODES.PAYMENT_ERROR },
      EmailError: { statusCode: 500, code: ERROR_CODES.EMAIL_ERROR },
    };
  }

  /**
   * Categorize an error and determine HTTP status code and error code
   * Identifies the error type and returns appropriate categorization
   *
   * @param {Error|ServiceError} error - The error to categorize
   * @returns {Object} Object containing statusCode and code
   * @returns {number} statusCode - HTTP status code to return
   * @returns {string} code - Machine-readable error code
   *
   * @example
   * const { statusCode, code } = errorHandler.categorizeError(validationError);
   * // Returns: { statusCode: 400, code: 'VALIDATION_ERROR' }
   */
  categorizeError(error) {
    // Handle null or undefined errors
    if (!error) {
      return {
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      };
    }

    // If error is a ServiceError, it already has statusCode and code
    if (error instanceof ServiceError) {
      return {
        statusCode: error.statusCode || 500,
        code: error.code || ERROR_CODES.INTERNAL_SERVER_ERROR,
      };
    }

    // Check error name against error type map for generic Error instances
    const errorName = error.name || error.constructor.name;
    const mapping = ErrorHandlerService.ERROR_TYPE_MAP[errorName];

    if (mapping) {
      return mapping;
    }

    // Default to 500 Internal Server Error for unknown error types
    return {
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    };
  }

  /**
   * Transform a ServiceError instance for client consumption
   * Extracts relevant fields and formats according to standard error response
   *
   * @param {ServiceError} error - The ServiceError to transform
   * @returns {Object} Transformed error object ready for response
   *
   * @example
   * const transformed = errorHandler.transformServiceError(notFoundError);
   * // Returns: { code: 'NOT_FOUND', message: 'Booking not found', ... }
   */
  transformServiceError(error) {
    if (!(error instanceof ServiceError)) {
      throw new Error('transformServiceError expects a ServiceError instance');
    }

    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details || {},
    };
  }

  /**
   * Format any error into standardized API response format
   * Handles both ServiceError and generic Error objects
   * Converts any error type into consistent response structure
   *
   * @param {Error|ServiceError} error - The error to format
   * @param {number} [statusCode] - Optional override for HTTP status code
   * @returns {Object} Formatted error response object
   *
   * @example
   * // For ServiceError:
   * const response = errorHandler.formatError(validationError);
   * // Returns: { success: false, error: { code: 'VALIDATION_ERROR', ... } }
   *
   * // For generic Error with status code override:
   * const response = errorHandler.formatError(new Error('Something went wrong'), 503);
   * // Returns: { success: false, error: { code: 'INTERNAL_SERVER_ERROR', statusCode: 503, ... } }
   */
  formatError(error, statusCode) {
    let errorData;

    // If it's a ServiceError, transform it directly
    if (error instanceof ServiceError) {
      errorData = this.transformServiceError(error);
    } else {
      // For generic Error objects, categorize and build response
      const categorization = this.categorizeError(error);
      errorData = {
        code: categorization.code,
        message: error.message || 'An unexpected error occurred',
        statusCode: categorization.statusCode,
        details: {},
      };
    }

    // Override statusCode if provided as parameter
    if (statusCode !== undefined) {
      errorData.statusCode = statusCode;
    }

    // Return standardized error response format
    return {
      success: false,
      error: errorData,
    };
  }

  /**
   * Create a structured error object with consistent properties
   * Factory method for creating properly formatted error objects
   * Useful for service methods to create and throw errors
   *
   * @param {string} code - Machine-readable error code (e.g., 'VALIDATION_ERROR')
   * @param {string} message - User-friendly error message
   * @param {Object} [details] - Optional field-specific error details
   * @returns {ServiceError} A ServiceError instance with the given properties
   *
   * @example
   * throw errorHandler.createError(
   *   'VALIDATION_ERROR',
   *   'Email is required',
   *   { field: 'email' }
   * );
   *
   * @example
   * // Using specific error codes for categorization
   * throw errorHandler.createError(
   *   'INSUFFICIENT_SEATS',
   *   'Not enough seats available',
   *   { requested: 5, available: 2 }
   * );
   */
  createError(code, message, details = {}) {
    // Map code to appropriate error class and status code
    const statusCodeMap = {
      [ERROR_CODES.VALIDATION_ERROR]: 400,
      [ERROR_CODES.UNAUTHORIZED]: 401,
      [ERROR_CODES.FORBIDDEN]: 403,
      [ERROR_CODES.NOT_FOUND]: 404,
      [ERROR_CODES.BUSINESS_RULE_VIOLATION]: 400,
      [ERROR_CODES.CONFLICT]: 409,
      [ERROR_CODES.INSUFFICIENT_SEATS]: 400,
      [ERROR_CODES.PAYMENT_ERROR]: 400,
      [ERROR_CODES.EMAIL_ERROR]: 500,
      [ERROR_CODES.INTERNAL_SERVER_ERROR]: 500,
    };

    const statusCode = statusCodeMap[code] || 500;

    return new ServiceError(code, message, statusCode, details);
  }

  /**
   * Log error with full context for debugging and monitoring
   * Captures error details, stack trace, and context information
   * Called by error middleware and service error handlers
   *
   * @param {Error|ServiceError} error - The error to log
   * @param {Object} [context] - Optional context information about the error
   * @param {string} [context.userId] - Authenticated user ID if applicable
   * @param {string} [context.endpoint] - API endpoint that generated the error
   * @param {string} [context.method] - HTTP method (GET, POST, etc.)
   * @param {Object} [context.requestData] - Request body/params (sanitized)
   * @param {any} [context.additionalInfo] - Any other relevant debugging info
   * @returns {void}
   *
   * @example
   * try {
   *   // Some operation
   * } catch (error) {
   *   errorHandler.logError(error, {
   *     userId: req.user.id,
   *     endpoint: '/bookings',
   *     method: 'POST',
   *     additionalInfo: { bookingId: bookingId }
   *   });
   * }
   */
  logError(error, context = {}) {
    // Build complete error information
    const errorInfo = {
      errorCode: error.code || 'UNKNOWN',
      errorMessage: error.message,
      errorType: error.name || error.constructor.name,
      statusCode: error.statusCode || 500,
      timestamp: new Date().toISOString(),
      context,
    };

    // Include stack trace for debugging
    if (error.stack) {
      errorInfo.stack = error.stack;
    }

    // Include details if available
    if (error.details) {
      errorInfo.details = error.details;
    }

    // Use logger service to log the error (if available)
    if (this.loggerService && typeof this.loggerService.error === 'function') {
      this.loggerService.error(error.message, error, errorInfo);
    } else {
      // Fallback to console if logger not available
      console.error('[ERROR_HANDLER]', JSON.stringify(errorInfo, null, 2));
    }
  }

  /**
   * Format and send an error response via Express response object
   * Convenience method for middleware and controllers
   * Combines formatting, logging, and response sending
   *
   * @param {Object} res - Express response object
   * @param {Error|ServiceError} error - The error to handle
   * @param {Object} [context] - Optional context for logging
   * @returns {void}
   *
   * @example
   * router.get('/bookings/:id', async (req, res) => {
   *   try {
   *     const booking = await bookingService.getBookingById(req.params.id, req.user.id);
   *     res.json({ success: true, data: booking });
   *   } catch (error) {
   *     errorHandler.formatAndSend(res, error, { userId: req.user.id, endpoint: '/bookings/:id' });
   *   }
   * });
   */
  formatAndSend(res, error, context = {}) {
    // Format the error
    const formattedError = this.formatError(error);

    // Log the error with context
    this.logError(error, context);

    // Send the error response
    res.status(formattedError.error.statusCode).json(formattedError);
  }
}

module.exports = ErrorHandlerService;
