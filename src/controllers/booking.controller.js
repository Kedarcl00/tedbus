/**
 * BookingController
 * Handles HTTP requests for booking operations (create, retrieve, cancel, update status)
 * Delegates business logic to BookingService
 * 
 * Key Principles:
 * - Extract userId from request.user.id (set by auth middleware)
 * - Never trust client-provided user IDs - use authenticated userId from middleware
 * - Thin controller that only handles HTTP concerns
 * - Delegate all business logic to services
 * - Return proper HTTP status codes for each scenario
 * - Let ErrorHandlerService format error responses
 * - All endpoints require authentication
 * 
 * @class BookingController
 */

const BookingService = require('../services/booking.service');
const ErrorHandlerService = require('../services/error-handler.service');
const {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  BusinessRuleError,
} = require('../utils/custom-errors');

class BookingController {
  /**
   * Constructor for dependency injection
   * @param {BookingService} bookingService - Booking service for business logic
   * @param {ErrorHandlerService} errorHandlerService - Error formatting service
   */
  constructor(bookingService, errorHandlerService) {
    if (!bookingService) {
      throw new Error('BookingService is required for BookingController');
    }
    if (!errorHandlerService) {
      throw new Error('ErrorHandlerService is required for BookingController');
    }

    this.bookingService = bookingService;
    this.errorHandlerService = errorHandlerService;
  }

  /**
   * Create a new booking
   * POST /bookings
   * 
   * Authentication: Required
   * 
   * Request Body:
   * {
   *   busId: string,
   *   routeId: string,
   *   seats: number[],
   *   passengers: object[],
   *   fare: number,
   *   paymentMethod: "online" | "cash_on_trip"
   * }
   * 
   * Response: 201 Created with booking details
   * Error: 400 Bad Request (validation), 401 Unauthorized, 500 Internal Server Error
   * 
   * @param {Object} req - Express request object
   * @param {string} req.user.id - Authenticated user ID (from middleware)
   * @param {Object} req.body - Booking data
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async createBooking(req, res) {
    try {
      // Extract userId from authenticated request context (NOT from request body)
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(
          this.errorHandlerService.formatError(
            new ValidationError('Unauthorized: user ID not found in request context')
          )
        );
      }

      // Validate request body exists
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError('Request body is required')
          )
        );
      }

      // Call service to create booking
      const booking = await this.bookingService.createBooking(userId, req.body);

      // Return 201 Created with booking details
      return res.status(201).json({
        success: true,
        data: booking,
        message: 'Booking created successfully',
      });
    } catch (error) {
      // Handle specific error types
      if (error instanceof ValidationError) {
        return res.status(400).json(this.errorHandlerService.formatError(error));
      }

      if (error instanceof BusinessRuleError) {
        return res.status(400).json(this.errorHandlerService.formatError(error));
      }

      // Log error and format response
      this.errorHandlerService.logError(error, {
        action: 'createBooking',
        endpoint: '/bookings',
        userId,
      });

      // Format and return error response
      const formattedError = this.errorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Retrieve all bookings for authenticated user
   * GET /bookings/my
   * 
   * Authentication: Required
   * 
   * Query Parameters (optional):
   * - page: Page number for pagination
   * - limit: Items per page
   * - status: Filter by booking status
   * 
   * Response: 200 OK with bookings array
   * Error: 401 Unauthorized, 500 Internal Server Error
   * 
   * @param {Object} req - Express request object
   * @param {string} req.user.id - Authenticated user ID (from middleware)
   * @param {Object} req.query - Query parameters
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async getBookingsByCustomer(req, res) {
    try {
      // Extract userId from authenticated request context
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(
          this.errorHandlerService.formatError(
            new ValidationError('Unauthorized: user ID not found in request context')
          )
        );
      }

      // Parse query parameters
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status;

      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError('Invalid pagination parameters')
          )
        );
      }

      // Build query options
      const options = { page, limit };
      if (status) {
        options.status = status;
      }

      // Call service to get user bookings
      // Service will apply server-side filter by userId (user isolation)
      const bookings = await this.bookingService.getBookingsByCustomer(userId, options);

      // Return 200 OK with bookings array
      return res.status(200).json({
        success: true,
        data: bookings,
        count: bookings.length,
        message: bookings.length > 0
          ? 'Bookings retrieved successfully'
          : 'No bookings found',
      });
    } catch (error) {
      // Log error and format response
      this.errorHandlerService.logError(error, {
        action: 'getBookingsByCustomer',
        endpoint: '/bookings/my',
        userId: req.user?.id,
      });

      // Format and return error response
      const formattedError = this.errorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Retrieve specific booking by ID
   * GET /bookings/:id
   * 
   * Authentication: Required
   * 
   * URL Parameters:
   * - id: Booking ID (MongoDB ObjectId)
   * 
   * Response: 200 OK with booking details
   * Error: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found
   * 
   * @param {Object} req - Express request object
   * @param {string} req.user.id - Authenticated user ID (from middleware)
   * @param {Object} req.params - Path parameters
   * @param {string} req.params.id - Booking ID
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async getBookingById(req, res) {
    try {
      // Extract userId from authenticated request context
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(
          this.errorHandlerService.formatError(
            new ValidationError('Unauthorized: user ID not found in request context')
          )
        );
      }

      // Extract and validate booking ID
      const { id: bookingId } = req.params;
      if (!bookingId) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError('Booking ID is required', { field: 'id' })
          )
        );
      }

      // Call service to get booking
      // Service will verify user ownership (user isolation check)
      const booking = await this.bookingService.getBookingById(bookingId, userId);

      // Return 200 OK with booking details
      return res.status(200).json({
        success: true,
        data: booking,
        message: 'Booking retrieved successfully',
      });
    } catch (error) {
      // Handle specific error types
      if (error instanceof AuthorizationError) {
        return res.status(403).json(this.errorHandlerService.formatError(error));
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json(this.errorHandlerService.formatError(error));
      }

      if (error instanceof ValidationError) {
        return res.status(400).json(this.errorHandlerService.formatError(error));
      }

      // Log error and format response
      this.errorHandlerService.logError(error, {
        action: 'getBookingById',
        endpoint: '/bookings/:id',
        bookingId: req.params.id,
        userId: req.user?.id,
      });

      // Format and return error response
      const formattedError = this.errorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Cancel a booking
   * DELETE /bookings/:id
   * 
   * Authentication: Required
   * 
   * URL Parameters:
   * - id: Booking ID (MongoDB ObjectId)
   * 
   * Response: 200 OK with cancellation result
   * Error: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found
   * 
   * @param {Object} req - Express request object
   * @param {string} req.user.id - Authenticated user ID (from middleware)
   * @param {Object} req.params - Path parameters
   * @param {string} req.params.id - Booking ID
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async cancelBooking(req, res) {
    try {
      // Extract userId from authenticated request context
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(
          this.errorHandlerService.formatError(
            new ValidationError('Unauthorized: user ID not found in request context')
          )
        );
      }

      // Extract and validate booking ID
      const { id: bookingId } = req.params;
      if (!bookingId) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError('Booking ID is required', { field: 'id' })
          )
        );
      }

      // Call service to cancel booking
      // Service will verify user ownership and update booking status
      const result = await this.bookingService.cancelBooking(bookingId, userId);

      // Return 200 OK with cancellation result
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Booking cancelled successfully',
      });
    } catch (error) {
      // Handle specific error types
      if (error instanceof AuthorizationError) {
        return res.status(403).json(this.errorHandlerService.formatError(error));
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json(this.errorHandlerService.formatError(error));
      }

      if (error instanceof BusinessRuleError) {
        return res.status(400).json(this.errorHandlerService.formatError(error));
      }

      if (error instanceof ValidationError) {
        return res.status(400).json(this.errorHandlerService.formatError(error));
      }

      // Log error and format response
      this.errorHandlerService.logError(error, {
        action: 'cancelBooking',
        endpoint: '/bookings/:id',
        bookingId: req.params.id,
        userId: req.user?.id,
      });

      // Format and return error response
      const formattedError = this.errorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Update booking status
   * PUT /bookings/:id/status
   * 
   * Authentication: Required
   * 
   * URL Parameters:
   * - id: Booking ID (MongoDB ObjectId)
   * 
   * Request Body:
   * {
   *   status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled"
   * }
   * 
   * Response: 200 OK with updated booking details
   * Error: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found
   * 
   * @param {Object} req - Express request object
   * @param {string} req.user.id - Authenticated user ID (from middleware)
   * @param {Object} req.params - Path parameters
   * @param {string} req.params.id - Booking ID
   * @param {Object} req.body - Status update data
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async updateBookingStatus(req, res) {
    try {
      // Extract userId from authenticated request context
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(
          this.errorHandlerService.formatError(
            new ValidationError('Unauthorized: user ID not found in request context')
          )
        );
      }

      // Extract and validate booking ID
      const { id: bookingId } = req.params;
      if (!bookingId) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError('Booking ID is required', { field: 'id' })
          )
        );
      }

      // Extract and validate new status
      const { status: newStatus } = req.body;
      if (!newStatus) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError('Status is required in request body', { field: 'status' })
          )
        );
      }

      // Call service to update booking status
      // Service will verify user ownership and validate status transition
      const updatedBooking = await this.bookingService.updateBookingStatus(
        bookingId,
        newStatus,
        userId
      );

      // Return 200 OK with updated booking details
      return res.status(200).json({
        success: true,
        data: updatedBooking,
        message: 'Booking status updated successfully',
      });
    } catch (error) {
      // Handle specific error types
      if (error instanceof AuthorizationError) {
        return res.status(403).json(this.errorHandlerService.formatError(error));
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json(this.errorHandlerService.formatError(error));
      }

      if (error instanceof ValidationError || error instanceof BusinessRuleError) {
        return res.status(400).json(this.errorHandlerService.formatError(error));
      }

      // Log error and format response
      this.errorHandlerService.logError(error, {
        action: 'updateBookingStatus',
        endpoint: '/bookings/:id/status',
        bookingId: req.params.id,
        newStatus: req.body.status,
        userId: req.user?.id,
      });

      // Format and return error response
      const formattedError = this.errorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }
}

module.exports = BookingController;
