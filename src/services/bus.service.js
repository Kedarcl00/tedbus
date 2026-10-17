/**
 * BusService - Bus inventory and seat availability management service
 * Manages bus catalog, seat availability calculation, and seat reservation/release operations
 * Prevents double-booking through atomic reservation operations * Service-Oriented Architecture and user-specific booking management
 */

const BusRepository = require('../repositories/bus.repository');
const {
  NotFoundError,
  BusinessRuleError,
  InsufficientSeatsError,
  ValidationError,
} = require('../utils/custom-errors');

class BusService {
  /**
   * Constructor for dependency injection
   * @param {ErrorHandlerService} errorHandlerService - Service for error formatting and logging
   * @throws {Error} If errorHandlerService is not provided
   */
  constructor(errorHandlerService) {
    if (!errorHandlerService) {
      throw new Error('ErrorHandlerService is required for BusService');
    }

    this.busRepository = new BusRepository();
    this.errorHandlerService = errorHandlerService;
  }

  /**
   * Search buses by route and date with availability calculation
   * Returns available buses matching the search filters with seat count information * Service layer returns result or throws structured error
   *
   * @async
   * @param {Object} filters - Search filter criteria
   * @param {string} filters.sourceCity - Departure city name
   * @param {string} filters.destinationCity - Destination city name
   * @param {string} filters.departureDate - Departure date (YYYY-MM-DD format)
   * @param {number} [filters.passengers] - Number of passengers (for filtering)
   * @param {string} [filters.busType] - Bus type filter (AC, Non-AC, etc.)
   * @returns {Promise<Array>} Array of bus search results with availability info
   * @throws {ValidationError} If filters are invalid
   *
   * @example
   * const buses = await busService.searchBuses({
   *   sourceCity: 'New York',
   *   destinationCity: 'Boston',
   *   departureDate: '2024-06-15',
   *   passengers: 2
   * });
   * // Returns: [{
   * //   busId: '507f...',
   * //   operatorName: 'Greyhound',
   * //   departureTime: '08:00',
   * //   arrivalTime: '14:30',
   * //   fare: 45.99,
   * //   availableSeats: 8,
   * //   totalSeats: 50
   * // }, ...]
   */
  async searchBuses(filters) {
    try {
      // Validate required filters
      if (!filters.sourceCity || typeof filters.sourceCity !== 'string') {
        throw new ValidationError(
          'Source city is required',
          { field: 'sourceCity' }
        );
      }

      if (!filters.destinationCity || typeof filters.destinationCity !== 'string') {
        throw new ValidationError(
          'Destination city is required',
          { field: 'destinationCity' }
        );
      }

      if (!filters.departureDate || typeof filters.departureDate !== 'string') {
        throw new ValidationError(
          'Departure date is required (YYYY-MM-DD format)',
          { field: 'departureDate' }
        );
      }

      // Validate date format (basic)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.departureDate)) {
        throw new ValidationError(
          'Invalid date format. Use YYYY-MM-DD',
          { field: 'departureDate', example: '2024-06-15' }
        );
      }

      // Validate passengers if provided
      if (filters.passengers && !Number.isInteger(filters.passengers)) {
        throw new ValidationError(
          'Passengers must be an integer',
          { field: 'passengers' }
        );
      }

      // Search buses matching filters
      const buses = await this.busRepository.find({
        sourceCity: filters.sourceCity,
        destinationCity: filters.destinationCity,
        departureDate: filters.departureDate,
        busType: filters.busType,
      });

      if (buses.length === 0) {
        return []; // No buses found, return empty array
      }

      // Calculate availability for each bus
      const busesWithAvailability = await Promise.all(
        buses.map(async (bus) => {
          const availability = await this.busRepository.getAvailability(
            bus._id.toString(),
            filters.departureDate
          );

          return {
            busId: bus._id.toString(),
            operatorName: bus.operatorName,
            busType: bus.busType,
            departureTime: bus.departureDetails?.time,
            arrivalTime: bus.arrivalDetails?.time,
            departureCity: bus.departureDetails?.city,
            arrivalCity: bus.arrivalDetails?.city,
            fare: bus.baseFare,
            availableSeats: availability.availableSeats,
            totalSeats: availability.totalSeats,
            bookedSeats: availability.bookedSeats,
            rating: bus.rating,
            amenities: bus.amenities,
            duration: bus.duration,
            image: bus.image,
          };
        })
      );

      // Filter by minimum required seats if passengers specified
      if (filters.passengers && filters.passengers > 0) {
        return busesWithAvailability.filter(
          (bus) => bus.availableSeats >= filters.passengers
        );
      }

      return busesWithAvailability;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new BusinessRuleError(
        `Failed to search buses: ${error.message}`
      );
    }
  }

  /**
   * Get detailed information about a specific bus
   * Includes seat layout, amenities, and current availability
   *
   * @async
   * @param {string} busId - MongoDB bus ID
   * @param {string} [departureDate] - Departure date for availability check (optional)
   * @returns {Promise<Object>} Bus details object with seat layout
   * @throws {NotFoundError} If bus doesn't exist
   * @throws {ValidationError} If busId is invalid
   *
   * @example
   * const bus = await busService.getBusById('507f1f77bcf86cd799439011', '2024-06-15');
   */
  async getBusById(busId, departureDate = null) {
    try {
      // Validate busId
      if (!busId || typeof busId !== 'string') {
        throw new NotFoundError('Bus');
      }

      // Fetch bus from repository
      const bus = await this.busRepository.findById(busId);

      if (!bus) {
        throw new NotFoundError('Bus');
      }

      // Build response object
      const busDetails = {
        busId: bus._id.toString(),
        operatorName: bus.operatorName,
        busType: bus.busType,
        totalSeats: bus.totalSeats,
        rating: bus.rating,
        amenities: bus.amenities,
        departureDetails: bus.departureDetails,
        arrivalDetails: bus.arrivalDetails,
        baseFare: bus.baseFare,
        duration: bus.duration,
        image: bus.image,
        cancellationPolicy: bus.cancellationPolicy,
        liveTracking: bus.liveTracking,
        isReschedulable: bus.isReschedulable,
      };

      // Add availability if date is provided
      if (departureDate) {
        const availability = await this.busRepository.getAvailability(busId, departureDate);
        busDetails.availability = availability;
      }

      return busDetails;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new BusinessRuleError(
        `Failed to get bus details: ${error.message}`
      );
    }
  }

  /**
   * Check seat availability for a specific bus and date
   * Calculates available_seats = total_seats - booked_seats
   * Implements atomic operation to prevent race conditions
   *
   * @async
   * @param {string} busId - MongoDB bus ID
   * @param {string} departureDate - Departure date (YYYY-MM-DD format)
   * @returns {Promise<Object>} Seat availability info
   * @throws {NotFoundError} If bus doesn't exist
   * @throws {ValidationError} If parameters are invalid
   *
   * @example
   * const availability = await busService.checkAvailability(
   *   '507f1f77bcf86cd799439011',
   *   '2024-06-15'
   * );
   * // Returns: {
   * //   busId: '507f...',
   * //   departureDate: '2024-06-15',
   * //   totalSeats: 50,
   * //   bookedSeats: 42,
   * //   availableSeats: 8
   * // }
   */
  async checkAvailability(busId, departureDate) {
    try {
      // Validate parameters
      if (!busId || typeof busId !== 'string') {
        throw new NotFoundError('Bus');
      }

      if (!departureDate || typeof departureDate !== 'string') {
        throw new ValidationError(
          'Departure date is required (YYYY-MM-DD format)',
          { field: 'departureDate' }
        );
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
        throw new ValidationError(
          'Invalid date format. Use YYYY-MM-DD',
          { field: 'departureDate' }
        );
      }

      // Check bus exists
      const bus = await this.busRepository.findById(busId);
      if (!bus) {
        throw new NotFoundError('Bus');
      }

      // Get availability (atomic read)
      const availability = await this.busRepository.getAvailability(busId, departureDate);

      return availability;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new BusinessRuleError(
        `Failed to check availability: ${error.message}`
      );
    }
  }

  /**
   * Reserve seats for a booking (atomic operation to prevent double-booking)
   * Validates seat availability, prevents concurrent modifications, and returns reservation token
   * Throws InsufficientSeatsError if seats are already booked * Atomic operations prevent race conditions
   *
   * @async
   * @param {string} busId - MongoDB bus ID
   * @param {Array<number>} seatNumbers - Array of seat numbers to reserve
   * @param {string} departureDate - Departure date (YYYY-MM-DD format)
   * @returns {Promise<Object>} Reservation token containing busId, seats, and token string
   * @throws {NotFoundError} If bus doesn't exist
   * @throws {InsufficientSeatsError} If requested seats are unavailable
   * @throws {ValidationError} If seatNumbers or departureDate are invalid
   * @throws {BusinessRuleError} If reservation fails for business logic reasons
   *
   * @example
   * const reservation = await busService.reserveSeats(
   *   '507f1f77bcf86cd799439011',
   *   [12, 13, 14],
   *   '2024-06-15'
   * );
   * // Returns: {
   * //   busId: '507f...',
   * //   seatNumbers: [12, 13, 14],
   * //   departureDate: '2024-06-15',
   * //   token: 'RES-507f...-1718462400000',
   * //   reservedAt: '2024-06-15T10:00:00.000Z'
   * // }
   */
  async reserveSeats(busId, seatNumbers, departureDate) {
    try {
      // Validate parameters
      if (!busId || typeof busId !== 'string') {
        throw new NotFoundError('Bus');
      }

      if (!Array.isArray(seatNumbers) || seatNumbers.length === 0) {
        throw new ValidationError(
          'Seat numbers must be a non-empty array',
          { field: 'seatNumbers' }
        );
      }

      // Validate seat numbers are positive integers
      if (!seatNumbers.every(s => Number.isInteger(s) && s > 0)) {
        throw new ValidationError(
          'All seat numbers must be positive integers',
          { field: 'seatNumbers' }
        );
      }

      if (!departureDate || typeof departureDate !== 'string') {
        throw new ValidationError(
          'Departure date is required',
          { field: 'departureDate' }
        );
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
        throw new ValidationError(
          'Invalid date format. Use YYYY-MM-DD',
          { field: 'departureDate' }
        );
      }

      // Check bus exists
      const bus = await this.busRepository.findById(busId);
      if (!bus) {
        throw new NotFoundError('Bus');
      }

      // Validate seat numbers are within bus capacity
      const maxSeatNumber = Math.max(...seatNumbers);
      if (maxSeatNumber > bus.totalSeats) {
        throw new ValidationError(
          `Seat numbers must not exceed total seats (${bus.totalSeats})`,
          { field: 'seatNumbers', maxSeat: bus.totalSeats }
        );
      }

      // Check for duplicate seat numbers
      const uniqueSeats = new Set(seatNumbers);
      if (uniqueSeats.size !== seatNumbers.length) {
        throw new ValidationError(
          'Duplicate seat numbers provided',
          { field: 'seatNumbers' }
        );
      }

      // Atomic check: verify seats are available
      const seatsAvailable = await this.busRepository.checkSeatsAvailable(
        busId,
        seatNumbers,
        departureDate
      );

      if (!seatsAvailable.available) {
        throw new InsufficientSeatsError(
          `Seats ${seatsAvailable.conflictingSeats.join(', ')} are already booked`,
          { conflictingSeats: seatsAvailable.conflictingSeats }
        );
      }

      // Reserve seats (returns token to be used in booking creation)
      const reservation = await this.busRepository.reserveSeats(
        busId,
        seatNumbers,
        departureDate,
        { reserved: true }
      );

      return reservation;
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof ValidationError ||
        error instanceof InsufficientSeatsError
      ) {
        throw error;
      }
      throw new BusinessRuleError(
        `Failed to reserve seats: ${error.message}`
      );
    }
  }

  /**
   * Release reserved seats on cancellation
   * Frees up the seats so they can be booked by other customers
   * Called during booking cancellation to restore seat availability * Service method returns result or throws structured error
   *
   * @async
   * @param {string} busId - MongoDB bus ID
   * @param {Array<number>} seatNumbers - Array of seat numbers to release
   * @param {string} departureDate - Departure date (YYYY-MM-DD format)
   * @returns {Promise<Object>} Release confirmation
   * @throws {NotFoundError} If bus doesn't exist
   * @throws {ValidationError} If parameters are invalid
   *
   * @example
   * const result = await busService.releaseSeats(
   *   '507f1f77bcf86cd799439011',
   *   [12, 13, 14],
   *   '2024-06-15'
   * );
   */
  async releaseSeats(busId, seatNumbers, departureDate) {
    try {
      // Validate parameters
      if (!busId || typeof busId !== 'string') {
        throw new NotFoundError('Bus');
      }

      if (!Array.isArray(seatNumbers) || seatNumbers.length === 0) {
        throw new ValidationError(
          'Seat numbers must be a non-empty array',
          { field: 'seatNumbers' }
        );
      }

      if (!departureDate || typeof departureDate !== 'string') {
        throw new ValidationError(
          'Departure date is required',
          { field: 'departureDate' }
        );
      }

      // Check bus exists
      const bus = await this.busRepository.findById(busId);
      if (!bus) {
        throw new NotFoundError('Bus');
      }

      // Release seats
      const result = await this.busRepository.releaseSeats(
        busId,
        seatNumbers,
        departureDate
      );

      return result;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new BusinessRuleError(
        `Failed to release seats: ${error.message}`
      );
    }
  }

  /**
   * Get popular/trending routes for homepage display
   * Used for search suggestions and marketing
   *
   * @async
   * @returns {Promise<Array>} Array of popular route objects
   *
   * @example
   * const popular = await busService.getPopularRoutes();
   */
  async getPopularRoutes() {
    try {
      return await this.busRepository.getPopularRoutes();
    } catch (error) {
      throw new BusinessRuleError(
        `Failed to get popular routes: ${error.message}`
      );
    }
  }
}

module.exports = BusService;
