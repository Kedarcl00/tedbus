/**
 * Unit tests for validation utilities
 * Tests email, booking data, user data, and seat number validation
 * Validates structured error details and error codes
 */

const {
  validateEmail,
  validateBookingData,
  validateUserData,
  validateSeatNumbers,
} = require('./validators');

const { ValidationError } = require('./custom-errors');

describe('Validation Utilities', () => {
  // ============================================================================
  // Email Validation Tests
  // ============================================================================
  describe('validateEmail', () => {
    describe('valid emails', () => {
      test('should accept standard email format', () => {
        expect(() => validateEmail('user@example.com')).not.toThrow();
      });

      test('should accept email with subdomain', () => {
        expect(() => validateEmail('user@mail.example.co.uk')).not.toThrow();
      });

      test('should accept email with numbers', () => {
        expect(() => validateEmail('user123@example123.com')).not.toThrow();
      });

      test('should accept email with dots in local part', () => {
        expect(() => validateEmail('first.last@example.com')).not.toThrow();
      });

      test('should accept email with hyphens in domain', () => {
        expect(() => validateEmail('user@ex-ample.com')).not.toThrow();
      });

      test('should accept email with underscores', () => {
        expect(() => validateEmail('user_name@example.com')).not.toThrow();
      });

      test('should accept email with plus sign', () => {
        expect(() => validateEmail('user+tag@example.com')).not.toThrow();
      });
    });

    describe('invalid emails', () => {
      test('should reject email without @ symbol', () => {
        expect(() => validateEmail('user.example.com')).toThrow(ValidationError);
        try {
          validateEmail('user.example.com');
        } catch (error) {
          expect(error.details.email).toContain('invalid');
        }
      });

      test('should reject email without local part', () => {
        expect(() => validateEmail('@example.com')).toThrow(ValidationError);
      });

      test('should reject email without domain', () => {
        expect(() => validateEmail('user@')).toThrow(ValidationError);
      });

      test('should reject email without TLD', () => {
        expect(() => validateEmail('user@example')).toThrow(ValidationError);
      });

      test('should reject empty email', () => {
        expect(() => validateEmail('')).toThrow(ValidationError);
        try {
          validateEmail('');
        } catch (error) {
          expect(error.details.email).toContain('required');
        }
      });

      test('should reject null email', () => {
        expect(() => validateEmail(null)).toThrow(ValidationError);
      });

      test('should reject undefined email', () => {
        expect(() => validateEmail(undefined)).toThrow(ValidationError);
      });

      test('should reject email with spaces', () => {
        expect(() => validateEmail('user @example.com')).toThrow(ValidationError);
      });

      test('should reject email that exceeds RFC 5321 max length (254)', () => {
        const longEmail = 'a'.repeat(250) + '@example.com';
        expect(() => validateEmail(longEmail)).toThrow(ValidationError);
        try {
          validateEmail(longEmail);
        } catch (error) {
          expect(error.details.email).toContain('too long');
        }
      });

      test('should reject email with local part > 64 characters', () => {
        const longLocal = 'a'.repeat(65) + '@example.com';
        expect(() => validateEmail(longLocal)).toThrow(ValidationError);
      });
    });

    describe('error details', () => {
      test('should return error code VALIDATION_ERROR', () => {
        try {
          validateEmail('invalid');
        } catch (error) {
          expect(error.code).toBe('VALIDATION_ERROR');
        }
      });

      test('should return status code 400', () => {
        try {
          validateEmail('invalid');
        } catch (error) {
          expect(error.statusCode).toBe(400);
        }
      });

      test('should include field-specific details', () => {
        try {
          validateEmail('invalid-email');
        } catch (error) {
          expect(error.details).toBeDefined();
          expect(error.details.email).toBeDefined();
        }
      });
    });
  });

  // ============================================================================
  // Booking Data Validation Tests
  // ============================================================================
  describe('validateBookingData', () => {
    const validBookingData = {
      busId: 'BUS001',
      routeId: 'ROUTE_NYC_BOS',
      seats: [12, 13, 14],
      passengers: [
        { name: 'John Doe', age: 25 },
        { name: 'Jane Smith', age: 30 },
        { name: 'Bob Johnson', age: 45 },
      ],
      fare: 135.97,
      paymentMethod: 'cash_on_trip',
    };

    describe('valid booking data', () => {
      test('should accept valid complete booking data', () => {
        expect(() => validateBookingData(validBookingData)).not.toThrow();
      });

      test('should accept booking with payment method "online"', () => {
        const data = { ...validBookingData, paymentMethod: 'online' };
        expect(() => validateBookingData(data)).not.toThrow();
      });

      test('should accept booking with single seat and passenger', () => {
        const data = {
          busId: 'BUS001',
          routeId: 'ROUTE_NYC_BOS',
          seats: [5],
          passengers: [{ name: 'John Doe', age: 25 }],
          fare: 50.00,
          paymentMethod: 'cash_on_trip',
        };
        expect(() => validateBookingData(data)).not.toThrow();
      });

      test('should accept booking with multiple seats', () => {
        const data = {
          ...validBookingData,
          seats: [1, 2, 3, 4, 5],
          passengers: [
            { name: 'P1' },
            { name: 'P2' },
            { name: 'P3' },
            { name: 'P4' },
            { name: 'P5' },
          ],
        };
        expect(() => validateBookingData(data)).not.toThrow();
      });

      test('should accept fare with many decimal places', () => {
        const data = { ...validBookingData, fare: 99.99 };
        expect(() => validateBookingData(data)).not.toThrow();
      });

      test('should accept passenger with minimal data', () => {
        const data = {
          ...validBookingData,
          passengers: [{ name: 'John' }],
          seats: [10],
        };
        expect(() => validateBookingData(data)).not.toThrow();
      });
    });

    describe('invalid busId', () => {
      test('should reject empty busId', () => {
        const data = { ...validBookingData, busId: '' };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
        try {
          validateBookingData(data);
        } catch (error) {
          expect(error.details.busId).toBeDefined();
        }
      });

      test('should reject null busId', () => {
        const data = { ...validBookingData, busId: null };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject undefined busId', () => {
        const data = { ...validBookingData };
        delete data.busId;
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject non-string busId', () => {
        const data = { ...validBookingData, busId: 12345 };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });
    });

    describe('invalid routeId', () => {
      test('should reject empty routeId', () => {
        const data = { ...validBookingData, routeId: '' };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
        try {
          validateBookingData(data);
        } catch (error) {
          expect(error.details.routeId).toBeDefined();
        }
      });

      test('should reject null routeId', () => {
        const data = { ...validBookingData, routeId: null };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject non-string routeId', () => {
        const data = { ...validBookingData, routeId: 12345 };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });
    });

    describe('invalid seats', () => {
      test('should reject empty seats array', () => {
        const data = { ...validBookingData, seats: [] };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
        try {
          validateBookingData(data);
        } catch (error) {
          expect(error.details.seats).toBeDefined();
        }
      });

      test('should reject null seats', () => {
        const data = { ...validBookingData, seats: null };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject non-array seats', () => {
        const data = { ...validBookingData, seats: '12,13,14' };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject non-integer seats', () => {
        const data = { ...validBookingData, seats: [12.5, 13, 14] };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject negative seat numbers', () => {
        const data = { ...validBookingData, seats: [-1, 12, 13] };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject zero seat numbers', () => {
        const data = { ...validBookingData, seats: [0, 12, 13] };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject duplicate seat numbers', () => {
        const data = {
          ...validBookingData,
          seats: [12, 13, 12],
          passengers: [{ name: 'P1' }, { name: 'P2' }, { name: 'P3' }],
        };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
        try {
          validateBookingData(data);
        } catch (error) {
          expect(error.details.seats).toContain('Duplicate');
        }
      });

      test('should reject string seat numbers', () => {
        const data = { ...validBookingData, seats: ['12', '13', '14'] };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });
    });

    describe('invalid passengers', () => {
      test('should reject empty passengers array', () => {
        const data = { ...validBookingData, passengers: [] };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
        try {
          validateBookingData(data);
        } catch (error) {
          expect(error.details.passengers).toBeDefined();
        }
      });

      test('should reject null passengers', () => {
        const data = { ...validBookingData, passengers: null };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject non-array passengers', () => {
        const data = { ...validBookingData, passengers: 'passenger1' };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject passengers with empty name', () => {
        const data = {
          ...validBookingData,
          passengers: [{ name: '' }, { name: 'Jane' }, { name: 'Bob' }],
        };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject passengers without name field', () => {
        const data = {
          ...validBookingData,
          passengers: [{ age: 25 }, { name: 'Jane' }, { name: 'Bob' }],
        };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject non-string passenger names', () => {
        const data = {
          ...validBookingData,
          passengers: [{ name: 123 }, { name: 'Jane' }, { name: 'Bob' }],
        };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });
    });

    describe('invalid fare', () => {
      test('should reject null fare', () => {
        const data = { ...validBookingData, fare: null };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject undefined fare', () => {
        const data = { ...validBookingData };
        delete data.fare;
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject zero fare', () => {
        const data = { ...validBookingData, fare: 0 };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject negative fare', () => {
        const data = { ...validBookingData, fare: -50 };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject non-numeric fare', () => {
        const data = { ...validBookingData, fare: 'fifty' };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });
    });

    describe('invalid paymentMethod', () => {
      test('should reject null paymentMethod', () => {
        const data = { ...validBookingData, paymentMethod: null };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject undefined paymentMethod', () => {
        const data = { ...validBookingData };
        delete data.paymentMethod;
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });

      test('should reject invalid paymentMethod', () => {
        const data = { ...validBookingData, paymentMethod: 'credit_card' };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
        try {
          validateBookingData(data);
        } catch (error) {
          expect(error.details.paymentMethod).toContain('must be one of');
        }
      });

      test('should reject non-string paymentMethod', () => {
        const data = { ...validBookingData, paymentMethod: 123 };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
      });
    });

    describe('seat-passenger mismatch', () => {
      test('should reject if seat count != passenger count', () => {
        const data = {
          ...validBookingData,
          seats: [12, 13],
          passengers: [{ name: 'John' }, { name: 'Jane' }, { name: 'Bob' }],
        };
        expect(() => validateBookingData(data)).toThrow(ValidationError);
        try {
          validateBookingData(data);
        } catch (error) {
          expect(error.details.booking).toContain('must match');
        }
      });
    });

    describe('invalid input type', () => {
      test('should reject null bookingData', () => {
        expect(() => validateBookingData(null)).toThrow(ValidationError);
      });

      test('should reject undefined bookingData', () => {
        expect(() => validateBookingData(undefined)).toThrow(ValidationError);
      });

      test('should reject non-object bookingData', () => {
        expect(() => validateBookingData('booking')).toThrow(ValidationError);
      });

      test('should reject array as bookingData', () => {
        expect(() => validateBookingData([])).toThrow(ValidationError);
      });
    });

    describe('error details', () => {
      test('should return error code VALIDATION_ERROR', () => {
        try {
          validateBookingData({
            busId: 'BUS001',
            routeId: 'ROUTE_NYC_BOS',
            seats: [],
            passengers: [{ name: 'John' }],
            fare: 50,
            paymentMethod: 'cash_on_trip',
          });
        } catch (error) {
          expect(error.code).toBe('VALIDATION_ERROR');
        }
      });

      test('should return status code 400', () => {
        try {
          validateBookingData(validBookingData);
        } catch (error) {
          // Should not throw, but if it does...
        }
        try {
          validateBookingData({ busId: '' });
        } catch (error) {
          expect(error.statusCode).toBe(400);
        }
      });

      test('should include multiple field-specific details', () => {
        try {
          validateBookingData({
            busId: '',
            routeId: '',
            seats: [],
            passengers: [],
            fare: -1,
            paymentMethod: 'invalid',
          });
        } catch (error) {
          expect(Object.keys(error.details).length).toBeGreaterThan(1);
        }
      });
    });
  });

  // ============================================================================
  // User Data Validation Tests
  // ============================================================================
  describe('validateUserData', () => {
    const validUserData = {
      name: 'John Doe',
      email: 'john@example.com',
      googleId: '123456789',
    };

    describe('valid user data', () => {
      test('should accept valid user data with googleId', () => {
        expect(() => validateUserData(validUserData)).not.toThrow();
      });

      test('should accept user data without googleId', () => {
        const data = { name: 'John Doe', email: 'john@example.com' };
        expect(() => validateUserData(data)).not.toThrow();
      });

      test('should accept user data with null googleId', () => {
        const data = { ...validUserData, googleId: null };
        expect(() => validateUserData(data)).not.toThrow();
      });

      test('should accept user data with various name formats', () => {
        const names = ['John', 'John Doe', 'Jean-Pierre Dupont', 'José María'];
        names.forEach(name => {
          expect(() => validateUserData({ ...validUserData, name })).not.toThrow();
        });
      });

      test('should accept user data with different email formats', () => {
        const emails = [
          'user@example.com',
          'user+tag@example.co.uk',
          'first.last@example.com',
        ];
        emails.forEach(email => {
          expect(() => validateUserData({ ...validUserData, email })).not.toThrow();
        });
      });
    });

    describe('invalid name', () => {
      test('should reject empty name', () => {
        const data = { ...validUserData, name: '' };
        expect(() => validateUserData(data)).toThrow(ValidationError);
        try {
          validateUserData(data);
        } catch (error) {
          expect(error.details.name).toBeDefined();
        }
      });

      test('should reject null name', () => {
        const data = { ...validUserData, name: null };
        expect(() => validateUserData(data)).toThrow(ValidationError);
      });

      test('should reject undefined name', () => {
        const data = { ...validUserData };
        delete data.name;
        expect(() => validateUserData(data)).toThrow(ValidationError);
      });

      test('should reject non-string name', () => {
        const data = { ...validUserData, name: 123 };
        expect(() => validateUserData(data)).toThrow(ValidationError);
      });

      test('should reject name exceeding 100 characters', () => {
        const data = { ...validUserData, name: 'a'.repeat(101) };
        expect(() => validateUserData(data)).toThrow(ValidationError);
        try {
          validateUserData(data);
        } catch (error) {
          expect(error.details.name).toContain('100 characters');
        }
      });

      test('should accept name with exactly 100 characters', () => {
        const data = { ...validUserData, name: 'a'.repeat(100) };
        expect(() => validateUserData(data)).not.toThrow();
      });
    });

    describe('invalid email', () => {
      test('should reject empty email', () => {
        const data = { ...validUserData, email: '' };
        expect(() => validateUserData(data)).toThrow(ValidationError);
      });

      test('should reject null email', () => {
        const data = { ...validUserData, email: null };
        expect(() => validateUserData(data)).toThrow(ValidationError);
      });

      test('should reject undefined email', () => {
        const data = { ...validUserData };
        delete data.email;
        expect(() => validateUserData(data)).toThrow(ValidationError);
      });

      test('should reject invalid email format', () => {
        const data = { ...validUserData, email: 'invalid-email' };
        expect(() => validateUserData(data)).toThrow(ValidationError);
      });

      test('should reject non-string email', () => {
        const data = { ...validUserData, email: 123 };
        expect(() => validateUserData(data)).toThrow(ValidationError);
      });
    });

    describe('invalid googleId', () => {
      test('should reject empty googleId if provided', () => {
        const data = { ...validUserData, googleId: '' };
        expect(() => validateUserData(data)).toThrow(ValidationError);
        try {
          validateUserData(data);
        } catch (error) {
          expect(error.details.googleId).toBeDefined();
        }
      });

      test('should reject non-string googleId', () => {
        const data = { ...validUserData, googleId: 123456789 };
        expect(() => validateUserData(data)).toThrow(ValidationError);
      });

      test('should accept googleId with undefined', () => {
        const data = { ...validUserData };
        delete data.googleId;
        expect(() => validateUserData(data)).not.toThrow();
      });
    });

    describe('invalid input type', () => {
      test('should reject null userData', () => {
        expect(() => validateUserData(null)).toThrow(ValidationError);
      });

      test('should reject undefined userData', () => {
        expect(() => validateUserData(undefined)).toThrow(ValidationError);
      });

      test('should reject non-object userData', () => {
        expect(() => validateUserData('user')).toThrow(ValidationError);
      });

      test('should reject array as userData', () => {
        expect(() => validateUserData([])).toThrow(ValidationError);
      });
    });

    describe('error details', () => {
      test('should return error code VALIDATION_ERROR', () => {
        try {
          validateUserData({ name: '', email: '', googleId: '' });
        } catch (error) {
          expect(error.code).toBe('VALIDATION_ERROR');
        }
      });

      test('should return status code 400', () => {
        try {
          validateUserData({ name: '' });
        } catch (error) {
          expect(error.statusCode).toBe(400);
        }
      });

      test('should include field-specific details', () => {
        try {
          validateUserData({ name: '', email: '' });
        } catch (error) {
          expect(error.details.name).toBeDefined();
          expect(error.details.email).toBeDefined();
        }
      });
    });
  });

  // ============================================================================
  // Seat Number Validation Tests
  // ============================================================================
  describe('validateSeatNumbers', () => {
    const totalSeats = 50;

    describe('valid seat numbers', () => {
      test('should accept valid seat numbers', () => {
        expect(() => validateSeatNumbers([12, 13, 14], totalSeats)).not.toThrow();
      });

      test('should accept single seat', () => {
        expect(() => validateSeatNumbers([1], totalSeats)).not.toThrow();
      });

      test('should accept first seat', () => {
        expect(() => validateSeatNumbers([1], totalSeats)).not.toThrow();
      });

      test('should accept last seat', () => {
        expect(() => validateSeatNumbers([50], totalSeats)).not.toThrow();
      });

      test('should accept multiple valid seats', () => {
        expect(() => validateSeatNumbers([1, 2, 3, 4, 5], totalSeats)).not.toThrow();
      });

      test('should accept non-sequential seats', () => {
        expect(() => validateSeatNumbers([1, 25, 50], totalSeats)).not.toThrow();
      });
    });

    describe('invalid seat numbers', () => {
      test('should reject empty seat array', () => {
        expect(() => validateSeatNumbers([], totalSeats)).toThrow(ValidationError);
        try {
          validateSeatNumbers([], totalSeats);
        } catch (error) {
          expect(error.details.seatNumbers).toBeDefined();
        }
      });

      test('should reject null seat numbers', () => {
        expect(() => validateSeatNumbers(null, totalSeats)).toThrow(ValidationError);
      });

      test('should reject non-array seats', () => {
        expect(() => validateSeatNumbers('12,13,14', totalSeats)).toThrow(ValidationError);
      });

      test('should reject seat number zero', () => {
        expect(() => validateSeatNumbers([0, 12, 13], totalSeats)).toThrow(ValidationError);
        try {
          validateSeatNumbers([0, 12, 13], totalSeats);
        } catch (error) {
          expect(error.details.seatNumbers).toContain('Invalid');
        }
      });

      test('should reject negative seat numbers', () => {
        expect(() => validateSeatNumbers([-1, 12, 13], totalSeats)).toThrow(ValidationError);
      });

      test('should reject non-integer seats', () => {
        expect(() => validateSeatNumbers([12.5, 13, 14], totalSeats)).toThrow(ValidationError);
      });

      test('should reject seat numbers beyond total', () => {
        expect(() => validateSeatNumbers([12, 51], totalSeats)).toThrow(ValidationError);
        try {
          validateSeatNumbers([12, 51], totalSeats);
        } catch (error) {
          expect(error.details.seatNumbers).toContain('out of range');
        }
      });

      test('should reject duplicate seat numbers', () => {
        expect(() => validateSeatNumbers([12, 13, 12], totalSeats)).toThrow(ValidationError);
        try {
          validateSeatNumbers([12, 13, 12], totalSeats);
        } catch (error) {
          expect(error.details.seatNumbers).toContain('Duplicate');
        }
      });

      test('should reject string seat numbers', () => {
        expect(() => validateSeatNumbers(['12', '13'], totalSeats)).toThrow(ValidationError);
      });

      test('should reject mixed valid and invalid seats', () => {
        expect(() => validateSeatNumbers([12, 0, 13], totalSeats)).toThrow(ValidationError);
      });
    });

    describe('invalid total seats', () => {
      test('should reject null totalSeats', () => {
        expect(() => validateSeatNumbers([1, 2], null)).toThrow(ValidationError);
      });

      test('should reject undefined totalSeats', () => {
        expect(() => validateSeatNumbers([1, 2], undefined)).toThrow(ValidationError);
      });

      test('should reject zero totalSeats', () => {
        expect(() => validateSeatNumbers([1], 0)).toThrow(ValidationError);
      });

      test('should reject negative totalSeats', () => {
        expect(() => validateSeatNumbers([1], -50)).toThrow(ValidationError);
      });

      test('should reject non-integer totalSeats', () => {
        expect(() => validateSeatNumbers([1], 50.5)).toThrow(ValidationError);
      });

      test('should reject non-numeric totalSeats', () => {
        expect(() => validateSeatNumbers([1], 'fifty')).toThrow(ValidationError);
      });
    });

    describe('edge cases', () => {
      test('should work with different total seat counts', () => {
        expect(() => validateSeatNumbers([1, 2], 2)).not.toThrow();
        expect(() => validateSeatNumbers([1], 1)).not.toThrow();
        expect(() => validateSeatNumbers([50], 100)).not.toThrow();
      });

      test('should reject seat exceeding small bus size', () => {
        const smallBusSeats = 20;
        expect(() => validateSeatNumbers([21], smallBusSeats)).toThrow(ValidationError);
      });

      test('should reject all seats exceeding bus size', () => {
        expect(() => validateSeatNumbers([51, 52, 53], 50)).toThrow(ValidationError);
      });
    });

    describe('error details', () => {
      test('should return error code VALIDATION_ERROR', () => {
        try {
          validateSeatNumbers([], totalSeats);
        } catch (error) {
          expect(error.code).toBe('VALIDATION_ERROR');
        }
      });

      test('should return status code 400', () => {
        try {
          validateSeatNumbers([0], totalSeats);
        } catch (error) {
          expect(error.statusCode).toBe(400);
        }
      });

      test('should include field-specific details in seatNumbers', () => {
        try {
          validateSeatNumbers([-1, 51], totalSeats);
        } catch (error) {
          expect(error.details.seatNumbers).toBeDefined();
        }
      });
    });
  });

  // ============================================================================
  // Integration Tests - Error Structure
  // ============================================================================
  describe('Error Structure and Consistency', () => {
    test('all validators should throw ValidationError on invalid input', () => {
      expect(() => validateEmail('invalid')).toThrow(ValidationError);
      expect(() => validateBookingData(null)).toThrow(ValidationError);
      expect(() => validateUserData({ name: '' })).toThrow(ValidationError);
      expect(() => validateSeatNumbers([0], 50)).toThrow(ValidationError);
    });

    test('ValidationError should include details object', () => {
      const validators = [
        { fn: validateEmail, arg: 'invalid' },
        { fn: validateBookingData, arg: { busId: '' } },
        { fn: validateUserData, arg: { name: '' } },
        { fn: validateSeatNumbers, arg: [[0], 50] },
      ];

      validators.forEach(({ fn, arg }) => {
        try {
          Array.isArray(arg) ? fn(...arg) : fn(arg);
        } catch (error) {
          expect(error.details).toBeDefined();
          expect(typeof error.details).toBe('object');
        }
      });
    });

    test('ValidationError should have correct status code and code', () => {
      try {
        validateEmail('invalid');
      } catch (error) {
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('VALIDATION_ERROR');
      }
    });

    test('ValidationError should be an instance of Error', () => {
      try {
        validateEmail('invalid');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
      }
    });

    test('ValidationError should have message and timestamp', () => {
      try {
        validateEmail('invalid');
      } catch (error) {
        expect(error.message).toBeDefined();
        expect(error.timestamp).toBeDefined();
      }
    });
  });
});
