/**
 * BusRepository - Data access layer for Bus operations
 * Handles all MongoDB operations related to buses and seat availability
 */

const Buses = require('../models/Bus');

class BusRepository {
  /**
   * Find buses by search filters
   * Searches for buses matching route and departure date criteria
   *
   * @async
   * @param {Object} filters - Search filters
   * @param {string} [filters.sourceCity] - Departure city
   * @param {string} [filters.destinationCity] - Destination city
   * @param {string} [filters.departureDate] - Departure date (YYYY-MM-DD format)
   * @param {string} [filters.busType] - Bus type (AC, Non-AC, etc.)
   * @returns {Promise<Array>} Array of bus documents matching filters
   *
   * @example
   * const buses = await busRepository.find({
   *   sourceCity: 'New York',
   *   destinationCity: 'Boston',
   *   departureDate: '2024-06-15'
   * });
   */
  async find(filters = {}) {
    try {
      const query = {};

      if (filters.sourceCity) {
        query['departureDetails.city'] = new RegExp(filters.sourceCity, 'i');
      }

      if (filters.destinationCity) {
        query['arrivalDetails.city'] = new RegExp(filters.destinationCity, 'i');
      }

      if (filters.departureDate) {
        query['departureDate'] = filters.departureDate;
      }

      if (filters.busType) {
        query['busType'] = filters.busType;
      }

      return await Buses.find(query).populate('routeId').lean();
    } catch (error) {
      throw new Error(`Failed to search buses: ${error.message}`);
    }
  }

  /**
   * Find a bus by ID
   * Retrieves complete bus details including seat information
   *
   * @async
   * @param {string} busId - MongoDB bus ID
   * @returns {Promise<Object|null>} Bus document or null if not found
   *
   * @example
   * const bus = await busRepository.findById('507f1f77bcf86cd799439011');
   */
  async findById(busId) {
    try {
      return await Buses.findById(busId).populate('routeId');
    } catch (error) {
      throw new Error(`Failed to find bus: ${error.message}`);
    }
  }

  /**
   * Get seat availability for a specific bus and date
   * Calculates available seats as: totalSeats - bookedSeats
   *
   * @async
   * @param {string} busId - MongoDB bus ID
   * @param {string} departureDate - Departure date (YYYY-MM-DD format)
   * @returns {Promise<Object>} Availability object { availableSeats, bookedSeats, totalSeats }
   *
   * @example
   * const availability = await busRepository.getAvailability('507f1f77bcf86cd799439011', '2024-06-15');
   * // Returns: { availableSeats: 8, bookedSeats: 42, totalSeats: 50 }
   */
  async getAvailability(busId, departureDate) {
    try {
      const bus = await Buses.findById(busId).lean();
      if (!bus) {
        return null;
      }

      // Find bookings for this bus on this date
      const Bookings = require('../models/Booking');
      const bookedSeats = await Bookings.aggregate([
        {
          $match: {
            busId: busId,
            'departureDetails.date': departureDate,
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: null,
            totalBooked: { $sum: { $size: '$seats' } },
          },
        },
      ]);

      const totalBooked = bookedSeats[0]?.totalBooked || 0;
      const totalSeats = bus.totalSeats || 50; // Default to 50 if not specified

      return {
        busId,
        departureDate,
        totalSeats,
        bookedSeats: totalBooked,
        availableSeats: Math.max(0, totalSeats - totalBooked),
      };
    } catch (error) {
      throw new Error(`Failed to get availability: ${error.message}`);
    }
  }

  /**
   * Check if specific seats are available for a bus on a given date
   * Validates that requested seats are not already booked
   *
   * @async
   * @param {string} busId - MongoDB bus ID
   * @param {Array<number>} seatNumbers - Array of seat numbers to check
   * @param {string} departureDate - Departure date (YYYY-MM-DD format)
   * @returns {Promise<Object>} { available: boolean, bookedSeats: Array }
   *
   * @example
   * const check = await busRepository.checkSeatsAvailable('507f...', [12, 13, 14], '2024-06-15');
   */
  async checkSeatsAvailable(busId, seatNumbers, departureDate) {
    try {
      const Bookings = require('../models/Booking');

      // Find bookings with any of these seats on this date
      const existingBookings = await Bookings.find(
        {
          busId,
          'departureDetails.date': departureDate,
          seats: { $in: seatNumbers },
          status: { $ne: 'cancelled' },
        },
        { seats: 1 }
      ).lean();

      const bookedSeats = existingBookings.flatMap(b => b.seats);
      const conflictingSeats = seatNumbers.filter(s => bookedSeats.includes(s));

      return {
        available: conflictingSeats.length === 0,
        conflictingSeats,
      };
    } catch (error) {
      throw new Error(`Failed to check seat availability: ${error.message}`);
    }
  }

  /**
   * Reserve seats for a booking (atomic operation)
   * Records the seat reservation with booking reference
   * This is part of the booking transaction and should be called within a session
   *
   * @async
   * @param {string} busId - MongoDB bus ID
   * @param {Array<number>} seatNumbers - Seats to reserve
   * @param {string} departureDate - Departure date
   * @param {Object} reservationData - Additional reservation data
   * @returns {Promise<Object>} Reservation token/receipt
   *
   * @example
   * const token = await busRepository.reserveSeats('507f...', [12, 13], '2024-06-15', { bookingId: '...' });
   */
  async reserveSeats(busId, seatNumbers, departureDate, reservationData = {}) {
    try {
      // This is typically called as part of booking creation
      // The actual seat reservation is done by creating a booking record
      // This method validates reservation before booking creation
      const available = await this.checkSeatsAvailable(busId, seatNumbers, departureDate);

      if (!available.available) {
        throw new Error(`Seats ${available.conflictingSeats.join(', ')} are already booked`);
      }

      // Return a reservation token that will be validated during booking creation
      return {
        busId,
        seatNumbers,
        departureDate,
        reservedAt: new Date().toISOString(),
        token: `RES-${busId}-${Date.now()}`,
      };
    } catch (error) {
      throw new Error(`Failed to reserve seats: ${error.message}`);
    }
  }

  /**
   * Release reserved seats on booking cancellation
   * This is called when a booking is cancelled to free up the seats
   *
   * @async
   * @param {string} busId - MongoDB bus ID
   * @param {Array<number>} seatNumbers - Seats to release
   * @param {string} departureDate - Departure date
   * @returns {Promise<Object>} Release confirmation
   *
   * @example
   * const result = await busRepository.releaseSeats('507f...', [12, 13], '2024-06-15');
   */
  async releaseSeats(busId, seatNumbers, departureDate) {
    try {
      // Seats are released by cancelling/updating the booking
      // This method is for validation/logging purposes
      return {
        busId,
        seatNumbers,
        departureDate,
        releasedAt: new Date().toISOString(),
        message: `Released seats ${seatNumbers.join(', ')} for bus ${busId} on ${departureDate}`,
      };
    } catch (error) {
      throw new Error(`Failed to release seats: ${error.message}`);
    }
  }

  /**
   * Get list of popular routes (for caching)
   * Retrieves routes with the most bookings
   *
   * @async
   * @returns {Promise<Array>} Array of popular route objects
   *
   * @example
   * const popular = await busRepository.getPopularRoutes();
   */
  async getPopularRoutes() {
    try {
      const Routes = require('../models/Route');
      return await Routes.find().sort({ popularity: -1 }).limit(10).lean();
    } catch (error) {
      throw new Error(`Failed to get popular routes: ${error.message}`);
    }
  }

  /**
   * Update bus availability cache (if using cache)
   * Called when booking is created/cancelled to update availability
   *
   * @async
   * @param {string} busId - MongoDB bus ID
   * @param {string} departureDate - Departure date
   * @returns {Promise<Object>} Updated availability info
   *
   * @example
   * const updated = await busRepository.updateAvailabilityCache('507f...', '2024-06-15');
   */
  async updateAvailabilityCache(busId, departureDate) {
    try {
      return await this.getAvailability(busId, departureDate);
    } catch (error) {
      throw new Error(`Failed to update availability cache: ${error.message}`);
    }
  }
}

module.exports = BusRepository;
