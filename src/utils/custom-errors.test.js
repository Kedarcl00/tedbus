/**
 * Unit tests for custom error classes
 * Validates error hierarchy, stack trace capture, and formatting
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
} = require('./custom-errors');

describe('Custom Error Classes', () => {
  // ServiceError base class tests
  describe('ServiceError', () => {
    test('should create error with all properties', () => {
      const error = new ServiceError(
        'TEST_ERROR',
        'Test message',
        500,
        { field: 'value' }
      );

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ field: 'value' });
      expect(error.name).toBe('ServiceError');
      expect(error.timestamp).toBeDefined();
    });

    test('should capture stack trace', () => {
      const error = new ServiceError('TEST', 'Message');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ServiceError');
    });

    test('should use default statusCode of 500', () => {
      const error = new ServiceError('TEST', 'Message');
      expect(error.statusCode).toBe(500);
    });

    test('should have empty details by default', () => {
      const error = new ServiceError('TEST', 'Message');
      expect(error.details).toEqual({});
    });

    test('should convert to JSON format', () => {
      const error = new ServiceError('TEST', 'Message', 400, { key: 'value' });
      const json = error.toJSON();

      expect(json).toEqual({
        code: 'TEST',
        message: 'Message',
        statusCode: 400,
        details: { key: 'value' },
        timestamp: expect.any(String),
      });
    });

    test('should be an instance of Error', () => {
      const error = new ServiceError('TEST', 'Message');
      expect(error instanceof Error).toBe(true);
    });
  });

  // ValidationError tests
  describe('ValidationError', () => {
    test('should return 400 status code', () => {
      const error = new ValidationError('Invalid email format');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    test('should include field-specific details', () => {
      const details = {
        email: 'Invalid email format',
        password: 'Password too short',
      };
      const error = new ValidationError('Validation failed', details);

      expect(error.details).toEqual(details);
    });

    test('should have default message', () => {
      const error = new ValidationError();
      expect(error.message).toBe('Validation failed');
    });

    test('should format correctly to JSON', () => {
      const error = new ValidationError('Invalid data', { field: 'error' });
      const json = error.toJSON();

      expect(json.statusCode).toBe(400);
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.details).toEqual({ field: 'error' });
    });
  });

  // AuthenticationError tests
  describe('AuthenticationError', () => {
    test('should return 401 status code', () => {
      const error = new AuthenticationError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    test('should have default message', () => {
      const error = new AuthenticationError();
      expect(error.message).toBe('Authentication required');
    });

    test('should accept custom message', () => {
      const error = new AuthenticationError('Session expired');
      expect(error.message).toBe('Session expired');
    });

    test('should have empty details by default', () => {
      const error = new AuthenticationError();
      expect(error.details).toEqual({});
    });
  });

  // AuthorizationError tests
  describe('AuthorizationError', () => {
    test('should return 403 status code', () => {
      const error = new AuthorizationError();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    test('should have default message', () => {
      const error = new AuthorizationError();
      expect(error.message).toBe('Insufficient permissions');
    });

    test('should accept custom message', () => {
      const error = new AuthorizationError('User not owner of booking');
      expect(error.message).toBe('User not owner of booking');
    });
  });

  // NotFoundError tests
  describe('NotFoundError', () => {
    test('should return 404 status code', () => {
      const error = new NotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    test('should include resource name in message', () => {
      const error = new NotFoundError('Booking');
      expect(error.message).toBe('Booking not found');
    });

    test('should have default resource name', () => {
      const error = new NotFoundError();
      expect(error.message).toBe('Resource not found');
    });

    test('should accept details parameter', () => {
      const error = new NotFoundError('User', { userId: '12345' });
      expect(error.details).toEqual({ userId: '12345' });
    });

    test('should format correctly with various resource types', () => {
      const resources = ['Bus', 'Route', 'Booking', 'User'];
      resources.forEach(resource => {
        const error = new NotFoundError(resource);
        expect(error.message).toBe(`${resource} not found`);
      });
    });
  });

  // BusinessRuleError tests
  describe('BusinessRuleError', () => {
    test('should return 400 status code', () => {
      const error = new BusinessRuleError('Seats unavailable');
      expect(error.statusCode).toBe(400);
    });

    test('should use default business rule code', () => {
      const error = new BusinessRuleError('Some violation');
      expect(error.code).toBe(ERROR_CODES.BUSINESS_RULE_VIOLATION);
    });

    test('should accept custom error code', () => {
      const error = new BusinessRuleError(
        'No seats available',
        ERROR_CODES.INSUFFICIENT_SEATS
      );
      expect(error.code).toBe(ERROR_CODES.INSUFFICIENT_SEATS);
    });

    test('should accept details parameter', () => {
      const details = { availableSeats: 0, requestedSeats: 5 };
      const error = new BusinessRuleError(
        'Insufficient seats',
        ERROR_CODES.BUSINESS_RULE_VIOLATION,
        details
      );
      expect(error.details).toEqual(details);
    });
  });

  // ConflictError tests
  describe('ConflictError', () => {
    test('should return 409 status code', () => {
      const error = new ConflictError('Email already registered');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe(ERROR_CODES.CONFLICT);
    });

    test('should accept details parameter', () => {
      const error = new ConflictError('Email exists', { email: 'test@example.com' });
      expect(error.details).toEqual({ email: 'test@example.com' });
    });
  });

  // InsufficientSeatsError tests
  describe('InsufficientSeatsError', () => {
    test('should return 400 status code', () => {
      const error = new InsufficientSeatsError();
      expect(error.statusCode).toBe(400);
    });

    test('should use INSUFFICIENT_SEATS error code', () => {
      const error = new InsufficientSeatsError();
      expect(error.code).toBe(ERROR_CODES.INSUFFICIENT_SEATS);
    });

    test('should have default message', () => {
      const error = new InsufficientSeatsError();
      expect(error.message).toBe('Insufficient seats available');
    });

    test('should accept custom message', () => {
      const error = new InsufficientSeatsError('Only 2 seats available, requested 5');
      expect(error.message).toBe('Only 2 seats available, requested 5');
    });

    test('should include seat availability details', () => {
      const details = { available: 2, requested: 5 };
      const error = new InsufficientSeatsError(
        'Not enough seats',
        details
      );
      expect(error.details).toEqual(details);
    });
  });

  // PaymentError tests
  describe('PaymentError', () => {
    test('should return 400 status code', () => {
      const error = new PaymentError();
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ERROR_CODES.PAYMENT_ERROR);
    });

    test('should have default message', () => {
      const error = new PaymentError();
      expect(error.message).toBe('Payment processing failed');
    });

    test('should accept custom message', () => {
      const error = new PaymentError('Card declined');
      expect(error.message).toBe('Card declined');
    });
  });

  // EmailError tests
  describe('EmailError', () => {
    test('should return 500 status code', () => {
      const error = new EmailError();
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ERROR_CODES.EMAIL_ERROR);
    });

    test('should have default message', () => {
      const error = new EmailError();
      expect(error.message).toBe('Email sending failed');
    });

    test('should accept custom message', () => {
      const error = new EmailError('SMTP connection timeout');
      expect(error.message).toBe('SMTP connection timeout');
    });
  });

  // Error codes constant tests
  describe('ERROR_CODES constant', () => {
    test('should have all required error codes', () => {
      const requiredCodes = [
        'VALIDATION_ERROR',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'BUSINESS_RULE_VIOLATION',
        'CONFLICT',
        'INTERNAL_SERVER_ERROR',
        'INSUFFICIENT_SEATS',
        'PAYMENT_ERROR',
        'EMAIL_ERROR',
      ];

      requiredCodes.forEach(code => {
        expect(ERROR_CODES[code]).toBe(code);
      });
    });

    test('should have consistent error code values', () => {
      expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ERROR_CODES.FORBIDDEN).toBe('FORBIDDEN');
      expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
    });
  });

  // Integration tests with multiple errors
  describe('Error hierarchy and compatibility', () => {
    test('all custom errors should be instances of Error', () => {
      const errors = [
        new ValidationError(),
        new AuthenticationError(),
        new AuthorizationError(),
        new NotFoundError(),
        new BusinessRuleError('test'),
        new ConflictError('test'),
        new InsufficientSeatsError(),
        new PaymentError(),
        new EmailError(),
      ];

      errors.forEach(error => {
        expect(error instanceof Error).toBe(true);
      });
    });

    test('all custom errors should be instances of ServiceError', () => {
      const errors = [
        new ValidationError(),
        new AuthenticationError(),
        new AuthorizationError(),
        new NotFoundError(),
        new BusinessRuleError('test'),
        new ConflictError('test'),
        new InsufficientSeatsError(),
        new PaymentError(),
        new EmailError(),
      ];

      errors.forEach(error => {
        expect(error instanceof ServiceError).toBe(true);
      });
    });

    test('should be able to catch by ServiceError type', () => {
      const errors = [
        new ValidationError(),
        new NotFoundError(),
        new BusinessRuleError('test'),
      ];

      try {
        throw errors[0];
      } catch (error) {
        expect(error instanceof ServiceError).toBe(true);
        expect(error.statusCode).toBe(400);
      }
    });

    test('should handle error throwing and catching', () => {
      const throwError = () => {
        throw new NotFoundError('Booking', { bookingId: 'B123' });
      };

      expect(throwError).toThrow(ServiceError);
      expect(throwError).toThrow(NotFoundError);

      try {
        throwError();
      } catch (error) {
        expect(error.message).toBe('Booking not found');
        expect(error.statusCode).toBe(404);
        expect(error.details.bookingId).toBe('B123');
      }
    });
  });

  // Timestamp tests
  describe('Timestamp functionality', () => {
    test('should include ISO timestamp in error', () => {
      const error = new ServiceError('TEST', 'Message');
      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('string');
      // Check it's a valid ISO timestamp
      expect(new Date(error.timestamp).getTime()).toBeGreaterThan(0);
    });

    test('different errors should have different timestamps', (done) => {
      const error1 = new ServiceError('TEST1', 'Message1');
      setTimeout(() => {
        const error2 = new ServiceError('TEST2', 'Message2');
        expect(error2.timestamp).not.toBe(error1.timestamp);
        done();
      }, 10);
    });
  });
});
