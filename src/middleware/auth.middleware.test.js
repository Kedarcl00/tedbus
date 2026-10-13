/**
 * Tests for Authentication Middleware
 * Validates that the middleware correctly:
 * - Allows public routes without authentication
 * - Validates session for protected routes
 * - Attaches user ID to request
 * - Returns 401 on authentication failure
 */

const createAuthMiddleware = require('./auth.middleware');
const { AuthenticationError } = require('../utils/custom-errors');

describe('Authentication Middleware', () => {
  let mockAuthService;
  let mockErrorHandlerService;
  let middleware;
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Mock AuthService
    mockAuthService = {
      validateSession: jest.fn(),
    };

    // Mock ErrorHandlerService
    mockErrorHandlerService = {
      formatAndSend: jest.fn(),
    };

    // Create middleware instance
    middleware = createAuthMiddleware(mockAuthService, mockErrorHandlerService);

    // Setup mock request/response/next
    req = {
      path: '/protected-route',
      method: 'GET',
      user: undefined,
      session: undefined,
      headers: {},
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('Public Routes', () => {
    it('should allow GET /buses without authentication', async () => {
      req.path = '/buses';
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(mockAuthService.validateSession).not.toHaveBeenCalled();
    });

    it('should allow POST /auth/login without authentication', async () => {
      req.path = '/auth/login';
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(mockAuthService.validateSession).not.toHaveBeenCalled();
    });

    it('should allow POST /auth/register without authentication', async () => {
      req.path = '/auth/register';
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow GET /routes without authentication', async () => {
      req.path = '/routes';
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow GET /search without authentication', async () => {
      req.path = '/search';
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow nested public routes like GET /buses/search', async () => {
      req.path = '/buses/search';
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow GET /health without authentication', async () => {
      req.path = '/health';
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Protected Routes - Valid Session', () => {
    it('should attach userId to req.user when session is valid', async () => {
      req.path = '/bookings';
      mockAuthService.validateSession.mockResolvedValue({
        isValid: true,
        userId: 'user-123',
      });

      await middleware(req, res, next);

      expect(mockAuthService.validateSession).toHaveBeenCalledWith(req);
      expect(req.user.id).toBe('user-123');
      expect(next).toHaveBeenCalled();
      expect(mockErrorHandlerService.formatAndSend).not.toHaveBeenCalled();
    });

    it('should allow POST /bookings with valid authentication', async () => {
      req.path = '/bookings';
      req.method = 'POST';
      mockAuthService.validateSession.mockResolvedValue({
        isValid: true,
        userId: 'user-456',
      });

      await middleware(req, res, next);

      expect(req.user.id).toBe('user-456');
      expect(next).toHaveBeenCalled();
    });

    it('should allow GET /bookings/my with valid authentication', async () => {
      req.path = '/bookings/my';
      mockAuthService.validateSession.mockResolvedValue({
        isValid: true,
        userId: 'user-789',
      });

      await middleware(req, res, next);

      expect(req.user.id).toBe('user-789');
      expect(next).toHaveBeenCalled();
    });

    it('should preserve existing user object while adding id', async () => {
      req.path = '/bookings';
      req.user = { email: 'user@example.com' };
      mockAuthService.validateSession.mockResolvedValue({
        isValid: true,
        userId: 'user-123',
      });

      await middleware(req, res, next);

      expect(req.user.email).toBe('user@example.com');
      expect(req.user.id).toBe('user-123');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Protected Routes - Invalid Session', () => {
    it('should return 401 Unauthorized when session is invalid', async () => {
      req.path = '/bookings';
      mockAuthService.validateSession.mockResolvedValue({
        isValid: false,
      });

      await middleware(req, res, next);

      expect(mockErrorHandlerService.formatAndSend).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle validateSession rejection', async () => {
      req.path = '/bookings';
      mockAuthService.validateSession.mockRejectedValue(
        new Error('Database connection failed')
      );

      await middleware(req, res, next);

      expect(mockErrorHandlerService.formatAndSend).toHaveBeenCalled();
      const error = mockErrorHandlerService.formatAndSend.mock.calls[0][1];
      expect(error instanceof AuthenticationError).toBe(true);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when validateSession throws AuthenticationError', async () => {
      req.path = '/bookings';
      mockAuthService.validateSession.mockRejectedValue(
        new AuthenticationError('Invalid session')
      );

      await middleware(req, res, next);

      expect(mockErrorHandlerService.formatAndSend).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing AuthService gracefully', () => {
      expect(() => {
        createAuthMiddleware(null, mockErrorHandlerService);
      }).toThrow('AuthService is required for authentication middleware');
    });

    it('should handle missing ErrorHandlerService gracefully', () => {
      expect(() => {
        createAuthMiddleware(mockAuthService, null);
      }).toThrow('ErrorHandlerService is required for authentication middleware');
    });

    it('should handle request paths with query parameters', async () => {
      req.path = '/buses';
      req.query = { from: 'NYC', to: 'BOS' };
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should distinguish between /bus and /buses routes', async () => {
      req.path = '/bus';
      mockAuthService.validateSession.mockResolvedValue({
        isValid: true,
        userId: 'user-123',
      });

      await middleware(req, res, next);

      // /bus is not in PUBLIC_ROUTES, so auth should be checked
      expect(mockAuthService.validateSession).toHaveBeenCalled();
    });

    it('should include context in error logging', async () => {
      req.path = '/bookings';
      req.method = 'DELETE';
      mockAuthService.validateSession.mockResolvedValue({
        isValid: false,
      });

      await middleware(req, res, next);

      const contextCall = mockErrorHandlerService.formatAndSend.mock.calls[0][2];
      expect(contextCall.endpoint).toBe('/bookings');
      expect(contextCall.method).toBe('DELETE');
    });
  });

  describe('Multiple Protected Routes', () => {
    it('should require authentication for GET /users/profile', async () => {
      req.path = '/users/profile';
      mockAuthService.validateSession.mockResolvedValue({
        isValid: true,
        userId: 'user-123',
      });

      await middleware(req, res, next);

      expect(mockAuthService.validateSession).toHaveBeenCalled();
      expect(req.user.id).toBe('user-123');
    });

    it('should require authentication for DELETE /bookings/:id', async () => {
      req.path = '/bookings/booking-123';
      mockAuthService.validateSession.mockResolvedValue({
        isValid: true,
        userId: 'user-456',
      });

      await middleware(req, res, next);

      expect(mockAuthService.validateSession).toHaveBeenCalled();
      expect(req.user.id).toBe('user-456');
    });
  });
});
