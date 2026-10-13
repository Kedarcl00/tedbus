/**
 * BookingController
 * Handles HTTP requests for booking operations
 * Delegates business logic to BookingService
 * 
 * Key Principles:
 * - Extract userId from request.user.id (set by auth middleware)
 * - Never trust client-provided user IDs
 * - Let services handle business logic and throw errors
 * - ErrorHandlerMiddleware formats all responses
 * - Return proper HTTP status codes for each scenario
 */

const BookingService = require('../services/booking.service');
const ErrorHandlerService = require('../services/error-handler.service');
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  BusinessRuleError,
} = require('../utils/custom-errors');

class BookingController {
  /**
   * Create a new booking
   * POST /bookings
   * 
   * @param {Object} req - Express request object
   * @param {string} req.user.id - Authenticated user ID (from middleware)
   * @param {Object} req.body - Booking data
   * @param {Object} res - Express response object
   * @returns {Promise<void>} 201 Created or error response
   */
  async createBooking(req, res) {
    try {
      // Extract userId from authenticated request context (NOT from request body)
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(
          ErrorHandlerService.formatError(
            new Error('Unauthorized: user ID not found in request context')
          )
        );
      }

      // Validate request body exists
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Request body is required')
          )
        );
      }

      // Call service to create booking
      const booking = await BookingService.createBooking(userId, req.body);

      // Return 201 Created with booking details
      return res.status(201).json({
        success: true,
        data: booking,
        message: 'Booking created successfully',
      });
    } catch (error) {
      // Service throws structured errors - let error handler middleware catch them
      // If error reaches here, format and send response
      const formattedError = ErrorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Retrieve all bookings for authenticated user
   * GET /bookings/my
   * 
   * @param {Object} req - Express request object
   * @param {string} req.user.id - Authenticated user ID (from middleware)
   * @param {Object} req.query - Query parameters {limit, skip, sortBy}
   * @param {Object} res - Express response object
   * @returns {Promise<void>} 200 OK with bookings array
   */
  async getBookingsByCustomer(req, res) {
    try {
      // Extract userId from authenticated request context
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(
          ErrorHandlerService.formatError(
            new Error('Unauthorized: user ID not found in request context')
          )
        );
      }

      // Parse query parameters
      const limit = parseInt(req.query.limit) || 10;
      const skip = parseInt(req.query.skip) || 0;
      const sortBy = req.query.sortBy || '-departureDetails.date';

      // Validate pagination parameters
      if (limit < 1 || limit > 100) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Limit must be between 1 and 100')
          )
        );
      }

      if (skip < 0) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Skip must be non-negative')
          )
        );
      }

      // Call service to retrieve bookings
      const bookings = await BookingService.getBookingsByCustomer(userId, {
        limit,
        skip,
        sortBy,
      });

      // Return 200 OK with bookings (empty array is valid)
      return res.status(200).json({
        success: true,
        data: bookings,
        count: bookings.length,
        message: bookings.length > 0
          ? 'Bookings retrieved successfully'
          : 'No bookings found',
      });
    } catch (error) {
      const formattedError = ErrorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Retrieve a specific booking by ID with user isolation
   * GET /bookings/:id
   * 
   * @param {Object} req - Express request object
   * @param {string} req.user.id - Authenticated user ID (from middleware)
   * @param {string} req.params.id - Booking ID
   * @param {Object} res - Express response object
   * @returns {Promise<void>} 200 OK with booking details or error response
   */
  async getBookingById(req, res) {
    try {
      // Extract userId from authenticated request context
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(
          ErrorHandlerService.formatError(
            new Error('Unauthorized: user ID not found in request context')
          )
        );
      }

      // Extract booking ID from URL parameters
      const { id: bookingId } = req.params;
      if (!bookingId) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Booking ID is required')
          )
        );
      }

      // Call service to retrieve booking (service enforces user isolation)
      const booking = await BookingService.getBookingById(bookingId, userId);

      // Return 200 OK with booking details
      return res.status(200).json({
        success: true,
        data: booking,
        message: 'Booking retrieved successfully',
      });
    } catch (error) {
      // Handle specific error types with appropriate status codes
      if (error instanceof NotFoundError) {
        return res.status(404).json(ErrorHandlerService.formatError(error));
      }
      if (error instanceof ForbiddenError) {
        return res.status(403).json(ErrorHandlerService.formatError(error));
      }

      const formattedError = ErrorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Cancel a booking
   * DELETE /bookings/:id
   * 
   * @param {Object} req - Express request object
   * @param {string} req.user.id - Authenticated user ID (from middleware)
   * @param {string} req.params.id - Booking ID
   * @param {Object} res - Express response object
   * @returns {Promise<void>} 200 OK with cancellation details or error response
   */
  async cancelBooking(req, res) {
    try {
      // Extract userId from authenticated request context
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(
          ErrorHandlerService.formatError(
            new Error('Unauthorized: user ID not found in request context')
          )
        );
      }

      // Extract booking ID from URL parameters
      const { id: bookingId } = req.params;
      if (!bookingId) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Booking ID is required')
          )
        );
      }

      // Call service to cancel booking (service enforces user isolation)
      const result = await BookingService.cancelBooking(bookingId, userId);

      // Return 200 OK with cancellation result
      return res.status(200).json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (error) {
      // Handle specific error types with appropriate status codes
      if (error instanceof NotFoundError) {
        return res.status(404).json(ErrorHandlerService.formatError(error));
      }
      if (error instanceof ForbiddenError) {
        return res.status(403).json(ErrorHandlerService.formatError(error));
      }
      if (error instanceof BusinessRuleError) {
        return res.status(400).json(ErrorHandlerService.formatError(error));
      }

      const formattedError = ErrorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Update booking status
   * PUT /bookings/:id/status
   * 
   * @param {Object} req - Express request object
   * @param {string} req.user.id - Authenticated user ID (from middleware)
   * @param {string} req.params.id - Booking ID
   * @param {Object} req.body - Update data {status: string}
   * @param {Object} res - Express response object
   * @returns {Promise<void>} 200 OK with updated booking or error response
   */
  async updateBookingStatus(req, res) {
    try {
      // Extract userId from authenticated request context
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(
          ErrorHandlerService.formatError(
            new Error('Unauthorized: user ID not found in request context')
          )
        );
      }

      // Extract booking ID from URL parameters
      const { id: bookingId } = req.params;
      if (!bookingId) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Booking ID is required')
          )
        );
      }

      // Validate request body
      if (!req.body || !req.body.status) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Status is required in request body')
          )
        );
      }

      // Validate status value
      const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(req.body.status.toLowerCase())) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError(
              `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            )
          )
        );
      }

      // Call service to update booking status
      const updatedBooking = await BookingService.updateBookingStatus(
        bookingId,
        req.body.status.toLowerCase(),
        userId
      );

      // Return 200 OK with updated booking
      return res.status(200).json({
        success: true,
        data: updatedBooking,
        message: 'Booking status updated successfully',
      });
    } catch (error) {
      // Handle specific error types with appropriate status codes
      if (error instanceof NotFoundError) {
        return res.status(404).json(ErrorHandlerService.formatError(error));
      }
      if (error instanceof ForbiddenError) {
        return res.status(403).json(ErrorHandlerService.formatError(error));
      }
      if (error instanceof ValidationError) {
        return res.status(400).json(ErrorHandlerService.formatError(error));
      }

      const formattedError = ErrorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }
}

// Export as singleton instance for dependency injection
module.exports = new BookingController();
