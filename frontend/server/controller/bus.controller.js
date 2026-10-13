/**
 * BusController
 * Handles HTTP requests for bus operations
 * Delegates business logic to BusService and SearchService
 * 
 * Key Principles:
 * - Handle search queries with filtering and sorting
 * - Return bus details with availability information
 * - No authentication required for read operations (public endpoints)
 * - Let services handle business logic and throw errors
 * - ErrorHandlerMiddleware formats all responses
 * - Return proper HTTP status codes for each scenario
 */

const BusService = require('../services/bus.service');
const ErrorHandlerService = require('../services/error-handler.service');
const {
  ValidationError,
  NotFoundError,
  BusinessRuleError,
} = require('../utils/custom-errors');

class BusController {
  /**
   * Search buses with filters and sorting
   * GET /buses/search?from=source&to=destination&date=YYYY-MM-DD&passengers=2&busType=AC&priceRange=50-200&departureTime=morning&sortBy=price
   * 
   * Query Parameters:
   * - from: departure location (required)
   * - to: arrival location (required)
   * - date: departure date in YYYY-MM-DD format (required)
   * - passengers: number of passengers (required)
   * - busType: filter by bus type (optional) - AC, Non-AC, Sleeper, etc.
   * - priceRange: filter by price range as "min-max" (optional)
   * - departureTime: filter by departure time - morning, afternoon, evening, night (optional)
   * - sortBy: sort results - price_asc, price_desc, departure_asc, departure_desc, duration_asc (optional, default: price_asc)
   * 
   * @param {Object} req - Express request object
   * @param {Object} req.query - Search and filter parameters
   * @param {Object} res - Express response object
   * @returns {Promise<void>} 200 OK with buses array or 400 Bad Request
   */
  async searchBuses(req, res) {
    try {
      // Extract and validate required query parameters
      const { from, to, date, passengers, busType, priceRange, departureTime, sortBy } = req.query;

      // Validate required parameters
      if (!from) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Departure location (from) is required')
          )
        );
      }

      if (!to) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Arrival location (to) is required')
          )
        );
      }

      if (!date) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Departure date is required in YYYY-MM-DD format')
          )
        );
      }

      if (!passengers) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Number of passengers is required')
          )
        );
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Date must be in YYYY-MM-DD format')
          )
        );
      }

      // Validate passengers is a positive integer
      const passengerCount = parseInt(passengers);
      if (isNaN(passengerCount) || passengerCount < 1 || passengerCount > 10) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Passengers must be a number between 1 and 10')
          )
        );
      }

      // Build search filters object
      const searchFilters = {
        from,
        to,
        date,
        passengers: passengerCount,
      };

      // Add optional filters if provided
      if (busType) {
        searchFilters.busType = busType;
      }

      if (priceRange) {
        // Validate price range format "min-max"
        const priceRegex = /^\d+(\.\d+)?-\d+(\.\d+)?$/;
        if (!priceRegex.test(priceRange)) {
          return res.status(400).json(
            ErrorHandlerService.formatError(
              new ValidationError('Price range must be in format "min-max" (e.g., "50-200")')
            )
          );
        }
        const [minPrice, maxPrice] = priceRange.split('-').map(Number);
        if (minPrice >= maxPrice) {
          return res.status(400).json(
            ErrorHandlerService.formatError(
              new ValidationError('Minimum price must be less than maximum price')
            )
          );
        }
        searchFilters.priceRange = { min: minPrice, max: maxPrice };
      }

      if (departureTime) {
        const validTimes = ['morning', 'afternoon', 'evening', 'night'];
        if (!validTimes.includes(departureTime.toLowerCase())) {
          return res.status(400).json(
            ErrorHandlerService.formatError(
              new ValidationError(
                `Departure time must be one of: ${validTimes.join(', ')}`
              )
            )
          );
        }
        searchFilters.departureTime = departureTime.toLowerCase();
      }

      // Validate and set sort criteria
      let sortCriteria = 'price_asc'; // default sort
      if (sortBy) {
        const validSortOptions = ['price_asc', 'price_desc', 'departure_asc', 'departure_desc', 'duration_asc'];
        if (!validSortOptions.includes(sortBy.toLowerCase())) {
          return res.status(400).json(
            ErrorHandlerService.formatError(
              new ValidationError(
                `Sort option must be one of: ${validSortOptions.join(', ')}`
              )
            )
          );
        }
        sortCriteria = sortBy.toLowerCase();
      }
      searchFilters.sortBy = sortCriteria;

      // Call BusService to search buses
      const buses = await BusService.searchBuses(searchFilters);

      // Apply additional filtering and sorting
      let filteredBuses = buses;

      // Filter by price if not already filtered
      if (searchFilters.priceRange) {
        filteredBuses = this._filterByPrice(filteredBuses, searchFilters.priceRange);
      }

      // Sort results based on sortBy parameter
      filteredBuses = this._sortBuses(filteredBuses, sortCriteria);

      // Return 200 OK with buses array
      return res.status(200).json({
        success: true,
        data: filteredBuses,
        count: filteredBuses.length,
        message: filteredBuses.length > 0
          ? 'Buses found'
          : 'No buses available for this route and date',
      });
    } catch (error) {
      // Handle specific error types with appropriate status codes
      if (error instanceof ValidationError) {
        return res.status(400).json(ErrorHandlerService.formatError(error));
      }
      if (error instanceof BusinessRuleError) {
        return res.status(400).json(ErrorHandlerService.formatError(error));
      }

      const formattedError = ErrorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Get bus details by ID
   * GET /buses/:id
   * 
   * @param {Object} req - Express request object
   * @param {string} req.params.id - Bus ID
   * @param {Object} res - Express response object
   * @returns {Promise<void>} 200 OK with bus details or 404 Not Found
   */
  async getBusById(req, res) {
    try {
      // Extract bus ID from URL parameters
      const { id: busId } = req.params;
      if (!busId) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Bus ID is required')
          )
        );
      }

      // Call BusService to retrieve bus
      const bus = await BusService.getBusById(busId);

      // Return 200 OK with bus details
      return res.status(200).json({
        success: true,
        data: bus,
        message: 'Bus details retrieved successfully',
      });
    } catch (error) {
      // Handle specific error types with appropriate status codes
      if (error instanceof NotFoundError) {
        return res.status(404).json(ErrorHandlerService.formatError(error));
      }

      const formattedError = ErrorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Check seat availability for a specific bus and date
   * GET /buses/:id/availability?date=YYYY-MM-DD
   * 
   * Query Parameters:
   * - date: departure date in YYYY-MM-DD format (required)
   * 
   * @param {Object} req - Express request object
   * @param {string} req.params.id - Bus ID
   * @param {Object} req.query - Query parameters
   * @param {string} req.query.date - Departure date
   * @param {Object} res - Express response object
   * @returns {Promise<void>} 200 OK with availability info or error response
   */
  async checkAvailability(req, res) {
    try {
      // Extract bus ID from URL parameters
      const { id: busId } = req.params;
      if (!busId) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Bus ID is required')
          )
        );
      }

      // Extract and validate date parameter
      const { date } = req.query;
      if (!date) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Departure date is required in YYYY-MM-DD format')
          )
        );
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Date must be in YYYY-MM-DD format')
          )
        );
      }

      // Call BusService to check availability
      const availability = await BusService.checkAvailability(busId, date);

      // Return 200 OK with availability information
      return res.status(200).json({
        success: true,
        data: {
          busId,
          date,
          ...availability,
        },
        message: `Bus has ${availability.availableSeats} available seats`,
      });
    } catch (error) {
      // Handle specific error types with appropriate status codes
      if (error instanceof NotFoundError) {
        return res.status(404).json(ErrorHandlerService.formatError(error));
      }
      if (error instanceof ValidationError) {
        return res.status(400).json(ErrorHandlerService.formatError(error));
      }

      const formattedError = ErrorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Helper method: Filter buses by price range
   * @private
   * @param {Array} buses - Array of bus objects
   * @param {Object} priceRange - {min, max} price range
   * @returns {Array} Filtered buses
   */
  _filterByPrice(buses, priceRange) {
    return buses.filter((bus) => {
      const fare = bus.fare || 0;
      return fare >= priceRange.min && fare <= priceRange.max;
    });
  }

  /**
   * Helper method: Sort buses by criteria
   * @private
   * @param {Array} buses - Array of bus objects
   * @param {string} sortCriteria - Sort criteria (price_asc, price_desc, departure_asc, departure_desc, duration_asc)
   * @returns {Array} Sorted buses
   */
  _sortBuses(buses, sortCriteria) {
    const sorted = [...buses]; // Create a copy to avoid mutating original array

    switch (sortCriteria) {
      case 'price_asc':
        return sorted.sort((a, b) => (a.fare || 0) - (b.fare || 0));

      case 'price_desc':
        return sorted.sort((a, b) => (b.fare || 0) - (a.fare || 0));

      case 'departure_asc':
        return sorted.sort((a, b) => {
          const timeA = this._timeToMinutes(a.departureTime);
          const timeB = this._timeToMinutes(b.departureTime);
          return timeA - timeB;
        });

      case 'departure_desc':
        return sorted.sort((a, b) => {
          const timeA = this._timeToMinutes(a.departureTime);
          const timeB = this._timeToMinutes(b.departureTime);
          return timeB - timeA;
        });

      case 'duration_asc':
        return sorted.sort((a, b) => {
          const durationA = a.route?.duration || 0;
          const durationB = b.route?.duration || 0;
          return durationA - durationB;
        });

      default:
        return sorted;
    }
  }

  /**
   * Helper method: Convert time string (HH:MM) to minutes
   * @private
   * @param {string} timeStr - Time in HH:MM format
   * @returns {number} Time in minutes from midnight
   */
  _timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }
}

// Export as singleton instance for dependency injection
module.exports = new BusController();
