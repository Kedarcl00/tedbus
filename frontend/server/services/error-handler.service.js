/**
 * ErrorHandlerService
 * Centralized error formatting, categorization, and transformation for consistent API responses
 */

const {
  ServiceError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  BusinessRuleError,
} = require('../utils/custom-errors');

class ErrorHandlerService {
  /**
   * Format any error into standardized response
   * @param {Error|ServiceError} error - The error to format
   * @param {number} statusCode - Optional HTTP status code override
   * @returns {Object} Standardized error response
   */
  formatError(error, statusCode) {
    let formattedError = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        statusCode: statusCode || 500,
        details: {},
      },
    };

    if (error instanceof ServiceError) {
      formattedError.error = {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details,
      };
    } else if (error.code && error.statusCode) {
      // Handle errors with code and statusCode properties
      formattedError.error = {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details || {},
      };
    } else {
      // Generic error
      console.error('Unexpected error:', error);
    }

    return formattedError;
  }

  /**
   * Categorize error and assign HTTP status code
   * @param {Error|ServiceError} error - The error to categorize
   * @returns {Object} {statusCode, code}
   */
  categorizeError(error) {
    if (error instanceof ValidationError) {
      return { statusCode: 400, code: 'VALIDATION_ERROR' };
    }
    if (error instanceof AuthenticationError) {
      return { statusCode: 401, code: 'UNAUTHORIZED' };
    }
    if (error instanceof ForbiddenError) {
      return { statusCode: 403, code: 'FORBIDDEN' };
    }
    if (error instanceof NotFoundError) {
      return { statusCode: 404, code: 'NOT_FOUND' };
    }
    if (error instanceof BusinessRuleError) {
      return { statusCode: 400, code: error.code || 'BUSINESS_RULE_VIOLATION' };
    }
    if (error instanceof ServiceError) {
      return { statusCode: error.statusCode, code: error.code };
    }
    return { statusCode: 500, code: 'INTERNAL_SERVER_ERROR' };
  }

  /**
   * Transform service layer error for client consumption
   * @param {ServiceError} error - The service error
   * @returns {Object} Client-friendly error response
   */
  transformServiceError(error) {
    return this.formatError(error);
  }

  /**
   * Log error with full context for debugging
   * @param {Error} error - The error to log
   * @param {Object} context - Additional context
   */
  logError(error, context = {}) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      errorName: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code || 'UNKNOWN',
      context,
    };

    console.error('[ERROR]', JSON.stringify(errorLog, null, 2));
  }

  /**
   * Create structured error object
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} details - Additional details
   * @returns {ServiceError} Structured error
   */
  createError(code, message, details = {}) {
    const statusCodeMap = {
      VALIDATION_ERROR: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      INSUFFICIENT_SEATS: 400,
      BUSINESS_RULE_VIOLATION: 400,
    };

    const statusCode = statusCodeMap[code] || 500;

    return new ServiceError(code, message, statusCode, details);
  }
}

module.exports = new ErrorHandlerService();
