/**
 * BusController
 * Handles HTTP requests for bus operations (search, get details, check availability)
 * Delegates business logic to BusService and SearchService
 * 
 * Key Principles:
 * - Thin controller that only handles HTTP concerns
 * - Delegate all business logic to services
 * - Extract and validate query/path parameters from requests
 * - Return proper HTTP status codes for each scenario
 * - Let ErrorHandlerService format error responses
 * - No authentication required for bus operations (public endpoint)
 * 
 * @class BusController
 */

const BusService = require('../services/bus.service');
const ErrorHandlerService = require('../services/error-handler.service');
const { ValidationError, NotFoundError } = require('../utils/custom-errors');

class BusController {
  /**
   * Constructor for dependency injection
   * @param {BusService} busService - Bus service for business logic
   * @param {ErrorHandlerService} errorHandlerService - Error formatting service
   */
  constructor(busService, errorHandlerService) {
    if (!busService) {
      throw new Error('BusService is required for BusController');
    }
    if (!errorHandlerService) {
      throw new Error('ErrorHandlerService is required for BusController');
    }

    this.busService = busService;
    this.errorHandlerService = errorHandlerService;
  }

  /**
   * Search buses with filters and sorting
   * GET /buses/search?from=NYC&to=BOS&date=2024-06-15&passengers=2&busType=AC&sortBy=price_asc
   * 
   * Query Parameters:
   * - from: Source location (required)
   * - to: Destination location (required)
   * - date: Travel date in YYYY-MM-DD format (required)
   * - passengers: Number of passengers (optional, default: 1)
   * - busType: Filter by bus type (optional)
   * - priceRange: Filter by price range (optional)
   * - departureTime: Filter by departure time range (optional)
   * - sortBy: Sort criteria (price_asc, price_desc, departure_asc, duration_asc) (optional)
   * 
   * Response: 200 OK with array of buses
   * Error: 400 Bad Request (invalid parameters, missing required fields)
   * 
   * @param {Object} req - Express request object
   * @param {Object} req.query - Query parameters
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async searchBuses(req, res) {
    try {
      // Extract query parameters
      const { from, to, date, passengers, busType, priceRange, departureTime, sortBy } = req.query;

      // Validate required parameters
      if (!from || !to || !date) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError(
              'Missing required search parameters: from, to, and date are required',
              { missingFields: ['from', 'to', 'date'].filter(f => !eval(f)) }
            )
          )
        );
      }

      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError(
              'Invalid date format. Expected YYYY-MM-DD',
              { field: 'date' }
            )
          )
        );
      }

      // Build search filters
      const searchFilters = {
        from,
        to,
        date,
        passengers: parseInt(passengers) || 1,
        busType,
        priceRange,
        departureTime,
        sortBy: sortBy || 'price_asc',
      };

      // Call service to search buses
      const buses = await this.busService.searchBuses(searchFilters);

      // Return 200 OK with buses array
      return res.status(200).json({
        success: true,
        data: buses,
        count: buses.length,
        message: buses.length > 0
          ? 'Buses retrieved successfully'
          : 'No buses available for the selected criteria',
      });
    } catch (error) {
      // Log error and format response
      this.errorHandlerService.logError(error, {
        action: 'searchBuses',
        endpoint: '/buses/search',
      });

      // Format and return error response
      const formattedError = this.errorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Get bus details by ID
   * GET /buses/:id
   * 
   * URL Parameters:
   * - id: Bus ID (MongoDB ObjectId)
   * 
   * Response: 200 OK with bus details
   * Error: 400 Bad Request (invalid ID format), 404 Not Found
   * 
   * @param {Object} req - Express request object
   * @param {Object} req.params - Path parameters
   * @param {string} req.params.id - Bus ID
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async getBusById(req, res) {
    try {
      // Extract and validate bus ID from path parameters
      const { id: busId } = req.params;

      if (!busId) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError('Bus ID is required', { field: 'id' })
          )
        );
      }

      // Call service to get bus details
      const bus = await this.busService.getBusById(busId);

      // Return 200 OK with bus details
      return res.status(200).json({
        success: true,
        data: bus,
        message: 'Bus details retrieved successfully',
      });
    } catch (error) {
      // Handle specific error types
      if (error instanceof NotFoundError) {
        return res.status(404).json(this.errorHandlerService.formatError(error));
      }

      if (error instanceof ValidationError) {
        return res.status(400).json(this.errorHandlerService.formatError(error));
      }

      // Log error and format response
      this.errorHandlerService.logError(error, {
        action: 'getBusById',
        endpoint: '/buses/:id',
        busId: req.params.id,
      });

      // Format and return error response
      const formattedError = this.errorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Check seat availability for a bus on a specific date
   * GET /buses/:id/availability?date=2024-06-15
   * 
   * URL Parameters:
   * - id: Bus ID (MongoDB ObjectId)
   * 
   * Query Parameters:
   * - date: Travel date in YYYY-MM-DD format (required)
   * 
   * Response: 200 OK with availability information
   * Error: 400 Bad Request (invalid date format), 404 Not Found
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async checkAvailability(req, res) {
    try {
      // Extract and validate parameters
      const { id: busId } = req.params;
      const { date } = req.query;

      if (!busId) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError('Bus ID is required', { field: 'id' })
          )
        );
      }

      if (!date) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError('Date parameter is required', { field: 'date' })
          )
        );
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError(
              'Invalid date format. Expected YYYY-MM-DD',
              { field: 'date' }
            )
          )
        );
      }

      // Call service to check availability
      const availability = await this.busService.checkAvailability(busId, date);

      // Return 200 OK with availability information
      return res.status(200).json({
        success: true,
        data: availability,
        message: 'Availability information retrieved successfully',
      });
    } catch (error) {
      // Handle specific error types
      if (error instanceof NotFoundError) {
        return res.status(404).json(this.errorHandlerService.formatError(error));
      }

      if (error instanceof ValidationError) {
        return res.status(400).json(this.errorHandlerService.formatError(error));
      }

      // Log error and format response
      this.errorHandlerService.logError(error, {
        action: 'checkAvailability',
        endpoint: '/buses/:id/availability',
        busId: req.params.id,
        date: req.query.date,
      });

      // Format and return error response
      const formattedError = this.errorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }
}

module.exports = BusController;
