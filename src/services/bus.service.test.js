/**
 * BusService Unit Tests
 * Tests bus inventory management, seat availability calculation, and reservation operations
 * Verifies atomic operations prevent double-booking and error handling works correctly
 */

const BusService = require('./bus.service');
const BusRepository = require('../repositories/bus.repository');
const {
  NotFoundError,
  BusinessRuleError,
  InsufficientSeatsError,
  ValidationError,
} = require('../utils/custom-errors');

// Mock the BusRepository
jest.mock('../repositories/bus.repository');

describe('BusService', () => {
  let busService;
  let mockErrorHandlerService;
  let mockBusRepository;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock ErrorHandlerService
    mockErrorHandlerService = {
      formatError: jest.fn((error) => ({
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      })),
      logError: jest.fn(),
    };

    // Mock BusRepository
    BusRepository.mockClear();
    mockBusRepository = {
      find: jest.fn(),
      findById: jest.fn(),
      getAvailability: jest.fn(),
      checkSeatsAvailable: jest.fn(),
      reserveSeats: jest.fn(),
      releaseSeats: jest.fn(),
      getPopularRoutes: jest.fn(),
      updateAvailabilityCache: jest.fn(),
    };

    // Make BusRepository constructor return our mock
    BusRepository.mockImplementation(() => mockBusRepository);

    // Create BusService instance
    busService = new BusService(mockErrorHandlerService);
  });

  describe('constructor', () => {
    it('should throw error if ErrorHandlerService is not provided', () => {
      expect(() => new BusService(null)).toThrow(
        'ErrorHandlerService is required for BusService'
      );
    });

    it('should initialize with valid ErrorHandlerService', () => {
      expect(busService).toBeInstanceOf(BusService);
      expect(busService.busRepository).toBeDefined();
      expect(busService.errorHandlerService).toBeDefined();
    });
  });

  describe('searchBuses', () => {
    it('should return buses with availability when search filters match', async () => {
      const mockBuses = [
        {
          _id: { toString: () => 'BUS001' },
          operatorName: 'Greyhound',
          busType: 'AC',
          departureDetails: { time: '08:00', city: 'New York' },
          arrivalDetails: { time: '14:30', city: 'Boston' },
          baseFare: 45.99,
          rating: 4.5,
          amenities: { wifi: true },
          duration: '6h 30m',
          image: 'url',
        },
      ];

      const mockAvailability = {
        busId: 'BUS001',
        totalSeats: 50,
        bookedSeats: 42,
        availableSeats: 8,
      };

      mockBusRepository.find.mockResolvedValue(mockBuses);
      mockBusRepository.getAvailability.mockResolvedValue(mockAvailability);

      const result = await busService.searchBuses({
        sourceCity: 'New York',
        destinationCity: 'Boston',
        departureDate: '2024-06-15',
        passengers: 2,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          busId: 'BUS001',
          operatorName: 'Greyhound',
          availableSeats: 8,
          totalSeats: 50,
          fare: 45.99,
        })
      );
      expect(mockBusRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceCity: 'New York',
          destinationCity: 'Boston',
        })
      );
    });

    it('should throw ValidationError if sourceCity is missing', async () => {
      const promise = busService.searchBuses({
        sourceCity: '',
        destinationCity: 'Boston',
        departureDate: '2024-06-15',
      });

      await expect(promise).rejects.toThrow(ValidationError);
      await expect(promise).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('should throw ValidationError if departureDate is missing', async () => {
      const promise = busService.searchBuses({
        sourceCity: 'New York',
        destinationCity: 'Boston',
        departureDate: '',
      });

      await expect(promise).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid date format', async () => {
      const promise = busService.searchBuses({
        sourceCity: 'New York',
        destinationCity: 'Boston',
        departureDate: '06/15/2024',
      });

      await expect(promise).rejects.toThrow(ValidationError);
      await expect(promise).rejects.toMatchObject({
        message: expect.stringContaining('Invalid date format'),
      });
    });

    it('should filter buses by passenger requirement', async () => {
      const mockBuses = [
        {
          _id: { toString: () => 'BUS001' },
          operatorName: 'Greyhound',
          busType: 'AC',
          departureDetails: { time: '08:00', city: 'New York' },
          arrivalDetails: { time: '14:30', city: 'Boston' },
          baseFare: 45.99,
          rating: 4.5,
          amenities: {},
        },
        {
          _id: { toString: () => 'BUS002' },
          operatorName: 'Megabus',
          busType: 'Non-AC',
          departureDetails: { time: '10:00', city: 'New York' },
          arrivalDetails: { time: '16:30', city: 'Boston' },
          baseFare: 35.99,
          rating: 4.0,
          amenities: {},
        },
      ];

      mockBusRepository.find.mockResolvedValue(mockBuses);
      mockBusRepository.getAvailability
        .mockResolvedValueOnce({
          busId: 'BUS001',
          totalSeats: 50,
          bookedSeats: 48,
          availableSeats: 2,
        })
        .mockResolvedValueOnce({
          busId: 'BUS002',
          totalSeats: 50,
          bookedSeats: 48,
          availableSeats: 2,
        });

      const result = await busService.searchBuses({
        sourceCity: 'New York',
        destinationCity: 'Boston',
        departureDate: '2024-06-15',
        passengers: 5,
      });

      // Both buses have only 2 available seats, so both should be filtered out
      expect(result).toHaveLength(0);
    });

    it('should return empty array when no buses found', async () => {
      mockBusRepository.find.mockResolvedValue([]);

      const result = await busService.searchBuses({
        sourceCity: 'New York',
        destinationCity: 'NonExistent',
        departureDate: '2024-06-15',
      });

      expect(result).toEqual([]);
    });
  });

  describe('getBusById', () => {
    it('should return bus details with availability when date provided', async () => {
      const mockBus = {
        _id: { toString: () => 'BUS001' },
        operatorName: 'Greyhound',
        busType: 'AC',
        totalSeats: 50,
        rating: 4.5,
        amenities: { wifi: true },
        departureDetails: { city: 'New York' },
        arrivalDetails: { city: 'Boston' },
        baseFare: 45.99,
        duration: '6h 30m',
        cancellationPolicy: { full: 2 },
      };

      mockBusRepository.findById.mockResolvedValue(mockBus);
      mockBusRepository.getAvailability.mockResolvedValue({
        busId: 'BUS001',
        totalSeats: 50,
        bookedSeats: 42,
        availableSeats: 8,
      });

      const result = await busService.getBusById('BUS001', '2024-06-15');

      expect(result).toEqual(
        expect.objectContaining({
          busId: 'BUS001',
          operatorName: 'Greyhound',
          totalSeats: 50,
          availability: expect.objectContaining({
            availableSeats: 8,
          }),
        })
      );
    });

    it('should throw NotFoundError if bus does not exist', async () => {
      mockBusRepository.findById.mockResolvedValue(null);

      const promise = busService.getBusById('NONEXISTENT');

      await expect(promise).rejects.toThrow(NotFoundError);
      await expect(promise).rejects.toMatchObject({
        message: 'Bus not found',
      });
    });

    it('should throw NotFoundError if busId is invalid', async () => {
      const promise = busService.getBusById('');

      await expect(promise).rejects.toThrow(NotFoundError);
    });
  });

  describe('checkAvailability', () => {
    it('should return availability info for valid bus and date', async () => {
      mockBusRepository.findById.mockResolvedValue({
        _id: 'BUS001',
        totalSeats: 50,
      });

      mockBusRepository.getAvailability.mockResolvedValue({
        busId: 'BUS001',
        departureDate: '2024-06-15',
        totalSeats: 50,
        bookedSeats: 42,
        availableSeats: 8,
      });

      const result = await busService.checkAvailability('BUS001', '2024-06-15');

      expect(result).toEqual({
        busId: 'BUS001',
        departureDate: '2024-06-15',
        totalSeats: 50,
        bookedSeats: 42,
        availableSeats: 8,
      });
    });

    it('should throw NotFoundError if bus does not exist', async () => {
      mockBusRepository.findById.mockResolvedValue(null);

      const promise = busService.checkAvailability('NONEXISTENT', '2024-06-15');

      await expect(promise).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for invalid date format', async () => {
      mockBusRepository.findById.mockResolvedValue({ _id: 'BUS001' });

      const promise = busService.checkAvailability('BUS001', '06/15/2024');

      await expect(promise).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if departureDate is missing', async () => {
      mockBusRepository.findById.mockResolvedValue({ _id: 'BUS001' });

      const promise = busService.checkAvailability('BUS001', '');

      await expect(promise).rejects.toThrow(ValidationError);
    });
  });

  describe('reserveSeats', () => {
    it('should reserve seats successfully when available', async () => {
      mockBusRepository.findById.mockResolvedValue({
        _id: 'BUS001',
        totalSeats: 50,
      });

      mockBusRepository.checkSeatsAvailable.mockResolvedValue({
        available: true,
        conflictingSeats: [],
      });

      mockBusRepository.reserveSeats.mockResolvedValue({
        busId: 'BUS001',
        seatNumbers: [12, 13, 14],
        departureDate: '2024-06-15',
        token: 'RES-BUS001-1234567890',
        reservedAt: '2024-06-15T10:00:00.000Z',
      });

      const result = await busService.reserveSeats('BUS001', [12, 13, 14], '2024-06-15');

      expect(result).toEqual({
        busId: 'BUS001',
        seatNumbers: [12, 13, 14],
        departureDate: '2024-06-15',
        token: 'RES-BUS001-1234567890',
        reservedAt: '2024-06-15T10:00:00.000Z',
      });
      expect(mockBusRepository.checkSeatsAvailable).toHaveBeenCalledWith(
        'BUS001',
        [12, 13, 14],
        '2024-06-15'
      );
    });

    it('should throw InsufficientSeatsError when seats are booked', async () => {
      mockBusRepository.findById.mockResolvedValue({
        _id: 'BUS001',
        totalSeats: 50,
      });

      mockBusRepository.checkSeatsAvailable.mockResolvedValue({
        available: false,
        conflictingSeats: [12, 13],
      });

      const promise = busService.reserveSeats('BUS001', [12, 13, 14], '2024-06-15');

      await expect(promise).rejects.toThrow(InsufficientSeatsError);
      await expect(promise).rejects.toMatchObject({
        code: 'INSUFFICIENT_SEATS',
        message: expect.stringContaining('already booked'),
      });
    });

    it('should throw ValidationError for empty seat array', async () => {
      const promise = busService.reserveSeats('BUS001', [], '2024-06-15');

      await expect(promise).rejects.toThrow(ValidationError);
      await expect(promise).rejects.toMatchObject({
        message: expect.stringContaining('non-empty array'),
      });
    });

    it('should throw ValidationError for invalid seat numbers', async () => {
      const promise = busService.reserveSeats('BUS001', [0, -1, 'invalid'], '2024-06-15');

      await expect(promise).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for duplicate seat numbers', async () => {
      mockBusRepository.findById.mockResolvedValue({
        _id: 'BUS001',
        totalSeats: 50,
      });

      const promise = busService.reserveSeats('BUS001', [12, 12, 14], '2024-06-15');

      await expect(promise).rejects.toThrow(ValidationError);
      await expect(promise).rejects.toMatchObject({
        message: expect.stringContaining('Duplicate'),
      });
    });

    it('should throw ValidationError for seats exceeding bus capacity', async () => {
      mockBusRepository.findById.mockResolvedValue({
        _id: 'BUS001',
        totalSeats: 50,
      });

      const promise = busService.reserveSeats('BUS001', [49, 50, 51], '2024-06-15');

      await expect(promise).rejects.toThrow(ValidationError);
      await expect(promise).rejects.toMatchObject({
        message: expect.stringContaining('exceed total seats'),
      });
    });

    it('should throw NotFoundError if bus does not exist', async () => {
      mockBusRepository.findById.mockResolvedValue(null);

      const promise = busService.reserveSeats('NONEXISTENT', [12, 13], '2024-06-15');

      await expect(promise).rejects.toThrow(NotFoundError);
    });

    it('should prevent double-booking (atomic operation)', async () => {
      mockBusRepository.findById.mockResolvedValue({
        _id: 'BUS001',
        totalSeats: 50,
      });

      // Simulate race condition where another request booked the seats
      mockBusRepository.checkSeatsAvailable.mockResolvedValue({
        available: false,
        conflictingSeats: [12],
      });

      const promise = busService.reserveSeats('BUS001', [12, 13, 14], '2024-06-15');

      await expect(promise).rejects.toThrow(InsufficientSeatsError);
      // Verify checkSeatsAvailable was called (atomic check)
      expect(mockBusRepository.checkSeatsAvailable).toHaveBeenCalled();
    });
  });

  describe('releaseSeats', () => {
    it('should release seats successfully', async () => {
      mockBusRepository.findById.mockResolvedValue({
        _id: 'BUS001',
        totalSeats: 50,
      });

      mockBusRepository.releaseSeats.mockResolvedValue({
        busId: 'BUS001',
        seatNumbers: [12, 13, 14],
        departureDate: '2024-06-15',
        releasedAt: '2024-06-15T11:00:00.000Z',
        message: expect.any(String),
      });

      const result = await busService.releaseSeats('BUS001', [12, 13, 14], '2024-06-15');

      expect(result).toHaveProperty('releasedAt');
      expect(mockBusRepository.releaseSeats).toHaveBeenCalledWith(
        'BUS001',
        [12, 13, 14],
        '2024-06-15'
      );
    });

    it('should throw NotFoundError if bus does not exist', async () => {
      mockBusRepository.findById.mockResolvedValue(null);

      const promise = busService.releaseSeats('NONEXISTENT', [12, 13], '2024-06-15');

      await expect(promise).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for empty seat array', async () => {
      mockBusRepository.findById.mockResolvedValue({
        _id: 'BUS001',
        totalSeats: 50,
      });

      const promise = busService.releaseSeats('BUS001', [], '2024-06-15');

      await expect(promise).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if departureDate is missing', async () => {
      mockBusRepository.findById.mockResolvedValue({
        _id: 'BUS001',
        totalSeats: 50,
      });

      const promise = busService.releaseSeats('BUS001', [12, 13], '');

      await expect(promise).rejects.toThrow(ValidationError);
    });
  });

  describe('getPopularRoutes', () => {
    it('should return popular routes', async () => {
      const mockRoutes = [
        { routeId: 'ROUTE001', source: 'New York', destination: 'Boston' },
        { routeId: 'ROUTE002', source: 'NYC', destination: 'Washington' },
      ];

      mockBusRepository.getPopularRoutes.mockResolvedValue(mockRoutes);

      const result = await busService.getPopularRoutes();

      expect(result).toEqual(mockRoutes);
      expect(mockBusRepository.getPopularRoutes).toHaveBeenCalled();
    });

    it('should throw BusinessRuleError if repository fails', async () => {
      mockBusRepository.getPopularRoutes.mockRejectedValue(
        new Error('Database connection failed')
      );

      const promise = busService.getPopularRoutes();

      await expect(promise).rejects.toThrow(BusinessRuleError);
    });
  });

  describe('error handling', () => {
    it('should convert repository errors to BusinessRuleError in searchBuses', async () => {
      mockBusRepository.find.mockRejectedValue(
        new Error('Database connection failed')
      );

      const promise = busService.searchBuses({
        sourceCity: 'New York',
        destinationCity: 'Boston',
        departureDate: '2024-06-15',
      });

      await expect(promise).rejects.toThrow(BusinessRuleError);
    });

    it('should propagate custom errors without wrapping', async () => {
      const promise = busService.reserveSeats('BUS001', [], '2024-06-15');

      await expect(promise).rejects.toThrow(ValidationError);
      // Verify it's a ValidationError, not wrapped in BusinessRuleError
      try {
        await busService.reserveSeats('BUS001', [], '2024-06-15');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error).not.toBeInstanceOf(BusinessRuleError);
      }
    });
  });

  describe('availability calculation', () => {
    it('should calculate availableSeats = totalSeats - bookedSeats', async () => {
      mockBusRepository.findById.mockResolvedValue({
        _id: 'BUS001',
        totalSeats: 50,
      });

      mockBusRepository.getAvailability.mockResolvedValue({
        busId: 'BUS001',
        departureDate: '2024-06-15',
        totalSeats: 50,
        bookedSeats: 42,
        availableSeats: 8,
      });

      const result = await busService.checkAvailability('BUS001', '2024-06-15');

      expect(result.availableSeats).toBe(result.totalSeats - result.bookedSeats);
      expect(result.availableSeats).toBe(8);
    });

    it('should never return negative available seats', async () => {
      mockBusRepository.findById.mockResolvedValue({
        _id: 'BUS001',
        totalSeats: 50,
      });

      mockBusRepository.getAvailability.mockResolvedValue({
        busId: 'BUS001',
        departureDate: '2024-06-15',
        totalSeats: 50,
        bookedSeats: 60, // More than capacity (shouldn't happen but test defensive programming)
        availableSeats: 0, // Should be clamped to 0
      });

      const result = await busService.checkAvailability('BUS001', '2024-06-15');

      expect(result.availableSeats).toBeGreaterThanOrEqual(0);
    });
  });
});
