/**
 * Booking Routes
 * Defines endpoints for booking operations: create, retrieve, cancel, update status
 * 
 * All endpoints require authentication middleware
 * Protected routes: /bookings/*, /bookings/:id
 */

const express = require('express');

/**
 * Create booking routes with dependency injection
 * @param {BookingController} bookingController - Injected BookingController instance
 * @param {Function} authMiddleware - Express middleware for authentication
 * @returns {Router} Express router with booking endpoints
 *
 * @example
 * const bookingRoutes = createBookingRoutes(bookingController, authMiddleware);
 * app.use('/bookings', bookingRoutes);
 */
function createBookingRoutes(bookingController, authMiddleware) {
  if (!bookingController) {
    throw new Error('BookingController is required for booking routes');
  }

  const router = express.Router();

  /**
   * POST /bookings
   * Create a new booking
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
   * Response:
   * {
   *   success: true,
   *   data: { booking object },
   *   message: "Booking created successfully"
   * }
   * 
   * Error Codes:
   * - 400: Bad Request (validation error, insufficient seats)
   * - 401: Unauthorized (not authenticated)
   * - 403: Forbidden (user not allowed to access resource)
   * - 500: Internal Server Error
   */
  router.post('/', authMiddleware, (req, res, next) => {
    bookingController.createBooking(req, res);
  });

  /**
   * GET /bookings/my
   * Retrieve all bookings for authenticated user
   * 
   * Authentication: Required
   * 
   * Query Parameters (optional):
   * - page: pagination page number
   * - limit: items per page
   * - status: filter by booking status (pending, confirmed, cancelled, completed)
   * 
   * Response:
   * {
   *   success: true,
   *   data: [{ booking object }, ...],
   *   count: number,
   *   message: "Bookings retrieved successfully"
   * }
   * 
   * Error Codes:
   * - 401: Unauthorized (not authenticated)
   * - 500: Internal Server Error
   */
  router.get('/my', authMiddleware, (req, res, next) => {
    bookingController.getBookingsByCustomer(req, res);
  });

  /**
   * GET /bookings/:id
   * Retrieve specific booking by ID
   * 
   * Authentication: Required
   * 
   * URL Parameters:
   * - id: Booking ID (MongoDB ObjectId)
   * 
   * Response:
   * {
   *   success: true,
   *   data: { booking object },
   *   message: "Booking retrieved successfully"
   * }
   * 
   * Error Codes:
   * - 400: Bad Request (invalid booking ID format)
   * - 401: Unauthorized (not authenticated)
   * - 403: Forbidden (user accessing another user's booking)
   * - 404: Not Found (booking doesn't exist)
   * - 500: Internal Server Error
   */
  router.get('/:id', authMiddleware, (req, res, next) => {
    bookingController.getBookingById(req, res);
  });

  /**
   * DELETE /bookings/:id
   * Cancel a booking
   * 
   * Authentication: Required
   * 
   * URL Parameters:
   * - id: Booking ID (MongoDB ObjectId)
   * 
   * Response:
   * {
   *   success: true,
   *   data: { cancellation result with refund info },
   *   message: "Booking cancelled successfully"
   * }
   * 
   * Error Codes:
   * - 400: Bad Request (invalid ID, cannot cancel completed booking)
   * - 401: Unauthorized (not authenticated)
   * - 403: Forbidden (user accessing another user's booking)
   * - 404: Not Found (booking doesn't exist)
   * - 500: Internal Server Error
   */
  router.delete('/:id', authMiddleware, (req, res, next) => {
    bookingController.cancelBooking(req, res);
  });

  /**
   * PUT /bookings/:id/status
   * Update booking status (e.g., pending → confirmed → completed)
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
   * Response:
   * {
   *   success: true,
   *   data: { updated booking object },
   *   message: "Booking status updated successfully"
   * }
   * 
   * Error Codes:
   * - 400: Bad Request (invalid status, invalid state transition)
   * - 401: Unauthorized (not authenticated)
   * - 403: Forbidden (user accessing another user's booking)
   * - 404: Not Found (booking doesn't exist)
   * - 500: Internal Server Error
   */
  router.put('/:id/status', authMiddleware, (req, res, next) => {
    bookingController.updateBookingStatus(req, res);
  });

  return router;
}

module.exports = createBookingRoutes;
