/**
 * Integration Tests for ErrorHandlerService
 * Tests end-to-end error handling scenarios across services
 */

const ErrorHandlerService = require('../../src/services/error-handler.service');
const {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  BusinessRuleError,
  InsufficientSeatsError,
  ERROR_CODES,
} = require('../../src/utils/custom-errors');

describe('ErrorHandlerService Integration', () => {
  let errorHandler;
  let mockLoggerService;
  let mockExpressResponse;

  beforeEach(() => {
    mockLoggerService = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    mockExpressResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    errorHandler = new ErrorHandlerService(mockLoggerService);
  });

  describe('Booking Workflow Errors', () => {
    test('should handle booking creation validation error', () => {
      // Simulate validation error from booking service
      const error = new ValidationError(
        'Invalid booking data',
        {
          seats: 'Seat numbers must be numeric',
          passengers: 'At least one passenger required',
        }
      );

      // Format and send via Express
      errorHandler.formatAndSend(mockExpressResponse, error, {
        userId: 'user123',
        endpoint: '/bookings',
        method: 'POST',
      });

      // Verify response structure
      expect(mockExpressResponse.status).toHaveBeenCalledWith(400);
      const response = mockExpressResponse.json.mock.calls[0][0];
      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(response.error.details.seats).toBeDefined();

      // Verify logging
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    test('should handle user isolation violation (Booking access)', () => {
      // User B tries to access User A's booking
      const error = new AuthorizationError(
        'You do not have permission to access this booking'
      );

      errorHandler.formatAndSend(mockExpressResponse, error, {
        userId: 'userB',
        endpoint: '/bookings/userA_bookingId',
        method: 'GET',
        requestData: { bookingId: 'userA_bookingId' },
      });

      expect(mockExpressResponse.status).toHaveBeenCalledWith(403);
      const response = mockExpressResponse.json.mock.calls[0][0];
      expect(response.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    test('should handle insufficient seats error', () => {
      const error = new InsufficientSeatsError(
        'Cannot reserve seats',
        {
          busId: 'BUS123',
          requestedSeats: 5,
          availableSeats: 2,
          availableSeatNumbers: [12, 13],
        }
      );

      errorHandler.formatAndSend(mockExpressResponse, error, {
        userId: 'user123',
        endpoint: '/bookings',
        method: 'POST',
      });

      expect(mockExpressResponse.status).toHaveBeenCalledWith(400);
      const response = mockExpressResponse.json.mock.calls[0][0];
      expect(response.error.code).toBe(ERROR_CODES.INSUFFICIENT_SEATS);
      expect(response.error.details.availableSeats).toBe(2);
    });

    test('should handle booking not found error', () => {
      const error = new NotFoundError(
        'Booking',
        { bookingId: 'NONEXISTENT_ID' }
      );

      errorHandler.formatAndSend(mockExpressResponse, error, {
        userId: 'user123',
        endpoint: '/bookings/NONEXISTENT_ID',
        method: 'GET',
      });

      expect(mockExpressResponse.status).toHaveBeenCalledWith(404);
      const response = mockExpressResponse.json.mock.calls[0][0];
      expect(response.error.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    test('should handle business rule violation (cancelled booking)', () => {
      const error = new BusinessRuleError(
        'Cannot cancel this booking as it has already been completed',
        ERROR_CODES.BUSINESS_RULE_VIOLATION,
        { currentStatus: 'completed', action: 'cancel' }
      );

      errorHandler.formatAndSend(mockExpressResponse, error, {
        userId: 'user123',
        endpoint: '/bookings/123',
        method: 'DELETE',
      });

      expect(mockExpressResponse.status).toHaveBeenCalledWith(400);
      const response = mockExpressResponse.json.mock.calls[0][0];
      expect(response.error.details.currentStatus).toBe('completed');
    });
  });

  describe('Authentication & Authorization Flows', () => {
    test('should handle authentication failure during login', () => {
      const error = new AuthenticationError('Invalid Google ID or session expired');

      errorHandler.formatAndSend(mockExpressResponse, error, {
        endpoint: '/auth/login',
        method: 'POST',
      });

      expect(mockExpressResponse.status).toHaveBeenCalledWith(401);
      const response = mockExpressResponse.json.mock.calls[0][0];
      expect(response.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    test('should handle profile access denial', () => {
      const error = new AuthorizationError(
        'Cannot access another user\'s profile'
      );

      errorHandler.formatAndSend(mockExpressResponse, error, {
        userId: 'user123',
        endpoint: '/users/profile/differentUser',
        method: 'GET',
        requestData: { userId: 'differentUser' },
      });

      expect(mockExpressResponse.status).toHaveBeenCalledWith(403);
      const response = mockExpressResponse.json.mock.calls[0][0];
      expect(response.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    test('should handle protected endpoint without authentication', () => {
      const error = new AuthenticationError('Authentication required');

      errorHandler.formatAndSend(mockExpressResponse, error, {
        endpoint: '/bookings/my',
        method: 'GET',
      });

      expect(mockExpressResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe('User Registration Errors', () => {
    test('should handle email already exists error', () => {
      const error = new AuthorizationError(
        'Email address is already registered'
      );

      errorHandler.formatAndSend(mockExpressResponse, error, {
        endpoint: '/auth/register',
        method: 'POST',
        requestData: { email: 'duplicate@example.com' },
      });

      expect(mockExpressResponse.status).toHaveBeenCalledWith(403);
      const response = mockExpressResponse.json.mock.calls[0][0];
      expect(response.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    test('should handle invalid registration data', () => {
      const error = new ValidationError(
        'Registration validation failed',
        {
          email: 'Invalid email format',
          name: 'Name must be at least 2 characters',
          password: 'Password must be at least 8 characters',
        }
      );

      errorHandler.formatAndSend(mockExpressResponse, error, {
        endpoint: '/auth/register',
        method: 'POST',
      });

      expect(mockExpressResponse.status).toHaveBeenCalledWith(400);
      const response = mockExpressResponse.json.mock.calls[0][0];
      expect(response.error.details).toHaveProperty('email');
      expect(response.error.details).toHaveProperty('name');
      expect(response.error.details).toHaveProperty('password');
    });
  });

  describe('Search and Browse Errors', () => {
    test('should handle invalid search parameters', () => {
      const error = new ValidationError(
        'Search parameters invalid',
        {
          date: 'Date must be in future',
          passengers: 'Number of passengers must be positive',
        }
      );

      errorHandler.formatAndSend(mockExpressResponse, error, {
        endpoint: '/buses/search',
        method: 'GET',
        requestData: { from: 'NYC', to: 'BOS', date: '2020-01-01', passengers: -5 },
      });

      expect(mockExpressResponse.status).toHaveBeenCalledWith(400);
      const response = mockExpressResponse.json.mock.calls[0][0];
      expect(response.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    test('should handle bus not found error', () => {
      const error = new NotFoundError(
        'Bus',
        { busId: 'BUS_NONEXISTENT' }
      );

      errorHandler.formatAndSend(mockExpressResponse, error, {
        endpoint: '/buses/BUS_NONEXISTENT',
        method: 'GET',
      });

      expect(mockExpressResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('Payment Processing Errors', () => {
    test('should handle payment failure for cash on trip', () => {
      // Note: Cash on Trip doesn't require payment processing, but other methods might fail
      const error = new BusinessRuleError(
        'Payment method must be valid',
        ERROR_CODES.BUSINESS_RULE_VIOLATION,
        { validMethods: ['online', 'cash_on_trip'], received: 'invalid' }
      );

      errorHandler.formatAndSend(mockExpressResponse, error, {
        userId: 'user123',
        endpoint: '/bookings',
        method: 'POST',
      });

      expect(mockExpressResponse.status).toHaveBeenCalledWith(400);
      const response = mockExpressResponse.json.mock.calls[0][0];
      expect(response.error.details.validMethods).toContain('cash_on_trip');
    });
  });

  describe('Error Logging with Context', () => {
    test('should log all important context information', () => {
      const error = new ValidationError('Test error', { field: 'test' });
      const context = {
        userId: 'user123',
        endpoint: '/bookings',
        method: 'POST',
        requestData: { busId: 'BUS123' },
        additionalInfo: { attempt: 2 },
      };

      errorHandler.logError(error, context);

      const logCall = mockLoggerService.error.mock.calls[0];
      const errorInfo = logCall[2];

      expect(errorInfo.context.userId).toBe('user123');
      expect(errorInfo.context.endpoint).toBe('/bookings');
      expect(errorInfo.context.additionalInfo.attempt).toBe(2);
    });

    test('should preserve error details through logging', () => {
      const details = {
        field: 'email',
        value: 'invalid-email',
        pattern: 'user@domain.com',
      };
      const error = new ValidationError('Invalid email', details);

      errorHandler.logError(error);

      const logCall = mockLoggerService.error.mock.calls[0];
      const errorInfo = logCall[2];

      expect(errorInfo.details).toEqual(details);
    });
  });

  describe('Standard Response Format Consistency', () => {
    test('all errors should follow standard response format', () => {
      const errors = [
        new ValidationError('Test'),
        new AuthenticationError('Test'),
        new AuthorizationError('Test'),
        new NotFoundError('Test'),
        new BusinessRuleError('Test'),
        new InsufficientSeatsError('Test'),
      ];

      errors.forEach((error) => {
        const formatted = errorHandler.formatError(error);

        // Standard format checks
        expect(formatted).toHaveProperty('success', false);
        expect(formatted).toHaveProperty('error');
        expect(formatted.error).toHaveProperty('code');
        expect(formatted.error).toHaveProperty('message');
        expect(formatted.error).toHaveProperty('statusCode');
        expect(formatted.error).toHaveProperty('details');

        // Type checks
        expect(typeof formatted.error.code).toBe('string');
        expect(typeof formatted.error.message).toBe('string');
        expect(typeof formatted.error.statusCode).toBe('number');
        expect(typeof formatted.error.details).toBe('object');
      });
    });
  });

  describe('Generic Error Handling', () => {
    test('should gracefully handle unexpected error type', () => {
      const unknownError = new Error('Unknown error from third-party library');
      const formatted = errorHandler.formatError(unknownError);

      expect(formatted.success).toBe(false);
      expect(formatted.error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
      expect(formatted.error.statusCode).toBe(500);
    });

    test('should handle error with no properties', () => {
      const error = {};
      const formatted = errorHandler.formatError(error);

      expect(formatted.success).toBe(false);
      expect(formatted.error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Error Factory Usage', () => {
    test('should create and throw validation errors programmatically', () => {
      const createBookingError = () => {
        throw errorHandler.createError(
          ERROR_CODES.VALIDATION_ERROR,
          'Cannot create booking with empty seats',
          { seats: 'At least one seat must be selected' }
        );
      };

      expect(createBookingError).toThrow();
      
      try {
        createBookingError();
      } catch (error) {
        const formatted = errorHandler.formatError(error);
        expect(formatted.error.statusCode).toBe(400);
        expect(formatted.error.details.seats).toBeDefined();
      }
    });

    test('should create authorization errors programmatically', () => {
      const userId = 'attacker';
      const bookingOwnerId = 'victim';

      if (userId !== bookingOwnerId) {
        const error = errorHandler.createError(
          ERROR_CODES.FORBIDDEN,
          'You cannot access this booking',
          { userId, bookingOwnerId }
        );

        const formatted = errorHandler.formatError(error);
        expect(formatted.error.statusCode).toBe(403);
        expect(formatted.error.details.userId).toBe('attacker');
      }
    });
  });
});
