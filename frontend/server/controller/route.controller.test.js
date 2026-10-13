/**
 * RouteController Unit Tests
 * Tests for GET /routes and GET /routes/:id endpoints
 */

const RouteController = require('./route.controller');
const RouteService = require('../services/route.service');
const ErrorHandlerService = require('../services/error-handler.service');
const { NotFoundError, ValidationError } = require('../utils/custom-errors');

// Mock setup
jest.mock('../services/route.service');
jest.mock('../services/error-handler.service');

describe('RouteController', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock request object
    req = {
      params: {},
      query: {},
    };

    // Mock response object with method chaining
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('getRoutes()', () => {
    it('should return 200 OK with routes array', async () => {
      // Arrange
      const mockRoutes = [
        {
          id: '507f1f77bcf86cd799439011',
          source: 'New York',
          destination: 'Boston',
          duration: 240,
          distance: 215,
        },
        {
          id: '507f1f77bcf86cd799439012',
          source: 'Boston',
          destination: 'Philadelphia',
          duration: 180,
          distance: 135,
        },
      ];

      RouteService.getRoutes.mockResolvedValue(mockRoutes);

      // Act
      await RouteController.getRoutes(req, res);

      // Assert
      expect(RouteService.getRoutes).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockRoutes,
        count: 2,
        message: 'Routes retrieved successfully',
      });
    });

    it('should return 200 OK with empty array when no routes found', async () => {
      // Arrange
      RouteService.getRoutes.mockResolvedValue([]);

      // Act
      await RouteController.getRoutes(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        count: 0,
        message: 'No routes available',
      });
    });

    it('should handle service errors and return formatted error response', async () => {
      // Arrange
      const mockError = new Error('Database connection failed');
      const mockFormattedError = {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          statusCode: 500,
        },
      };

      RouteService.getRoutes.mockRejectedValue(mockError);
      ErrorHandlerService.formatError.mockReturnValue(mockFormattedError);
      ErrorHandlerService.logError.mockReturnValue(undefined);

      // Act
      await RouteController.getRoutes(req, res);

      // Assert
      expect(ErrorHandlerService.logError).toHaveBeenCalledWith(
        mockError,
        expect.objectContaining({
          action: 'getRoutes',
          endpoint: '/routes',
        })
      );
      expect(ErrorHandlerService.formatError).toHaveBeenCalledWith(mockError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(mockFormattedError);
    });
  });

  describe('getRouteById()', () => {
    it('should return 200 OK with route details', async () => {
      // Arrange
      const routeId = '507f1f77bcf86cd799439011';
      const mockRoute = {
        id: routeId,
        source: 'New York',
        destination: 'Boston',
        duration: 240,
        distance: 215,
      };

      req.params.id = routeId;
      RouteService.getRouteById.mockResolvedValue(mockRoute);

      // Act
      await RouteController.getRouteById(req, res);

      // Assert
      expect(RouteService.getRouteById).toHaveBeenCalledWith(routeId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockRoute,
        message: 'Route details retrieved successfully',
      });
    });

    it('should return 400 Bad Request when route ID is missing', async () => {
      // Arrange
      const mockFormattedError = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Route ID is required',
          statusCode: 400,
        },
      };

      req.params.id = '';
      ErrorHandlerService.formatError.mockReturnValue(mockFormattedError);

      // Act
      await RouteController.getRouteById(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 404 Not Found when route does not exist', async () => {
      // Arrange
      const routeId = 'nonexistent-id';
      const mockError = new NotFoundError('Route');
      const mockFormattedError = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found',
          statusCode: 404,
        },
      };

      req.params.id = routeId;
      RouteService.getRouteById.mockRejectedValue(mockError);
      ErrorHandlerService.formatError.mockReturnValue(mockFormattedError);

      // Act
      await RouteController.getRouteById(req, res);

      // Assert
      expect(RouteService.getRouteById).toHaveBeenCalledWith(routeId);
      expect(ErrorHandlerService.formatError).toHaveBeenCalledWith(mockError);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(mockFormattedError);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const routeId = '507f1f77bcf86cd799439011';
      const mockError = new Error('Database connection lost');
      const mockFormattedError = {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          statusCode: 500,
        },
      };

      req.params.id = routeId;
      RouteService.getRouteById.mockRejectedValue(mockError);
      ErrorHandlerService.formatError.mockReturnValue(mockFormattedError);
      ErrorHandlerService.logError.mockReturnValue(undefined);

      // Act
      await RouteController.getRouteById(req, res);

      // Assert
      expect(ErrorHandlerService.logError).toHaveBeenCalledWith(
        mockError,
        expect.objectContaining({
          action: 'getRouteById',
          endpoint: '/routes/:id',
          routeId: routeId,
        })
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(mockFormattedError);
    });
  });
});
