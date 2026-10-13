/**
 * RouteService Unit Tests
 * Tests for route retrieval and error handling
 */

const RouteService = require('./route.service');
const Route = require('../models/route');
const { NotFoundError } = require('../utils/custom-errors');

// Mock the Route model
jest.mock('../models/route');

describe('RouteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRoutes()', () => {
    it('should return all routes with correct format', async () => {
      // Arrange
      const mockRoutes = [
        {
          _id: '507f1f77bcf86cd799439011',
          departureLocation: { name: 'New York' },
          arrivalLocation: { name: 'Boston' },
          duration: 240,
          distance: 215,
        },
        {
          _id: '507f1f77bcf86cd799439012',
          departureLocation: { name: 'Boston' },
          arrivalLocation: { name: 'Philadelphia' },
          duration: 180,
          distance: 135,
        },
      ];

      Route.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockRoutes),
      });

      // Act
      const result = await RouteService.getRoutes();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: '507f1f77bcf86cd799439011',
        source: 'New York',
        destination: 'Boston',
        duration: 240,
        distance: 215,
      });
      expect(result[1]).toEqual({
        id: '507f1f77bcf86cd799439012',
        source: 'Boston',
        destination: 'Philadelphia',
        duration: 180,
        distance: 135,
      });
    });

    it('should return empty array when no routes exist', async () => {
      // Arrange
      Route.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      // Act
      const result = await RouteService.getRoutes();

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle missing location names gracefully', async () => {
      // Arrange
      const mockRoutes = [
        {
          _id: '507f1f77bcf86cd799439011',
          departureLocation: null,
          arrivalLocation: null,
          duration: 240,
          distance: 0,
        },
      ];

      Route.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockRoutes),
      });

      // Act
      const result = await RouteService.getRoutes();

      // Assert
      expect(result[0]).toEqual({
        id: '507f1f77bcf86cd799439011',
        source: 'Unknown',
        destination: 'Unknown',
        duration: 240,
        distance: 0,
      });
    });

    it('should throw error if database query fails', async () => {
      // Arrange
      const mockError = new Error('Database connection failed');
      Route.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(mockError),
      });

      // Act & Assert
      await expect(RouteService.getRoutes()).rejects.toThrow(
        'Failed to retrieve routes: Database connection failed'
      );
    });
  });

  describe('getRouteById()', () => {
    it('should return route details for valid ID', async () => {
      // Arrange
      const routeId = '507f1f77bcf86cd799439011';
      const mockRoute = {
        _id: routeId,
        departureLocation: { name: 'New York' },
        arrivalLocation: { name: 'Boston' },
        duration: 240,
        distance: 215,
      };

      Route.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockRoute),
      });

      // Act
      const result = await RouteService.getRouteById(routeId);

      // Assert
      expect(Route.findById).toHaveBeenCalledWith(routeId);
      expect(result).toEqual({
        id: routeId,
        source: 'New York',
        destination: 'Boston',
        duration: 240,
        distance: 215,
      });
    });

    it('should throw NotFoundError when route does not exist', async () => {
      // Arrange
      const routeId = 'nonexistent-id';
      Route.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      // Act & Assert
      await expect(RouteService.getRouteById(routeId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw error if database query fails', async () => {
      // Arrange
      const routeId = '507f1f77bcf86cd799439011';
      const mockError = new Error('Database error');
      Route.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(mockError),
      });

      // Act & Assert
      await expect(RouteService.getRouteById(routeId)).rejects.toThrow(
        'Failed to retrieve route: Database error'
      );
    });

    it('should handle missing location names gracefully', async () => {
      // Arrange
      const routeId = '507f1f77bcf86cd799439011';
      const mockRoute = {
        _id: routeId,
        departureLocation: null,
        arrivalLocation: { name: 'Boston' },
        duration: 240,
      };

      Route.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockRoute),
      });

      // Act
      const result = await RouteService.getRouteById(routeId);

      // Assert
      expect(result).toEqual({
        id: routeId,
        source: 'Unknown',
        destination: 'Boston',
        duration: 240,
        distance: 0,
      });
    });
  });
});
