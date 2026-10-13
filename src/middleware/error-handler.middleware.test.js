/**
 * Error Handler Middleware Tests
 * Tests verify that the middleware catches errors, formats responses, and logs appropriately
 */

const createErrorHandlerMiddleware = require('./error-handler.middleware');
const {
  ServiceError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  BusinessRuleError,
} = require('../utils/custom-errors');

describe('Error Handler Middleware', () => {
  let middleware;
  let mockErrorHandlerService;
  let mockLoggerService;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Reset all mocks before each test
    mockErrorHandlerService = {
      formatError: jest.fn(),
    };

    mockLoggerService = {
      error: jest.fn(),
    };

    mockReq = {
      method: 'POST',
      path: '/bookings',
      originalUrl: 'http://localhost:3000/bookings',
      user: { id: 'user123' },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Create middleware with mocks
    middleware = createErrorHandlerMiddleware(mockErrorHandlerService, mockLoggerService);
  });

  describe('Initialization', () => {
    it('should throw error if ErrorHandlerService is missing', () => {
      expect(() => {
        createErrorHandlerMiddleware(null, mockLoggerService);
      }).toThrow('ErrorHandlerService is required for error handler middleware');
    });

    it('should throw error if LoggerService is missing', () => {
      expect(() => {
        createErrorHandlerMiddleware(mockErrorHandlerService, null);
      }).toThrow('LoggerService is required for error handler middleware');
    });

    it('should create middleware function successfully with both services', () => {
      expect(middleware).toBeInstanceOf(Function);
      expect(middleware.length).toBe(4); // Express error handlers have 4 parameters
    });
  });

  describe('Error Handling', () => {
    it('should format ValidationError and send response with 400 status', () => {
      const error = new ValidationError('Invalid email format', { field: 'email' });

      mockErrorHandlerService.formatError.mockReturnValue({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format',
          statusCode: 400,
          details: { field: 'email' },
        },
      });

      middleware(error, mockReq, mockRes, mockNext);

      expect(mockLoggerService.error).toHaveBeenCalled();
      expect(mockErrorHandlerService.formatError).toHaveBeenCalledWith(error);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format',
          statusCode: 400,
          details: { field: 'email' },
        },
      });
    });

    it('should format AuthenticationError and send response with 401 status', () => {
      const error = new AuthenticationError('Session expired');

      mockErrorHandlerService.formatError.mockReturnValue({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session expired',
          statusCode: 401,
        },
      });

      middleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session expired',
          statusCode: 401,
        },
      });
    });

    it('should format AuthorizationError and send response with 403 status', () => {
      const error = new AuthorizationError('Access denied');

      mockErrorHandlerService.formatError.mockReturnValue({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied',
          statusCode: 403,
        },
      });

      middleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should format NotFoundError and send response with 404 status', () => {
      const error = new NotFoundError('Booking');

      mockErrorHandlerService.formatError.mockReturnValue({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Booking not found',
          statusCode: 404,
        },
      });

      middleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should format BusinessRuleError and send response with 400 status', () => {
      const error = new BusinessRuleError('Insufficient seats available', 'INSUFFICIENT_SEATS');

      mockErrorHandlerService.formatError.mockReturnValue({
        success: false,
        error: {
          code: 'INSUFFICIENT_SEATS',
          message: 'Insufficient seats available',
          statusCode: 400,
        },
      });

      middleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle generic Error objects', () => {
      const error = new Error('Something went wrong');

      mockErrorHandlerService.formatError.mockReturnValue({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          statusCode: 500,
        },
      });

      middleware(error, mockReq, mockRes, mockNext);

      expect(mockErrorHandlerService.formatError).toHaveBeenCalledWith(error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Logging', () => {
    it('should log error with full context', () => {
      const error = new ValidationError('Test error', { field: 'test' });

      mockErrorHandlerService.formatError.mockReturnValue({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Test error',
          statusCode: 400,
          details: { field: 'test' },
        },
      });

      middleware(error, mockReq, mockRes, mockNext);

      expect(mockLoggerService.error).toHaveBeenCalled();
      const callArgs = mockLoggerService.error.mock.calls[0];
      expect(callArgs[0]).toContain('POST /bookings');
      expect(callArgs[1]).toBe(error);
      expect(callArgs[2]).toEqual({
        userId: 'user123',
        method: 'POST',
        endpoint: '/bookings',
        url: 'http://localhost:3000/bookings',
        timestamp: expect.any(String),
      });
    });

    it('should handle logging failures gracefully', () => {
      const error = new Error('Test error');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockLoggerService.error.mockImplementation(() => {
        throw new Error('Logging failed');
      });

      mockErrorHandlerService.formatError.mockReturnValue({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          statusCode: 500,
        },
      });

      middleware(error, mockReq, mockRes, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);

      consoleErrorSpy.mockRestore();
    });

    it('should handle requests without user context', () => {
      const error = new AuthenticationError();
      mockReq.user = null;

      mockErrorHandlerService.formatError.mockReturnValue({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401,
        },
      });

      middleware(error, mockReq, mockRes, mockNext);

      const callArgs = mockLoggerService.error.mock.calls[0];
      expect(callArgs[2].userId).toBeNull();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Response Format', () => {
    it('should always return standardized error response format', () => {
      const error = new ValidationError('Test');

      mockErrorHandlerService.formatError.mockReturnValue({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Test',
          statusCode: 400,
          details: {},
        },
      });

      middleware(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response).toHaveProperty('success', false);
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code');
      expect(response.error).toHaveProperty('message');
      expect(response.error).toHaveProperty('statusCode');
    });

    it('should include details when available', () => {
      const error = new ValidationError('Invalid data', { email: 'Invalid format' });

      mockErrorHandlerService.formatError.mockReturnValue({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid data',
          statusCode: 400,
          details: { email: 'Invalid format' },
        },
      });

      middleware(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.error.details).toEqual({ email: 'Invalid format' });
    });
  });

  describe('Status Codes', () => {
    it('should use status code from formatted error', () => {
      const error = new ValidationError('Test');

      mockErrorHandlerService.formatError.mockReturnValue({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Test',
          statusCode: 400,
          details: {},
        },
      });

      middleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should default to 500 if status code is missing', () => {
      const error = new Error('Test');

      mockErrorHandlerService.formatError.mockReturnValue({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Test',
          statusCode: undefined,
          details: {},
        },
      });

      middleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Integration with Express', () => {
    it('should be recognized as Express error handler (4 parameters)', () => {
      expect(middleware.length).toBe(4);
    });

    it('should not call next middleware', () => {
      const error = new Error('Test');

      mockErrorHandlerService.formatError.mockReturnValue({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Test',
          statusCode: 500,
        },
      });

      middleware(error, mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
