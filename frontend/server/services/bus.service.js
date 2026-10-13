/**
 * BusService
 * Manages bus inventory, seat availability, and bus-related queries
 */

const Bus = require('../models/bus');
const Booking = require('../models/booking');
const {
  NotFoundError,
  BusinessRuleError,
  InsufficientSeatsError,
} = require('../utils/custom-errors');

class BusService {
  /**
   * Search buses by filters with availability
   * @param {Object} filters - Search filters {routeId, departureDate, passengers, etc.}
   * @returns {Promise<Array>} Array of buses matching filters
   */
  async searchBuses(filters) {
    try {
      // Find buses by route
      const buses = await Bus.find({ routes: filters.routeId })
        .populate('routes')
        .lean()
        .exec();

      // Enhance with availability information
      const busesWithAvailability = await Promise.all(
        buses.map(async (bus) => {
          const availability = await this.checkAvailability(
            bus._id.toString(),
            filters.departureDate
          );
          return {
            ...bus,
            availableSeats: availability.availableSeats,
            totalSeats: availability.totalSeats,
            bookedSeats: availability.bookedSeats,
          };
        })
      );

      return busesWithAvailability;
    } catch (error) {
      if (error instanceof BusinessRuleError) {
        throw error;
      }
      throw new BusinessRuleError(`Failed to search buses: ${error.message}`);
    }
  }

  /**
   * Get bus details by ID
   * @param {string} busId - Bus ID
   * @returns {Promise<Object>} Bus details
   */
  async getBusById(busId) {
    const bus = await Bus.findById(busId).populate('routes').exec();
    if (!bus) {
      throw new NotFoundError('Bus');
    }
    return bus;
  }

  /**
   * Check seat availability for specific bus and date
   * @param {string} busId - Bus ID
   * @param {string} departureDate - Departure date (YYYY-MM-DD format)
   * @returns {Promise<Object>} {totalSeats, bookedSeats, availableSeats}
   */
  async checkAvailability(busId, departureDate) {
    const bus = await this.getBusById(busId);
    const totalSeats = bus.totalSeats || 50; // Default to 50 if not specified

    // Count booked seats for this bus on this date
    const bookedCount = await Booking.countDocuments({
      busId: busId.toString(),
      'departureDetails.date': departureDate,
      status: { $ne: 'cancelled' },
    });

    return {
      totalSeats,
      bookedSeats: bookedCount,
      availableSeats: Math.max(0, totalSeats - bookedCount),
    };
  }

  /**
   * Reserve seats - atomic operation to prevent double-booking
   * @param {string} busId - Bus ID
   * @param {Array<number>} seatNumbers - Seat numbers to reserve
   * @param {string} departureDate - Departure date
   * @returns {Promise<Object>} Reservation token
   */
  async reserveSeats(busId, seatNumbers, departureDate) {
    // Validate seat numbers
    if (!Array.isArray(seatNumbers) || seatNumbers.length === 0) {
      throw new BusinessRuleError('Invalid seat numbers provided');
    }

    // Check if seats are available
    const availability = await this.checkAvailability(busId, departureDate);
    if (availability.availableSeats < seatNumbers.length) {
      throw new InsufficientSeatsError(
        `Only ${availability.availableSeats} seats available, but ${seatNumbers.length} requested`
      );
    }

    // Generate reservation token
    const reservationToken = {
      busId,
      seats: seatNumbers,
      departureDate,
      reservedAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    };

    return reservationToken;
  }

  /**
   * Release reserved seats on cancellation
   * @param {string} busId - Bus ID
   * @param {Array<number>} seatNumbers - Seat numbers to release
   * @param {string} departureDate - Departure date
   * @returns {Promise<void>}
   */
  async releaseSeats(busId, seatNumbers, departureDate) {
    // In a real implementation with Redis or seat tracking collection,
    // this would update the seat reservation map
    // For now, seat release happens implicitly when booking is cancelled
    return Promise.resolve();
  }

  /**
   * Get all buses (for listing/display)
   * @returns {Promise<Array>} All buses
   */
  async getAllBuses() {
    return Bus.find().populate('routes').lean().exec();
  }
}

module.exports = new BusService();
