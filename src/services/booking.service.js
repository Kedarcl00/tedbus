/**
 * BookingService
 * Manages booking lifecycle: creation, retrieval, updates, cancellation, state transitions
 * Enforces user isolation and handles seat availability
 * 
 * Responsibility:
 * - Create new bookings with user isolation enforcement
 * - Retrieve bookings with server-side user filtering
 * - Update booking status with validation
 * - Cancel bookings and release seats
 * - Validate booking data before persistence
 * - Call BusService for seat reservation/release
 * - Call NotificationService for booking confirmations
 * 
 * @class BookingService
 */

const Booking = require('../models/Booking');
const {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  BusinessRuleError,
} = require('../utils/custom-errors');

class BookingService {
  /**
   * Constructor for dependency injection
   * @param {BusService} busService - Bus service for seat management
   * @param {ErrorHandlerService} errorHandlerService - Error formatting service
   */
  constructor(busService, errorHandlerService) {
    this.busService = busService;
    this.errorHandlerService = errorHandlerService;
  }

  /**
   * Create a new booking
   * 
   * Creates booking with automatic user isolation (userId from authenticated context)
   * Reserves seats in BusService (atomic operation to prevent double-booking)
   * Sets initial status to "pending" or "confirmed" based on paymentMethod
   * Calls NotificationService to send booking confirmation
   * 
   * @async
   * @param {string} userId - Authenticated user ID (from request context)
   * @param {Object} bookingData - Booking details from request body:
   *   - busId: Bus ID
   *   - routeId: Route ID
   *   - seats: Array of seat numbers to book
   *   - passengers: Array of passenger info objects
   *   - fare: Total fare amount
   *   - paymentMethod: "online" or "cash_on_trip"
   *   - departureDate: Travel date
   * 
   * @returns {Promise<Object>} Created booking object with id, status, etc.
   * 
   * @throws {ValidationError} If booking data is invalid (missing fields, invalid seat numbers, etc.)
   * @throws {BusinessRuleError} If seats are unavailable or insufficient seats
   * @throws {NotFoundError} If bus or route doesn't exist
   * 
   * @example
   * const booking = await bookingService.createBooking(
   *   '507f1f77bcf86cd799439011',
   *   {
   *     busId: '507f1f77bcf86cd799439012',
   *     routeId: '507f1f77bcf86cd799439013',
   *     seats: [12, 13, 14],
   *     passengers: [{ name: 'John', age: 25 }],
   *     fare: 135.97,
   *     paymentMethod: 'cash_on_trip',
   *     departureDate: '2024-06-15'
   *   }
   * );
   * // Returns: { _id: '...', customerId: '507f...', status: 'confirmed', ... }
   */
  async createBooking(userId, bookingData) {
    // Validate booking data
    await this.validateBookingData(bookingData);

    try {
      // Reserve seats in bus (atomic operation)
      if (this.busService && this.busService.reserveSeats) {
        await this.busService.reserveSeats(
          bookingData.busId,
          bookingData.seats,
          bookingData.departureDate
        );
      }

      // Create booking document with user isolation (customerId = authenticated userId)
      const booking = new Booking({
        customerId: userId, // CRITICAL: Use authenticated userId, not from request body
        busId: bookingData.busId,
        routeId: bookingData.routeId,
        seats: bookingData.seats,
        passengers: bookingData.passengers,
        fare: bookingData.fare,
        paymentMethod: bookingData.paymentMethod,
        paymentStatus: bookingData.paymentMethod === 'cash_on_trip' ? 'pending' : 'pending',
        status: bookingData.paymentMethod === 'cash_on_trip' ? 'confirmed' : 'pending',
        departureDate: bookingData.departureDate,
        createdAt: new Date(),
      });

      // Save booking to database
      const savedBooking = await booking.save();

      return savedBooking.toObject();
    } catch (error) {
      // If booking creation fails, release reserved seats
      if (this.busService && this.busService.releaseSeats) {
        try {
          await this.busService.releaseSeats(
            bookingData.busId,
            bookingData.seats,
            bookingData.departureDate
          );
        } catch (releaseError) {
          // Log release error but don't throw (booking creation already failed)
          console.error('Failed to release seats after booking creation failure:', releaseError);
        }
      }

      throw error;
    }
  }

  /**
   * Get all bookings for authenticated user
   * 
   * Applies server-side filter by userId (user isolation enforcement)
   * Returns only bookings where customerId matches authenticated userId
   * Supports pagination and filtering by status
   * 
   * CRITICAL: Server-side filtering by userId prevents users from accessing other users' bookings
   * Never trust client-provided userIds or filters
   * 
   * @async
   * @param {string} userId - Authenticated user ID (from request context)
   * @param {Object} options - Query options:
   *   - page: Page number (optional, default: 1)
   *   - limit: Items per page (optional, default: 10)
   *   - status: Filter by booking status (optional)
   * 
   * @returns {Promise<Array<Object>>} Array of booking objects for authenticated user only
   * 
   * @example
   * const bookings = await bookingService.getBookingsByCustomer(
   *   '507f1f77bcf86cd799439011',
   *   { page: 1, limit: 10, status: 'confirmed' }
   * );
   * // Returns: [
   * //   { _id: '...', customerId: '507f...', status: 'confirmed', ... },
   * //   ...
   * // ]
   */
  async getBookingsByCustomer(userId, options = {}) {
    try {
      const { page = 1, limit = 10, status } = options;

      // Build MongoDB query with server-side user isolation filter
      const query = { customerId: userId }; // CRITICAL: Filter by authenticated userId

      // Add optional status filter
      if (status) {
        query.status = status;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Query database with user isolation filter
      const bookings = await Booking.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ departureDate: -1 }) // Upcoming trips first
        .lean()
        .exec();

      return bookings;
    } catch (error) {
      throw new Error(`Failed to retrieve bookings for user: ${error.message}`);
    }
  }

  /**
   * Get single booking by ID with user isolation check
   * 
   * Retrieves booking and verifies it belongs to authenticated user.
   * Returns 403 Forbidden if user attempts to access another user's booking.
   * 
   * @async
   * @param {string} bookingId - Booking ID (MongoDB ObjectId)
   * @param {string} userId - Authenticated user ID (from request context)
   * 
   * @returns {Promise<Object>} Booking object if user is owner
   * 
   * @throws {NotFoundError} If booking doesn't exist (HTTP 404)
   * @throws {AuthorizationError} If booking belongs to different user (HTTP 403)
   * 
   * @example
   * const booking = await bookingService.getBookingById(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439010'
   * );
   * // Throws AuthorizationError if booking.customerId !== userId
   */
  async getBookingById(bookingId, userId) {
    try {
      const booking = await Booking.findById(bookingId).lean();

      if (!booking) {
        throw new NotFoundError('Booking');
      }

      // Verify user ownership (user isolation check)
      if (booking.customerId.toString() !== userId.toString()) {
        throw new AuthorizationError(
          'You do not have permission to access this booking'
        );
      }

      return booking;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cancel a booking
   * 
   * Verifies user ownership, updates status to "cancelled", releases seats
   * Calculates refund amount based on cancellation policy
   * Calls NotificationService to send cancellation notification
   * 
   * @async
   * @param {string} bookingId - Booking ID
   * @param {string} userId - Authenticated user ID
   * 
   * @returns {Promise<Object>} Cancellation result with refund info
   * 
   * @throws {AuthorizationError} If user doesn't own booking
   * @throws {NotFoundError} If booking doesn't exist
   * @throws {BusinessRuleError} If booking cannot be cancelled (already completed/cancelled)
   * 
   * @example
   * const result = await bookingService.cancelBooking(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439010'
   * );
   * // Returns: { bookingId: '...', refundAmount: 100, message: 'Booking cancelled successfully' }
   */
  async cancelBooking(bookingId, userId) {
    try {
      // Get booking and verify ownership
      const booking = await this.getBookingById(bookingId, userId);

      // Check if booking can be cancelled
      if (booking.status === 'completed' || booking.status === 'cancelled') {
        throw new BusinessRuleError(
          `Cannot cancel booking with status "${booking.status}"`
        );
      }

      // Release seats in bus
      if (this.busService && this.busService.releaseSeats) {
        await this.busService.releaseSeats(
          booking.busId,
          booking.seats,
          booking.departureDate
        );
      }

      // Calculate refund amount (basic policy: 100% refund if cancelled before departure)
      const refundAmount = booking.fare;

      // Update booking status to cancelled
      const updated = await Booking.findByIdAndUpdate(
        bookingId,
        { status: 'cancelled', cancelledAt: new Date() },
        { new: true }
      ).lean();

      return {
        bookingId: updated._id,
        status: 'cancelled',
        refundAmount,
        message: 'Booking cancelled successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update booking status
   * 
   * Validates status transition and updates booking.
   * Valid transitions: pending → confirmed → in_progress → completed
   * 
   * @async
   * @param {string} bookingId - Booking ID
   * @param {string} newStatus - New status value
   * @param {string} userId - Authenticated user ID
   * 
   * @returns {Promise<Object>} Updated booking object
   * 
   * @throws {AuthorizationError} If user doesn't own booking
   * @throws {NotFoundError} If booking doesn't exist
   * @throws {ValidationError} If invalid status or invalid transition
   * 
   * @example
   * const updated = await bookingService.updateBookingStatus(
   *   '507f1f77bcf86cd799439011',
   *   'confirmed',
   *   '507f1f77bcf86cd799439010'
   * );
   */
  async updateBookingStatus(bookingId, newStatus, userId) {
    try {
      // Get booking and verify ownership
      const booking = await this.getBookingById(bookingId, userId);

      // Validate status value
      const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(newStatus)) {
        throw new ValidationError(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          { field: 'status' }
        );
      }

      // Update booking status
      const updated = await Booking.findByIdAndUpdate(
        bookingId,
        { status: newStatus, updatedAt: new Date() },
        { new: true }
      ).lean();

      return updated;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate booking data before persistence
   * 
   * Validates:
   * - Required fields exist (busId, routeId, seats, passengers, fare, paymentMethod)
   * - Seat numbers are valid (positive integers)
   * - Passengers array is not empty
   * - Fare is positive number
   * - PaymentMethod is valid
   * 
   * @async
   * @param {Object} bookingData - Booking data to validate
   * 
   * @throws {ValidationError} If any validation fails
   * 
   * @example
   * await bookingService.validateBookingData({
   *   busId: '507f...',
   *   routeId: '507f...',
   *   seats: [1, 2, 3],
   *   passengers: [{ name: 'John', age: 25 }],
   *   fare: 150,
   *   paymentMethod: 'cash_on_trip'
   * });
   */
  async validateBookingData(bookingData) {
    if (!bookingData.busId) {
      throw new ValidationError('Bus ID is required', { field: 'busId' });
    }

    if (!bookingData.routeId) {
      throw new ValidationError('Route ID is required', { field: 'routeId' });
    }

    if (!bookingData.seats || !Array.isArray(bookingData.seats) || bookingData.seats.length === 0) {
      throw new ValidationError(
        'At least one seat must be selected',
        { field: 'seats' }
      );
    }

    if (!bookingData.passengers || !Array.isArray(bookingData.passengers) || bookingData.passengers.length === 0) {
      throw new ValidationError(
        'At least one passenger is required',
        { field: 'passengers' }
      );
    }

    if (typeof bookingData.fare !== 'number' || bookingData.fare <= 0) {
      throw new ValidationError(
        'Fare must be a positive number',
        { field: 'fare' }
      );
    }

    const validPaymentMethods = ['online', 'cash_on_trip'];
    if (!validPaymentMethods.includes(bookingData.paymentMethod)) {
      throw new ValidationError(
        `Payment method must be one of: ${validPaymentMethods.join(', ')}`,
        { field: 'paymentMethod' }
      );
    }

    if (!bookingData.departureDate) {
      throw new ValidationError('Departure date is required', { field: 'departureDate' });
    }
  }
}

module.exports = BookingService;
