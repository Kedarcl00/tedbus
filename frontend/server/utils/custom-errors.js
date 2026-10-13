/**
 * Custom Error Classes for TedBus Service-Oriented Architecture
 * These errors are thrown by services and caught by error handler middleware
 */

class ServiceError extends Error {
  constructor(code, message, statusCode = 500, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends ServiceError {
  constructor(message, details = {}) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

class AuthenticationError extends ServiceError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
  }
}

class AuthorizationError extends ServiceError {
  constructor(message = 'Insufficient permissions') {
    super('FORBIDDEN', message, 403);
  }
}

class ForbiddenError extends ServiceError {
  constructor(message = 'Insufficient permissions') {
    super('FORBIDDEN', message, 403);
  }
}

class NotFoundError extends ServiceError {
  constructor(resource = 'Resource') {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

class BusinessRuleError extends ServiceError {
  constructor(message, code = 'BUSINESS_RULE_VIOLATION') {
    super(code, message, 400);
  }
}

class ConflictError extends ServiceError {
  constructor(message, details = {}) {
    super('CONFLICT', message, 409, details);
  }
}

class InsufficientSeatsError extends ServiceError {
  constructor(message = 'Insufficient seats available') {
    super('INSUFFICIENT_SEATS', message, 400);
  }
}

class EmailError extends ServiceError {
  constructor(message = 'Failed to send email') {
    super('EMAIL_ERROR', message, 500);
  }
}

module.exports = {
  ServiceError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ForbiddenError,
  NotFoundError,
  BusinessRuleError,
  ConflictError,
  InsufficientSeatsError,
  EmailError,
};
