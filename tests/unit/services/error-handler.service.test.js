/**
 * Unit Tests for ErrorHandlerService
 * Tests error formatting, categorization, transformation, and logging
 */

const ErrorHandlerService = require('../../../src/services/error-handler.service');
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
} = require('../../../src/utils/custom-errors');

describe('ErrorHandlerService', () => {
  let errorHandler;
  let mockLoggerService;

  beforeEach(() => {
    // Mock logger service
    mockLoggerService = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    errorHandler = new ErrorHandlerService(mockLoggerService);
  });

  describe('categorizeError()', () => {
    test('should categorize ValidationError correctly', () => {
      const error = new ValidationError('Email is required', { field: 'email' });
      const result = errorHandler.categorizeError(error);

      expect(result.statusCode).toBe(400);
      expect(result.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    test('should categorize AuthenticationError correctly', () => {
      const error = new AuthenticationError('Invalid credentials');
      const result = errorHandler.categorizeError(error);

      expect(result.statusCode).toBe(401);
      expect(result.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    test('should categorize AuthorizationError correctly', () => {
      const error = new AuthorizationError('Access denied');
      const result = errorHandler.categorizeError(error);

      expect(result.statusCode).toBe(403);
      expect(result.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    test('should categorize NotFoundError correctly', () => {
      const error = new NotFoundError('Booking');
      const result = errorHandler.categorizeError(error);

      expect(result.statusCode).toBe(404);
      expect(result.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    test('should categorize BusinessRuleError correctly', () => {
      const error = new BusinessRuleError('Cannot cancel completed booking');
      const result = errorHandler.categorizeError(error);

      expect(result.statusCode).toBe(400);
      expect(result.code).toBe(ERROR_CODES.BUSINESS_RULE_VIOLATION);
    });

    test('should categorize ConflictError correctly', () => {
      const error = new ConflictError('Email already exists');
      const result = errorHandler.categorizeError(error);

      expect(result.statusCode).toBe(409);
      expect(result.code).toBe(ERROR_CODES.CONFLICT);
    });

    test('should categorize InsufficientSeatsError correctly', () => {
      const error = new InsufficientSeatsError('Not enough seats');
      const result = errorHandler.categorizeError(error);

      expect(result.statusCode).toBe(400);
      expect(result.code).toBe(ERROR_CODES.INSUFFICIENT_SEATS);
    });

    test('should categorize PaymentError correctly', () => {
      const error = new PaymentError('Payment declined');
      const result = errorHandler.categorizeError(error);

      expect(result.statusCode).toBe(400);
      expect(result.code).toBe(ERROR_CODES.PAYMENT_ERROR);
    });

    test('should categorize EmailError correctly', () => {
      const error = new EmailError('SMTP connection failed');
      const result = errorHandler.categorizeError(error);

      expect(result.statusCode).toBe(500);
      expect(result.code).toBe(ERROR_CODES.EMAIL_ERROR);
    });

    test('should categorize generic Error with default 500', () => {
      const error = new Error('Something went wrong');
      const result = errorHandler.categorizeError(error);

      expect(result.statusCode).toBe(500);
      expect(result.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
    });

    test('should use ServiceError statusCode and code properties', () => {
      const error = new ServiceError('CUSTOM_ERROR', 'Custom message', 418);
      const result = errorHandler.categorizeError(error);

      expect(result.statusCode).toBe(418);
      expect(result.code).toBe('CUSTOM_ERROR');
    });
  });

  describe('transformServiceError()', () => {
    test('should transform ServiceError to response format', () => {
      const error = new ValidationError('Invalid email', { field: 'email' });
      const result = errorHandler.transformServiceError(error);

      expect(result).toHaveProperty('code', ERROR_CODES.VALIDATION_ERROR);
      expect(result).toHaveProperty('message', 'Invalid email');
      expect(result).toHaveProperty('statusCode', 400);
      expect(result).toHaveProperty('details');
      expect(result.details.field).toBe('email');
    });

    test('should include all error details', () => {
      const details = { field: 'seats', requested: 5, available: 2 };
      const error = new BusinessRuleError('Invalid seat count', ERROR_CODES.BUSINESS_RULE_VIOLATION, details);
      const result = errorHandler.transformServiceError(error);

      expect(result.details).toEqual(details);
    });

    test('should handle errors with empty details', () => {
      const error = new NotFoundError('User');
      const result = errorHandler.transformServiceError(error);

      expect(result.details).toEqual({});
    });

    test('should throw error if not a ServiceError', () => {
      const error = new Error('Generic error');
      
      expect(() => {
        errorHandler.transformServiceError(error);
      }).toThrow('transformServiceError expects a ServiceError instance');
    });

    test('should preserve all ServiceError properties', () => {
      const error = new AuthenticationError('Session expired');
      const result = errorHandler.transformServiceError(error);

      expect(result.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(result.message).toBe('Session expired');
      expect(result.statusCode).toBe(401);
    });
  });

  describe('formatError()', () => {
    test('should format ServiceError into standard response', () => {
      const error = new ValidationError('Email is required', { field: 'email' });
      const result = errorHandler.formatError(error);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error.message).toBe('Email is required');
      expect(result.error.statusCode).toBe(400);
      expect(result.error.details.field).toBe('email');
    });

    test('should format generic Error into standard response', () => {
      const error = new Error('Database connection failed');
      const result = errorHandler.formatError(error);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
      expect(result.error.message).toBe('Database connection failed');
      expect(result.error.statusCode).toBe(500);
    });

    test('should override statusCode when provided', () => {
      const error = new NotFoundError('Booking');
      const result = errorHandler.formatError(error, 503);

      expect(result.error.statusCode).toBe(503);
      expect(result.error.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    test('should use error message from generic Error', () => {
      const error = new Error('Custom error message');
      const result = errorHandler.formatError(error);

      expect(result.error.message).toBe('Custom error message');
    });

    test('should use default message for Error without message', () => {
      const error = new Error();
      const result = errorHandler.formatError(error);

      expect(result.error.message).toBe('An unexpected error occurred');
    });

    test('should return consistent response structure', () => {
      const error = new AuthorizationError('Access denied');
      const result = errorHandler.formatError(error);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
      expect(result.error).toHaveProperty('statusCode');
      expect(result.error).toHaveProperty('details');
    });

    test('should format all error types correctly', () => {
      const testCases = [
        { error: new ValidationError('Validation failed'), expectedCode: ERROR_CODES.VALIDATION_ERROR },
        { error: new AuthenticationError('Auth failed'), expectedCode: ERROR_CODES.UNAUTHORIZED },
        { error: new AuthorizationError('Forbidden'), expectedCode: ERROR_CODES.FORBIDDEN },
        { error: new NotFoundError('Booking'), expectedCode: ERROR_CODES.NOT_FOUND },
        { error: new ConflictError('Conflict'), expectedCode: ERROR_CODES.CONFLICT },
        { error: new InsufficientSeatsError('No seats'), expectedCode: ERROR_CODES.INSUFFICIENT_SEATS },
      ];

      testCases.forEach(({ error, expectedCode }) => {
        const result = errorHandler.formatError(error);
        expect(result.error.code).toBe(expectedCode);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('createError()', () => {
    test('should create ValidationError with correct properties', () => {
      const error = errorHandler.createError(
        ERROR_CODES.VALIDATION_ERROR,
        'Email is required',
        { field: 'email' }
      );

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('Email is required');
      expect(error.statusCode).toBe(400);
      expect(error.details.field).toBe('email');
    });

    test('should create AuthenticationError with correct HTTP status', () => {
      const error = errorHandler.createError(
        ERROR_CODES.UNAUTHORIZED,
        'Session expired'
      );

      expect(error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(error.statusCode).toBe(401);
    });

    test('should create AuthorizationError with correct HTTP status', () => {
      const error = errorHandler.createError(
        ERROR_CODES.FORBIDDEN,
        'Access denied'
      );

      expect(error.statusCode).toBe(403);
    });

    test('should create NotFoundError with correct HTTP status', () => {
      const error = errorHandler.createError(
        ERROR_CODES.NOT_FOUND,
        'Booking not found'
      );

      expect(error.statusCode).toBe(404);
    });

    test('should create ConflictError with correct HTTP status', () => {
      const error = errorHandler.createError(
        ERROR_CODES.CONFLICT,
        'Email already exists'
      );

      expect(error.statusCode).toBe(409);
    });

    test('should default to 500 for unknown error codes', () => {
      const error = errorHandler.createError(
        'UNKNOWN_CODE',
        'Unknown error'
      );

      expect(error.statusCode).toBe(500);
    });

    test('should handle missing details parameter', () => {
      const error = errorHandler.createError(
        ERROR_CODES.NOT_FOUND,
        'Resource not found'
      );

      expect(error.details).toEqual({});
    });

    test('should be throwable', () => {
      const error = errorHandler.createError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid input'
      );

      expect(() => {
        throw error;
      }).toThrow(ServiceError);
    });

    test('should include all specified error codes', () => {
      const testCases = [
        { code: ERROR_CODES.VALIDATION_ERROR, expectedStatus: 400 },
        { code: ERROR_CODES.UNAUTHORIZED, expectedStatus: 401 },
        { code: ERROR_CODES.FORBIDDEN, expectedStatus: 403 },
        { code: ERROR_CODES.NOT_FOUND, expectedStatus: 404 },
        { code: ERROR_CODES.CONFLICT, expectedStatus: 409 },
        { code: ERROR_CODES.INSUFFICIENT_SEATS, expectedStatus: 400 },
        { code: ERROR_CODES.PAYMENT_ERROR, expectedStatus: 400 },
        { code: ERROR_CODES.EMAIL_ERROR, expectedStatus: 500 },
      ];

      testCases.forEach(({ code, expectedStatus }) => {
        const error = errorHandler.createError(code, 'Test message');
        expect(error.statusCode).toBe(expectedStatus);
        expect(error.code).toBe(code);
      });
    });
  });

  describe('logError()', () => {
    test('should call logger service with error details', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      const context = { userId: '123', endpoint: '/bookings' };

      errorHandler.logError(error, context);

      expect(mockLoggerService.error).toHaveBeenCalled();
      const call = mockLoggerService.error.mock.calls[0];
      expect(call[0]).toBe('Invalid input');
      expect(call[1]).toBe(error);
    });

    test('should include context information in logging', () => {
      const error = new NotFoundError('Booking');
      const context = {
        userId: 'user123',
        endpoint: '/bookings/:id',
        method: 'GET',
      };

      errorHandler.logError(error, context);

      const call = mockLoggerService.error.mock.calls[0];
      const errorInfo = call[2];
      expect(errorInfo.context).toEqual(context);
    });

    test('should include error stack trace', () => {
      const error = new Error('Test error');
      errorHandler.logError(error);

      const call = mockLoggerService.error.mock.calls[0];
      const errorInfo = call[2];
      expect(errorInfo.stack).toBeDefined();
      expect(errorInfo.stack).toContain('Test error');
    });

    test('should include error details if available', () => {
      const details = { field: 'seats', requested: 5, available: 2 };
      const error = new BusinessRuleError('Invalid seats', ERROR_CODES.BUSINESS_RULE_VIOLATION, details);

      errorHandler.logError(error);

      const call = mockLoggerService.error.mock.calls[0];
      const errorInfo = call[2];
      expect(errorInfo.details).toEqual(details);
    });

    test('should use fallback console.error if logger not available', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorHandlerNoLogger = new ErrorHandlerService(null);
      const error = new ValidationError('Test');

      errorHandlerNoLogger.logError(error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    test('should include error code and message', () => {
      const error = new AuthenticationError('Session expired');
      errorHandler.logError(error);

      const call = mockLoggerService.error.mock.calls[0];
      const errorInfo = call[2];
      expect(errorInfo.errorCode).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(errorInfo.errorMessage).toBe('Session expired');
    });

    test('should include timestamp', () => {
      const error = new Error('Test');
      errorHandler.logError(error);

      const call = mockLoggerService.error.mock.calls[0];
      const errorInfo = call[2];
      expect(errorInfo.timestamp).toBeDefined();
      expect(typeof errorInfo.timestamp).toBe('string');
    });

    test('should work with empty context', () => {
      const error = new NotFoundError('User');
      
      expect(() => {
        errorHandler.logError(error);
      }).not.toThrow();

      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });

  describe('formatAndSend()', () => {
    test('should format error, log it, and send response', () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const error = new ValidationError('Invalid email', { field: 'email' });
      const context = { userId: 'user123' };

      errorHandler.formatAndSend(mockRes, error, context);

      // Check formatting and sending
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);

      // Check logging was called
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    test('should use correct HTTP status code', () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const error = new NotFoundError('Booking');

      errorHandler.formatAndSend(mockRes, error);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    test('should handle different error types', () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const errorTypes = [
        { error: new ValidationError('Invalid'), expectedStatus: 400 },
        { error: new AuthenticationError(), expectedStatus: 401 },
        { error: new AuthorizationError(), expectedStatus: 403 },
        { error: new NotFoundError(''), expectedStatus: 404 },
        { error: new ConflictError(''), expectedStatus: 409 },
      ];

      errorTypes.forEach(({ error, expectedStatus }) => {
        mockRes.status.mockClear();
        mockRes.json.mockClear();
        mockLoggerService.error.mockClear();

        errorHandler.formatAndSend(mockRes, error);

        expect(mockRes.status).toHaveBeenCalledWith(expectedStatus);
        expect(mockRes.json).toHaveBeenCalled();
        expect(mockLoggerService.error).toHaveBeenCalled();
      });
    });
  });

  describe('Integration scenarios', () => {
    test('complete validation error flow', () => {
      const error = new ValidationError('Email is invalid', { field: 'email', received: 'notanemail' });
      
      // Categorize
      const category = errorHandler.categorizeError(error);
      expect(category.statusCode).toBe(400);
      
      // Format
      const formatted = errorHandler.formatError(error);
      expect(formatted.success).toBe(false);
      expect(formatted.error.details.field).toBe('email');
      
      // Log
      errorHandler.logError(error, { endpoint: '/auth/register' });
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    test('complete user isolation violation flow', () => {
      const error = new AuthorizationError('You cannot access this user\'s booking');
      
      const formatted = errorHandler.formatError(error);
      expect(formatted.error.statusCode).toBe(403);
      expect(formatted.error.code).toBe(ERROR_CODES.FORBIDDEN);
      
      errorHandler.logError(error, { userId: 'attacker', endpoint: '/bookings/victim_id' });
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    test('complete insufficient seats flow', () => {
      const error = new InsufficientSeatsError('Only 2 seats available, requested 5', {
        requested: 5,
        available: 2,
        busId: 'BUS123',
      });
      
      const formatted = errorHandler.formatError(error);
      expect(formatted.error.code).toBe(ERROR_CODES.INSUFFICIENT_SEATS);
      expect(formatted.error.details.available).toBe(2);
    });
  });

  describe('Edge cases', () => {
    test('should handle null error gracefully', () => {
      // The error parameter will still be an object, even if null is passed
      expect(() => {
        errorHandler.categorizeError(null);
      }).not.toThrow();
    });

    test('should handle error with no message', () => {
      const error = new Error();
      const formatted = errorHandler.formatError(error);
      
      expect(formatted.error.message).toBe('An unexpected error occurred');
    });

    test('should handle error with empty string message', () => {
      const error = new Error('');
      const formatted = errorHandler.formatError(error);
      
      expect(formatted.error.message).toBe('An unexpected error occurred');
    });

    test('should preserve error details through entire flow', () => {
      const details = {
        field: 'bookingDate',
        value: '2024-01-01',
        reason: 'Date is in the past',
      };
      
      const error = new ValidationError('Invalid booking date', details);
      const formatted = errorHandler.formatError(error);
      
      expect(formatted.error.details).toEqual(details);
    });
  });
});
