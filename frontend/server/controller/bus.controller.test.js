/**
 * Unit Tests for BusController
 * 
 * Validates:
 * - Search buses with filters and sorting
 * - Get bus by ID
 * - Check seat availability
 * - Proper HTTP status codes
 * - Request validation (required parameters, formats)
 * - Error handling (404, 400, 500)
 * - No authentication required for public endpoints
 */

const BusController = require('./bus.controller');
const BusService = require('../services/bus.service');
const ErrorHandlerService = require('../services/error-handler.service');
const {
  ValidationError,
  NotFoundError,
  BusinessRuleError,
} = require('../utils/custom-errors');

// Mock BusService
jest.mock('../services/bus.service');
jest.mock('../services/error-handler.service');

describe('BusController', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock Express request and response objects
    req = {
      params: {},
      query: {},
      body: {},
      user: undefined, // No authentication required for bus endpoints
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Default mock for ErrorHandlerService.formatError
    ErrorHandlerService.formatError.mockImplementation((error) => ({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: error.message,
        statusCode: error.statusCode || 500,
        details: error.details || {},
      },
    }));
  });

  describe('searchBuses', () => {
    const mockSearchFilters = {
      from: 'NYC',
      to: 'BOS',
      date: '2024-06-15',
      passengers: 2,
    };

    const mockBuses = [
      {
        _id: 'bus1',
        operatorName: 'Greyhound',
        busType: 'AC',
        departureTime: '08:00',
        fare: 45.99,
        availableSeats: 8,
        totalSeats: 50,
        amenities: ['WiFi', 'USB'],
      },
      {
        _id: 'bus2',
        operatorName: 'Megabus',
        busType: 'Non-AC',
        departureTime: '10:30',
        fare: 35.50,
        availableSeats: 12,
        totalSeats: 50,
      },
    ];

    test('should search buses successfully with required parameters', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
      };

      BusService.searchBuses.mockResolvedValue(mockBuses);

      await BusController.searchBuses(req, res);

      expect(BusService.searchBuses).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'NYC',
          to: 'BOS',
          date: '2024-06-15',
          passengers: 2,
          sortBy: 'price_asc',
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          count: mockBuses.length,
        })
      );
    });

    test('should return 400 Bad Request when from parameter is missing', async () => {
      req.query = {
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
      };

      await BusController.searchBuses(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('Departure location'),
          }),
        })
      );
    });

    test('should return 400 Bad Request when to parameter is missing', async () => {
      req.query = {
        from: 'NYC',
        date: '2024-06-15',
        passengers: '2',
      };

      await BusController.searchBuses(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('Arrival location'),
          }),
        })
      );
    });

    test('should return 400 Bad Request when date parameter is missing', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        passengers: '2',
      };

      await BusController.searchBuses(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('Departure date'),
          }),
        })
      );
    });

    test('should return 400 Bad Request when passengers parameter is missing', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
      };

      await BusController.searchBuses(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('Number of passengers'),
          }),
        })
      );
    });

    test('should return 400 Bad Request with invalid date format', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '06/15/2024', // Invalid format
        passengers: '2',
      };

      await BusController.searchBuses(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('YYYY-MM-DD format'),
          }),
        })
      );
    });

    test('should return 400 Bad Request with invalid passenger count (zero)', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '0',
      };

      await BusController.searchBuses(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should return 400 Bad Request with invalid passenger count (exceeds max)', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '11',
      };

      await BusController.searchBuses(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should apply busType filter when provided', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
        busType: 'AC',
      };

      BusService.searchBuses.mockResolvedValue(mockBuses);

      await BusController.searchBuses(req, res);

      expect(BusService.searchBuses).toHaveBeenCalledWith(
        expect.objectContaining({
          busType: 'AC',
        })
      );
    });

    test('should apply priceRange filter when provided', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
        priceRange: '30-50',
      };

      BusService.searchBuses.mockResolvedValue(mockBuses);

      await BusController.searchBuses(req, res);

      expect(BusService.searchBuses).toHaveBeenCalledWith(
        expect.objectContaining({
          priceRange: { min: 30, max: 50 },
        })
      );
    });

    test('should return 400 Bad Request with invalid price range format', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
        priceRange: '30_50', // Invalid format
      };

      await BusController.searchBuses(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('format'),
          }),
        })
      );
    });

    test('should return 400 Bad Request when min price >= max price', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
        priceRange: '100-50', // min > max
      };

      await BusController.searchBuses(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should apply departureTime filter when provided', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
        departureTime: 'morning',
      };

      BusService.searchBuses.mockResolvedValue(mockBuses);

      await BusController.searchBuses(req, res);

      expect(BusService.searchBuses).toHaveBeenCalledWith(
        expect.objectContaining({
          departureTime: 'morning',
        })
      );
    });

    test('should return 400 Bad Request with invalid departureTime', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
        departureTime: 'midnight',
      };

      await BusController.searchBuses(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should sort by price ascending (default)', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
      };

      BusService.searchBuses.mockResolvedValue(mockBuses);

      await BusController.searchBuses(req, res);

      const returnedData = res.json.mock.calls[0][0].data;
      expect(returnedData[0].fare).toBeLessThanOrEqual(returnedData[1].fare);
    });

    test('should sort by price descending when specified', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
        sortBy: 'price_desc',
      };

      BusService.searchBuses.mockResolvedValue(mockBuses);

      await BusController.searchBuses(req, res);

      const returnedData = res.json.mock.calls[0][0].data;
      expect(returnedData[0].fare).toBeGreaterThanOrEqual(returnedData[1].fare);
    });

    test('should return 400 Bad Request with invalid sortBy option', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
        sortBy: 'rating_desc',
      };

      await BusController.searchBuses(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should return 200 OK with empty array when no buses found', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
      };

      BusService.searchBuses.mockResolvedValue([]);

      await BusController.searchBuses(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [],
          count: 0,
        })
      );
    });

    test('should handle service errors (BusinessRuleError)', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
      };

      const error = new BusinessRuleError('Database connection failed');
      BusService.searchBuses.mockRejectedValue(error);

      await BusController.searchBuses(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });

  describe('getBusById', () => {
    const mockBus = {
      _id: 'bus1',
      operatorName: 'Greyhound',
      busType: 'AC',
      departureTime: '08:00',
      fare: 45.99,
      totalSeats: 50,
      routes: { _id: 'route1', source: 'NYC', destination: 'BOS' },
    };

    test('should retrieve bus by ID successfully', async () => {
      req.params.id = 'bus1';
      BusService.getBusById.mockResolvedValue(mockBus);

      await BusController.getBusById(req, res);

      expect(BusService.getBusById).toHaveBeenCalledWith('bus1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockBus,
        })
      );
    });

    test('should return 400 Bad Request when bus ID is missing', async () => {
      await BusController.getBusById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('Bus ID is required'),
          }),
        })
      );
    });

    test('should return 404 Not Found when bus does not exist', async () => {
      req.params.id = 'nonexistent';
      const error = new NotFoundError('Bus');
      BusService.getBusById.mockRejectedValue(error);

      await BusController.getBusById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
          }),
        })
      );
    });

    test('should handle service errors (generic)', async () => {
      req.params.id = 'bus1';
      BusService.getBusById.mockRejectedValue(new Error('Database error'));

      await BusController.getBusById(req, res);

      expect(res.status).toHaveBeenCalled();
    });
  });

  describe('checkAvailability', () => {
    const mockAvailability = {
      totalSeats: 50,
      bookedSeats: 5,
      availableSeats: 45,
    };

    test('should check availability successfully', async () => {
      req.params.id = 'bus1';
      req.query.date = '2024-06-15';
      BusService.checkAvailability.mockResolvedValue(mockAvailability);

      await BusController.checkAvailability(req, res);

      expect(BusService.checkAvailability).toHaveBeenCalledWith('bus1', '2024-06-15');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            busId: 'bus1',
            date: '2024-06-15',
            ...mockAvailability,
          }),
        })
      );
    });

    test('should return 400 Bad Request when bus ID is missing', async () => {
      req.query.date = '2024-06-15';

      await BusController.checkAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('Bus ID is required'),
          }),
        })
      );
    });

    test('should return 400 Bad Request when date is missing', async () => {
      req.params.id = 'bus1';

      await BusController.checkAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('Departure date is required'),
          }),
        })
      );
    });

    test('should return 400 Bad Request with invalid date format', async () => {
      req.params.id = 'bus1';
      req.query.date = '2024/06/15';

      await BusController.checkAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('YYYY-MM-DD format'),
          }),
        })
      );
    });

    test('should return 404 Not Found when bus does not exist', async () => {
      req.params.id = 'nonexistent';
      req.query.date = '2024-06-15';
      const error = new NotFoundError('Bus');
      BusService.checkAvailability.mockRejectedValue(error);

      await BusController.checkAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
          }),
        })
      );
    });

    test('should handle service errors (generic)', async () => {
      req.params.id = 'bus1';
      req.query.date = '2024-06-15';
      BusService.checkAvailability.mockRejectedValue(new Error('Database error'));

      await BusController.checkAvailability(req, res);

      expect(res.status).toHaveBeenCalled();
    });

    test('should display correct message with available seats', async () => {
      req.params.id = 'bus1';
      req.query.date = '2024-06-15';
      BusService.checkAvailability.mockResolvedValue(mockAvailability);

      await BusController.checkAvailability(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Bus has 45 available seats',
        })
      );
    });
  });

  describe('No Authentication Required', () => {
    test('searchBuses should work without authentication (no req.user)', async () => {
      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
      };
      // req.user is undefined - public endpoint
      BusService.searchBuses.mockResolvedValue([]);

      await BusController.searchBuses(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('getBusById should work without authentication', async () => {
      req.params.id = 'bus1';
      // req.user is undefined - public endpoint
      BusService.getBusById.mockResolvedValue({});

      await BusController.getBusById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('checkAvailability should work without authentication', async () => {
      req.params.id = 'bus1';
      req.query.date = '2024-06-15';
      // req.user is undefined - public endpoint
      BusService.checkAvailability.mockResolvedValue({
        totalSeats: 50,
        bookedSeats: 5,
        availableSeats: 45,
      });

      await BusController.checkAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Sorting by Departure Time', () => {
    test('should sort by departure time ascending', async () => {
      const buses = [
        { departureTime: '18:00', fare: 50 },
        { departureTime: '08:00', fare: 40 },
        { departureTime: '14:00', fare: 45 },
      ];

      req.query = {
        from: 'NYC',
        to: 'BOS',
        date: '2024-06-15',
        passengers: '2',
        sortBy: 'departure_asc',
      };

      BusService.searchBuses.mockResolvedValue(buses);

      await BusController.searchBuses(req, res);

      const returnedData = res.json.mock.calls[0][0].data;
      expect(returnedData[0].departureTime).toBe('08:00');
      expect(returnedData[1].departureTime).toBe('14:00');
      expect(returnedData[2].departureTime).toBe('18:00');
    });
  });
});
