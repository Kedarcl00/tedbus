/**
 * Custom Error Classes for TedBus Service-Oriented Architecture
 * Provides structured error handling with consistent categorization across all services
 */

// Error code constants for consistent categorization
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  CONFLICT: 'CONFLICT',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  INSUFFICIENT_SEATS: 'INSUFFICIENT_SEATS',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  EMAIL_ERROR: 'EMAIL_ERROR',
};

/**
 * Base ServiceError class
 * All application-specific errors should extend this class
 * Captures stack trace and provides structured error context
 */
class ServiceError extends Error {
  constructor(code, message, statusCode = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.message = message;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Capture stack trace for debugging
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to standard API response format
   * @returns {Object} Formatted error object
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * ValidationError - HTTP 400 Bad Request
 * Thrown when input validation fails
 * Includes field-specific error details
 */
class ValidationError extends ServiceError {
  constructor(message = 'Validation failed', details = {}) {
    super(
      ERROR_CODES.VALIDATION_ERROR,
      message,
      400,
      details
    );
  }
}

/**
 * AuthenticationError - HTTP 401 Unauthorized
 * Thrown when user is not authenticated or authentication fails
 * Examples: invalid session, missing credentials, expired token
 */
class AuthenticationError extends ServiceError {
  constructor(message = 'Authentication required') {
    super(
      ERROR_CODES.UNAUTHORIZED,
      message,
      401
    );
  }
}

/**
 * AuthorizationError (also called ForbiddenError) - HTTP 403 Forbidden
 * Thrown when authenticated user lacks permissions for a resource
 * Examples: user accessing another user's booking, insufficient permissions
 */
class AuthorizationError extends ServiceError {
  constructor(message = 'Insufficient permissions') {
    super(
      ERROR_CODES.FORBIDDEN,
      message,
      403
    );
  }
}

/**
 * NotFoundError - HTTP 404 Not Found
 * Thrown when requested resource does not exist
 * Examples: booking not found, user not found, bus not found
 */
class NotFoundError extends ServiceError {
  constructor(resource = 'Resource', details = {}) {
    super(
      ERROR_CODES.NOT_FOUND,
      `${resource} not found`,
      404,
      details
    );
  }
}

/**
 * BusinessRuleError - HTTP 400 Bad Request
 * Thrown when business logic constraints are violated
 * Examples: insufficient seats, invalid state transition, booking already cancelled
 */
class BusinessRuleError extends ServiceError {
  constructor(
    message,
    code = ERROR_CODES.BUSINESS_RULE_VIOLATION,
    details = {}
  ) {
    super(code, message, 400, details);
  }
}

/**
 * ConflictError - HTTP 409 Conflict
 * Thrown when request conflicts with existing state
 * Examples: email already registered, duplicate booking, resource already exists
 */
class ConflictError extends ServiceError {
  constructor(message, details = {}) {
    super(
      ERROR_CODES.CONFLICT,
      message,
      409,
      details
    );
  }
}

/**
 * InsufficientSeatsError - HTTP 400 Bad Request
 * Specialized BusinessRuleError for seat availability issues
 */
class InsufficientSeatsError extends ServiceError {
  constructor(message = 'Insufficient seats available', details = {}) {
    super(
      ERROR_CODES.INSUFFICIENT_SEATS,
      message,
      400,
      details
    );
  }
}

/**
 * PaymentError - HTTP 400 Bad Request
 * Thrown when payment processing fails
 */
class PaymentError extends ServiceError {
  constructor(message = 'Payment processing failed', details = {}) {
    super(
      ERROR_CODES.PAYMENT_ERROR,
      message,
      400,
      details
    );
  }
}

/**
 * EmailError - HTTP 500 Internal Server Error
 * Thrown when email sending fails
 * Note: This error should not fail the main request, only log
 */
class EmailError extends ServiceError {
  constructor(message = 'Email sending failed', details = {}) {
    super(
      ERROR_CODES.EMAIL_ERROR,
      message,
      500,
      details
    );
  }
}

// Export all error classes and constants
module.exports = {
  // Error classes
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

  // Error code constants
  ERROR_CODES,
};
