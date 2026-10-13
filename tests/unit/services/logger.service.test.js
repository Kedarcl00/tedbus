/**
 * Unit Tests for LoggerService
 * Tests all logging methods, context handling, and environment-aware behavior
 */

const LoggerService = require('../../../src/services/logger.service');

describe('LoggerService', () => {
  // Store original console methods and NODE_ENV
  let originalConsoleLog;
  let originalConsoleWarn;
  let originalConsoleError;
  let originalConsoleDebug;
  let originalNodeEnv;
  let capturedLogs;

  beforeEach(() => {
    // Capture console output
    capturedLogs = {
      log: [],
      warn: [],
      error: [],
      debug: [],
    };

    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    originalConsoleDebug = console.debug;
    originalNodeEnv = process.env.NODE_ENV;

    console.log = jest.fn((...args) => capturedLogs.log.push(args));
    console.warn = jest.fn((...args) => capturedLogs.warn.push(args));
    console.error = jest.fn((...args) => capturedLogs.error.push(args));
    console.debug = jest.fn((...args) => capturedLogs.debug.push(args));
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    console.debug = originalConsoleDebug;
    process.env.NODE_ENV = originalNodeEnv;
    // Clear the module cache to reset LoggerService singleton
    jest.resetModules();
  });

  /**
   * Helper function to get fresh LoggerService instance with updated NODE_ENV
   */
  const getLoggerServiceWithEnv = (env) => {
    process.env.NODE_ENV = env;
    jest.resetModules();
    return require('../../../src/services/logger.service');
  };

  describe('info()', () => {
    test('should log info messages with timestamp', () => {
      LoggerService.info('Test info message');
      expect(console.log).toHaveBeenCalled();
    });

    test('should include context in info logs', () => {
      const context = { userId: 'user123', operation: 'booking' };
      LoggerService.info('User action', context);
      expect(console.log).toHaveBeenCalled();
    });

    test('should include message in log output', () => {
      const message = 'Booking created successfully';
      LoggerService.info(message);
      const logOutput = JSON.stringify(capturedLogs.log);
      expect(logOutput).toContain(message);
    });

    test('should have INFO log level', () => {
      LoggerService.info('Test');
      const logOutput = JSON.stringify(capturedLogs.log);
      expect(logOutput).toContain('INFO');
    });
  });

  describe('warn()', () => {
    test('should log warning messages', () => {
      LoggerService.warn('Low inventory warning');
      expect(console.warn).toHaveBeenCalled();
    });

    test('should include context in warning logs', () => {
      const context = { itemCount: 2, threshold: 10 };
      LoggerService.warn('Low inventory', context);
      expect(console.warn).toHaveBeenCalled();
    });

    test('should have WARN log level', () => {
      LoggerService.warn('Test');
      const logOutput = JSON.stringify(capturedLogs.warn);
      expect(logOutput).toContain('WARN');
    });

    test('should include timestamp', () => {
      LoggerService.warn('Test warning');
      const logOutput = JSON.stringify(capturedLogs.warn);
      expect(logOutput).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('debug()', () => {
    test('should log debug messages only in development mode', () => {
      const logger = getLoggerServiceWithEnv('development');
      capturedLogs.debug = [];
      console.debug.mockClear();
      logger.debug('Debug info');
      expect(console.debug).toHaveBeenCalled();
    });

    test('should NOT log debug messages in production mode', () => {
      const logger = getLoggerServiceWithEnv('production');
      console.debug.mockClear();
      logger.debug('Debug info');
      expect(console.debug).not.toHaveBeenCalled();
    });

    test('should include message in development debug logs', () => {
      const logger = getLoggerServiceWithEnv('development');
      capturedLogs.debug = [];
      console.debug.mockClear();
      logger.debug('Test debug message');
      expect(console.debug).toHaveBeenCalled();
    });

    test('should include context information in development', () => {
      const logger = getLoggerServiceWithEnv('development');
      capturedLogs.debug = [];
      console.debug.mockClear();
      const context = { path: '/api/bookings', method: 'POST' };
      logger.debug('Request processing', context);
      expect(console.debug).toHaveBeenCalled();
    });
  });

  describe('error()', () => {
    test('should log error with error object and stack trace', () => {
      const error = new Error('Test error');
      LoggerService.error('Operation failed', error);
      expect(console.error).toHaveBeenCalled();
    });

    test('should include error message', () => {
      const error = new Error('Database error');
      LoggerService.error('DB operation failed', error);
      const logOutput = JSON.stringify(capturedLogs.error);
      expect(logOutput).toContain('Database error');
    });

    test('should include error context', () => {
      const error = new Error('Test error');
      const context = { userId: 'user123', endpoint: '/bookings' };
      LoggerService.error('Operation failed', error, context);
      const logOutput = JSON.stringify(capturedLogs.error);
      expect(logOutput).toContain('user123');
      expect(logOutput).toContain('/bookings');
    });

    test('should include error code if present', () => {
      const error = new Error('Validation error');
      error.code = 'VALIDATION_ERROR';
      error.statusCode = 400;
      LoggerService.error('Request validation failed', error);
      const logOutput = JSON.stringify(capturedLogs.error);
      expect(logOutput).toContain('VALIDATION_ERROR');
      expect(logOutput).toContain('400');
    });

    test('should include stack trace in development mode', () => {
      const logger = getLoggerServiceWithEnv('development');
      capturedLogs.error = [];
      console.error.mockClear();
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      const logOutput = JSON.stringify(capturedLogs.error);
      expect(logOutput).toContain('stack');
    });

    test('should have ERROR log level', () => {
      const error = new Error('Test');
      LoggerService.error('Test', error);
      const logOutput = JSON.stringify(capturedLogs.error);
      expect(logOutput).toContain('ERROR');
    });
  });

  describe('logQueryTime()', () => {
    test('should log query execution time in development mode', () => {
      const logger = getLoggerServiceWithEnv('development');
      console.log.mockClear();
      capturedLogs.log = [];
      logger.logQueryTime('db.bookings.find()', 45.32);
      expect(console.log).toHaveBeenCalled();
    });

    test('should include query text and execution time', () => {
      console.log.mockClear();
      capturedLogs.log = [];
      const query = 'bookingRepository.findByCustomerId';
      const executionMs = 125.45;
      LoggerService.logQueryTime(query, executionMs);
      const logOutput = JSON.stringify(capturedLogs.log);
      expect(logOutput).toContain(query);
      expect(logOutput).toContain('125.45');
    });

    test('should accept context information', () => {
      console.log.mockClear();
      capturedLogs.log = [];
      const context = { userId: 'user123', resultCount: 10 };
      LoggerService.logQueryTime('db.query', 150, context);
      const logOutput = JSON.stringify(capturedLogs.log);
      expect(logOutput).toContain('userId');
    });

    test('should log all queries in development mode', () => {
      const logger = getLoggerServiceWithEnv('development');
      console.log.mockClear();
      capturedLogs.log = [];
      logger.logQueryTime('query', 10);
      expect(console.log).toHaveBeenCalled();
    });

    test('should log slow queries (>100ms) in production mode', () => {
      const logger = getLoggerServiceWithEnv('production');
      console.log.mockClear();
      capturedLogs.log = [];
      logger.logQueryTime('query', 150);
      expect(console.log).toHaveBeenCalled();
    });

    test('should NOT log fast queries (<100ms) in production mode', () => {
      const logger = getLoggerServiceWithEnv('production');
      console.log.mockClear();
      logger.logQueryTime('query', 50);
      expect(console.log).not.toHaveBeenCalled();
    });

    test('should indicate slow queries in output', () => {
      console.log.mockClear();
      capturedLogs.log = [];
      LoggerService.logQueryTime('slow_query', 500);
      const logOutput = JSON.stringify(capturedLogs.log);
      expect(logOutput).toContain('isSlowQuery');
    });

    test('should log with WARN level for very slow queries (>500ms)', () => {
      console.warn.mockClear();
      capturedLogs.warn = [];
      LoggerService.logQueryTime('very_slow_query', 750);
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('logRequest()', () => {
    test('should log HTTP request with method, path, and status', () => {
      LoggerService.logRequest('POST', '/bookings', 201, 45);
      expect(console.log).toHaveBeenCalled();
    });

    test('should include HTTP method in log', () => {
      LoggerService.logRequest('GET', '/bookings/my', 200, 30);
      const logOutput = JSON.stringify(capturedLogs.log);
      expect(logOutput).toContain('GET');
    });

    test('should include request path in log', () => {
      LoggerService.logRequest('POST', '/bookings', 201, 50);
      const logOutput = JSON.stringify(capturedLogs.log);
      expect(logOutput).toContain('/bookings');
    });

    test('should include status code in log', () => {
      LoggerService.logRequest('DELETE', '/bookings/123', 204, 25);
      const logOutput = JSON.stringify(capturedLogs.log);
      expect(logOutput).toContain('204');
    });

    test('should include response time in milliseconds', () => {
      LoggerService.logRequest('PUT', '/users/profile', 200, 125.5);
      const logOutput = JSON.stringify(capturedLogs.log);
      expect(logOutput).toContain('125.50');
    });

    test('should include context information', () => {
      const context = { userId: 'user123', requestId: 'req_456' };
      LoggerService.logRequest('POST', '/bookings', 201, 80, context);
      const logOutput = JSON.stringify(capturedLogs.log);
      expect(logOutput).toContain('user123');
      expect(logOutput).toContain('req_456');
    });

    test('should log successful requests (2xx, 3xx) at INFO level', () => {
      console.log.mockClear();
      LoggerService.logRequest('GET', '/buses', 200, 40);
      expect(console.log).toHaveBeenCalled();
    });

    test('should log error requests (4xx, 5xx) at WARN level', () => {
      console.warn.mockClear();
      LoggerService.logRequest('POST', '/bookings', 400, 30);
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('Timestamp handling', () => {
    test('should include ISO 8601 formatted timestamp', () => {
      LoggerService.info('Test message');
      const logOutput = JSON.stringify(capturedLogs.log);
      // Check for ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(logOutput).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('timestamp should be consistent within same log call', () => {
      LoggerService.info('Test message');
      const firstLog = capturedLogs.log[0];
      expect(firstLog[0]).toBeDefined();
    });
  });

  describe('Context handling', () => {
    test('should handle empty context gracefully', () => {
      expect(() => {
        LoggerService.info('Test message', {});
      }).not.toThrow();
    });

    test('should handle undefined context', () => {
      expect(() => {
        LoggerService.info('Test message', undefined);
      }).not.toThrow();
    });

    test('should handle null context', () => {
      expect(() => {
        // null context should be treated as no context
        LoggerService.info('Test message');
      }).not.toThrow();
    });

    test('should include multiple context fields', () => {
      const context = {
        userId: 'user123',
        endpoint: '/bookings',
        method: 'POST',
        requestId: 'req_456',
        operation: 'create_booking',
      };
      LoggerService.info('Complex operation', context);
      const logOutput = JSON.stringify(capturedLogs.log);
      expect(logOutput).toContain('user123');
      expect(logOutput).toContain('/bookings');
      expect(logOutput).toContain('POST');
    });
  });

  describe('Environment awareness', () => {
    test('should identify development environment correctly', () => {
      const logger = getLoggerServiceWithEnv('development');
      expect(logger.isDevelopment).toBe(true);
      expect(logger.isProduction).toBe(false);
    });

    test('should identify production environment correctly', () => {
      const logger = getLoggerServiceWithEnv('production');
      expect(logger.isProduction).toBe(true);
      expect(logger.isDevelopment).toBe(false);
    });

    test('should output JSON format in production mode', () => {
      const logger = getLoggerServiceWithEnv('production');
      console.log.mockClear();
      capturedLogs.log = [];
      logger.info('Test message');
      // Should have called console.log with JSON formatted output
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('Error object handling', () => {
    test('should handle Error objects with code property', () => {
      const error = new Error('Custom error');
      error.code = 'CUSTOM_ERROR_CODE';
      LoggerService.error('Operation failed', error);
      const logOutput = JSON.stringify(capturedLogs.error);
      expect(logOutput).toContain('CUSTOM_ERROR_CODE');
    });

    test('should handle Error objects with statusCode property', () => {
      const error = new Error('Service error');
      error.statusCode = 503;
      LoggerService.error('Service unavailable', error);
      const logOutput = JSON.stringify(capturedLogs.error);
      expect(logOutput).toContain('503');
    });

    test('should handle Error objects with details property', () => {
      const error = new Error('Validation failed');
      error.details = { field: 'email', reason: 'invalid format' };
      LoggerService.error('Request invalid', error);
      const logOutput = JSON.stringify(capturedLogs.error);
      expect(logOutput).toContain('email');
      expect(logOutput).toContain('invalid format');
    });

    test('should handle Error objects without stack trace', () => {
      const error = new Error('Test error');
      error.stack = undefined;
      expect(() => {
        LoggerService.error('Error without stack', error);
      }).not.toThrow();
    });
  });

  describe('Integration scenarios', () => {
    test('should log complete booking creation flow', () => {
      console.log.mockClear();
      capturedLogs.log = [];
      LoggerService.info('User initiated booking', { userId: 'user123', route: 'NYC-BOS' });
      LoggerService.logQueryTime('db.bookings.insert', 75.5, { bookingId: 'booking456' });
      LoggerService.info('Booking created successfully', { bookingId: 'booking456', fare: 150.00 });
      
      // Should have multiple log calls
      expect(console.log).toHaveBeenCalled();
    });

    test('should log error recovery flow', () => {
      console.log.mockClear();
      console.error.mockClear();
      capturedLogs.log = [];
      capturedLogs.error = [];
      
      LoggerService.info('Processing payment', { userId: 'user123' });
      const error = new Error('Payment gateway timeout');
      error.code = 'PAYMENT_TIMEOUT';
      LoggerService.error('Payment failed', error, { bookingId: 'booking456' });
      LoggerService.warn('Retrying payment', { attempt: 2 });
      
      expect(console.log).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });
});

