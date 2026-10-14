/**
 * BookingService
 * Manages booking lifecycle: creation, retrieval, updates, cancellation, state transitions
 * 
 * Key Features:
 * - User isolation enforcement (userId must match booking.customerId)
 * - State transitions: pending → confirmed → in_progress → completed
 * - Seat management via BusService
 * - Notifications via NotificationService
 * - Refund calculation on cancellation
 */

const Booking = require('../models/booking');
const Customer = require('../models/customer');
const BusService = require('./bus.service');
const NotificationService = require('./notification.service');
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  BusinessRuleError,
  InsufficientSeatsError,
} = require('../utils/custom-errors');

// Valid booking status transitions
const BOOKING_STATES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// Valid state transitions map
const VALID_TRANSITIONS = {
  [BOOKING_STATES.PENDING]: [BOOKING_STATES.CONFIRMED, BOOKING_STATES.CANCELLED],
  [BOOKING_STATES.CONFIRMED]: [BOOKING_STATES.IN_PROGRESS, BOOKING_STATES.CANCELLED],
  [BOOKING_STATES.IN_PROGRESS]: [BOOKING_STATES.COMPLETED, BOOKING_STATES.CANCELLED],
  [BOOKING_STATES.COMPLETED]: [], // No transitions from completed
  [BOOKING_STATES.CANCELLED]: [], // No transitions from cancelled
};

class BookingService {
  /**
   * Create a new booking with user isolation enforcement
   * @param {string} userId - Authenticated user ID
   * @param {Object} bookingData - Booking data (from request)
   * @returns {Promise<Object>} Created booking
   * @throws {ValidationError} If booking data is invalid
   * @throws {InsufficientSeatsError} If seats not available
   * @throws {BusinessRuleError} If booking violates business rules
   */
  async createBooking(userId, bookingData) {
    try {
      // Validate booking data
      await this.validateBookingData(bookingData);

      // Get customer details
      const customer = await Customer.findById(userId);
      if (!customer) {
        throw new NotFoundError('Customer');
      }

      // Check seat availability and reserve seats
      const reservationToken = await BusService.reserveSeats(
        bookingData.busId,
        bookingData.seats,
        bookingData.departureDetails.date
      );

      // Determine initial status based on payment method
      let initialStatus = BOOKING_STATES.PENDING;
      if (bookingData.paymentMethod === 'cash_on_trip') {
        initialStatus = BOOKING_STATES.CONFIRMED;
      }

      // Create booking with userId server-side (not from request)
      const booking = await Booking.create({
        customerId: userId, // Server-side enforcement: use authenticated userId
        busId: bookingData.busId,
        routeId: bookingData.routeId,
        seats: bookingData.seats,
        fare: bookingData.fare,
        status: initialStatus,
        paymentMethod: bookingData.paymentMethod || 'online',
        paymentStatus: initialStatus === BOOKING_STATES.CONFIRMED ? 'pending' : 'pending',
        passengers: bookingData.passengers || bookingData.passengerDetails || [], // Fix: support passengerDetails alias
        departureDate: bookingData.departureDate,
      });

      // Send confirmation notification (don't block if fails)
      try {
        await NotificationService.sendBookingConfirmation(booking.toObject(), customer.toObject());
      } catch (notificationError) {
        // Log but don't throw - notifications should not block booking
        console.error('Failed to send booking confirmation:', notificationError.message);
      }

      return booking.toObject();
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof InsufficientSeatsError ||
        error instanceof BusinessRuleError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }
      throw new BusinessRuleError(`Failed to create booking: ${error.message}`);
    }
  }

  /**
   * Retrieve all bookings for authenticated user only
   * @param {string} userId - Authenticated user ID
   * @param {Object} options - Query options {limit, skip, sortBy}
   * @returns {Promise<Array>} User's bookings
   */
  async getBookingsByCustomer(userId, options = {}) {
    try {
      const { limit = 10, skip = 0, sortBy = '-departureDetails.date' } = options;

      const bookings = await Booking.find({ customerId: userId })
        .sort(sortBy)
        .limit(limit)
        .skip(skip)
        .lean()
        .exec();

      return bookings;
    } catch (error) {
      throw new BusinessRuleError(`Failed to retrieve bookings: ${error.message}`);
    }
  }

  /**
   * Get single booking with user isolation check
   * @param {string} bookingId - Booking ID
   * @param {string} userId - Authenticated user ID
   * @returns {Promise<Object>} Booking details
   * @throws {NotFoundError} If booking not found
   * @throws {ForbiddenError} If user not booking owner
   */
  async getBookingById(bookingId, userId) {
    const booking = await Booking.findById(bookingId).lean().exec();

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // User isolation: verify userId matches booking owner
    if (booking.customerId.toString() !== userId.toString()) {
      throw new ForbiddenError('You do not have permission to access this booking');
    }

    return booking;
  }

  /**
   * Cancel booking and update seat availability
   * @param {string} bookingId - Booking ID
   * @param {string} userId - Authenticated user ID
   * @returns {Promise<Object>} Cancellation result with refund info
   * @throws {NotFoundError} If booking not found
   * @throws {ForbiddenError} If user not booking owner
   * @throws {BusinessRuleError} If cancellation not allowed (e.g., already completed)
   */
  async cancelBooking(bookingId, userId) {
    try {
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        throw new NotFoundError('Booking');
      }

      // User isolation: verify userId matches booking owner
      if (booking.customerId.toString() !== userId.toString()) {
        throw new ForbiddenError('You do not have permission to cancel this booking');
      }

      // Check if cancellation is allowed
      if (booking.status === BOOKING_STATES.COMPLETED) {
        throw new BusinessRuleError('Cannot cancel a completed booking');
      }

      if (booking.status === BOOKING_STATES.CANCELLED) {
        throw new BusinessRuleError('This booking is already cancelled');
      }

      // Calculate refund amount
      const refundAmount = this._calculateRefund(booking);

      // Release seats back to availability
      await BusService.releaseSeats(
        booking.busId,
        booking.seats,
        booking.departureDetails.date
      );

      // Update booking status and record refund
      booking.status = BOOKING_STATES.CANCELLED;
      booking.refundAmount = refundAmount;
      booking.cancelledAt = new Date();
      await booking.save();

      // Get customer for notification
      const customer = await Customer.findById(userId);

      // Send cancellation notification (don't block if fails)
      await NotificationService.sendCancellationNotification(booking.toObject(), customer.toObject());

      return {
        bookingId: booking._id,
        status: BOOKING_STATES.CANCELLED,
        refundAmount,
        message: `Booking cancelled successfully. Refund of ${refundAmount} will be processed.`,
      };
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof ForbiddenError ||
        error instanceof BusinessRuleError
      ) {
        throw error;
      }
      throw new BusinessRuleError(`Failed to cancel booking: ${error.message}`);
    }
  }

  /**
   * Update booking status (e.g., pending → confirmed → completed)
   * @param {string} bookingId - Booking ID
   * @param {string} newStatus - New status
   * @param {string} userId - Authenticated user ID (for authorization)
   * @returns {Promise<Object>} Updated booking
   * @throws {NotFoundError} If booking not found
   * @throws {ForbiddenError} If user not booking owner
   * @throws {ValidationError} If status transition invalid
   */
  async updateBookingStatus(bookingId, newStatus, userId) {
    try {
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        throw new NotFoundError('Booking');
      }

      // User isolation: verify userId matches booking owner
      if (booking.customerId.toString() !== userId.toString()) {
        throw new ForbiddenError('You do not have permission to update this booking');
      }

      // Validate status transition
      if (!VALID_TRANSITIONS[booking.status]?.includes(newStatus)) {
        throw new ValidationError(
          `Cannot transition from ${booking.status} to ${newStatus}`,
          {
            currentStatus: booking.status,
            requestedStatus: newStatus,
            validTransitions: VALID_TRANSITIONS[booking.status] || [],
          }
        );
      }

      // Update status
      booking.status = newStatus;
      booking.lastStatusUpdate = new Date();
      await booking.save();

      return booking.toObject();
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof ForbiddenError ||
        error instanceof ValidationError
      ) {
        throw error;
      }
      throw new BusinessRuleError(`Failed to update booking status: ${error.message}`);
    }
  }

  /**
   * Validate booking data before persistence
   * @param {Object} data - Booking data to validate
   * @returns {Promise<void>}
   * @throws {ValidationError} If data is invalid
   */
  async validateBookingData(data) {
    const errors = {};

    // Validate required fields
    if (!data.busId || typeof data.busId !== 'string') {
      errors.busId = 'Bus ID is required';
    }

    if (!data.seats || !Array.isArray(data.seats) || data.seats.length === 0) {
      errors.seats = 'At least one seat must be selected';
    }

    if (data.seats?.some((seat) => typeof seat !== 'number' || seat < 1)) {
      errors.seats = 'Invalid seat numbers';
    }

    if (!data.fare || typeof data.fare !== 'number' || data.fare <= 0) {
      errors.fare = 'Fare must be a positive number';
    }

    if (!data.phoneNumber || typeof data.phoneNumber !== 'string') {
      errors.phoneNumber = 'Phone number is required';
    }

    if (!data.departureDetails) {
      errors.departureDetails = 'Departure details are required';
    } else {
      if (!data.departureDetails.city) {
        errors.departureDetails = 'Departure city is required';
      }
      if (!data.departureDetails.date) {
        errors.departureDetails = 'Departure date is required';
      }
    }

    if (!data.arrivalDetails) {
      errors.arrivalDetails = 'Arrival details are required';
    } else {
      if (!data.arrivalDetails.city) {
        errors.arrivalDetails = 'Arrival city is required';
      }
    }

    if (!data.duration || typeof data.duration !== 'string') {
      errors.duration = 'Duration is required';
    }

    // Validate passenger details (accept passengerDetails as alias for backwards compatibility)
    const passengers = data.passengerDetails !== undefined ? data.passengerDetails : data.passengers;
    if (!passengers || !Array.isArray(passengers)) {
      errors.passengers = 'Passenger details are required';
    } else if (passengers.length === 0) {
      errors.passengers = 'At least one passenger is required';
    } else {
      const invalidPassenger = passengers.some(
        (p) => !p.name || !p.age || !p.gender
      );
      if (invalidPassenger) {
        errors.passengers = 'Each passenger must have name, age, and gender';
      }
    }

    // Validate payment method if provided
    if (data.paymentMethod) {
      const validMethods = ['cash_on_trip', 'online', 'card', 'upi'];
      if (!validMethods.includes(data.paymentMethod)) {
        errors.paymentMethod = `Invalid payment method. Must be one of: ${validMethods.join(', ')}`;
      }
    }

    // If there are errors, throw ValidationError with details
    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Booking validation failed', errors);
    }
  }

  /**
   * Calculate refund amount based on cancellation policy and time until departure
   * @private
   * @param {Object} booking - Booking object
   * @returns {number} Refund amount
   */
  _calculateRefund(booking) {
    // Default cancellation policy
    const policy = {
      full: 24, // Full refund if cancelled 24 hours before
      partial: 12, // Partial refund if cancelled 12-24 hours before
      refundPercentage: 0.5, // 50% refund for partial
    };

    const departureTime = new Date(
      `${booking.departureDetails.date}T${booking.departureDetails.time}`
    );
    const cancellationTime = new Date();
    const hoursUntilDeparture = (departureTime - cancellationTime) / (1000 * 60 * 60);

    if (hoursUntilDeparture >= policy.full) {
      // Full refund
      return booking.fare;
    } else if (hoursUntilDeparture >= policy.partial) {
      // Partial refund
      return booking.fare * policy.refundPercentage;
    } else {
      // No refund
      return 0;
    }
  }
}

module.exports = new BookingService();
