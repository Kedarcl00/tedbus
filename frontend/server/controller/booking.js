const Booking = require('../models/booking');
const LoggerService = require('../services/logger.service');
const logger = new LoggerService();

/**
 * Helper function to calculate base fare per seat based on bus type and duration
 * Matches the formula used in frontend bus-box component for consistency
 */
function calculateBaseFarePerSeat(busType, durationHours) {
  let ratePerHour = 75; // Default Non-A/C rate

  if (busType === 'standard') {
    ratePerHour = 50;
  } else if (busType === 'sleeper') {
    ratePerHour = 100;
  } else if (busType === 'A/C Seater' || busType === 'AC Seater') {
    ratePerHour = 125;
  }

  const baseFare = (ratePerHour * durationHours) / 2;
  return Math.ceil(baseFare); // Round up to nearest rupee
}

exports.addbooking = async (req, res) => {
  try {
    const booking = await Booking.create(req.body);
    res.status(201).json(booking);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const bookings = await Booking.find().lean().exec();
    const filteredBookings = bookings.filter(
      booking => booking.customerId.toString() === id
    );
    res.json(filteredBookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get current user's bookings
 * GET /api/bookings/my
 * User ID from X-User-Id header
 */
exports.getMyBookings = async (req, res) => {
  try {
    const googleId = req.headers['x-user-id'];

    if (!googleId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401
        }
      });
    }

    logger.info('Fetching user bookings', { googleId });

    // First find the user by googleId to get their ObjectId
    const User = require('../models/User');
    const user = await User.findOne({ googleId }).select('_id').lean().exec();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          statusCode: 404
        }
      });
    }

    // Find bookings by user's ObjectId (customerId)
    const bookings = await Booking.find({ customerId: user._id })
      .populate('busId')
      .populate('routeId')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    res.status(200).json(bookings);

  } catch (error) {
    logger.error('Error fetching user bookings', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to retrieve bookings',
        statusCode: 500
      }
    });
  }
};

/**
 * Create new booking
 * POST /api/bookings
 * User ID from X-User-Id header
 */
exports.createBooking = async (req, res) => {
  try {
    const googleId = req.headers['x-user-id'];

    if (!googleId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401
        }
      });
    }

    // Find user by googleId to get their ObjectId
    const User = require('../models/User');
    const user = await User.findOne({ googleId }).select('_id name email').lean().exec();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          statusCode: 404
        }
      });
    }

    // Normalize the booking data: rename 'passengers' field if needed for validation
    const normalizedData = {
      ...req.body,
      passengers: req.body.passengers || req.body.passengerDetails || [], // Support both field names
    };

    // Generate unique booking reference
    const bookingReference = `TB${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    // Fetch bus and route details for receipt
    const Bus = require('../models/bus');
    const Route = require('../models/route');
    
    const bus = await Bus.findById(req.body.busId).lean().exec();
    const route = await Route.findById(req.body.routeId).lean().exec();

    // Extract departure and arrival locations from route
    const departureLocation = route ? {
      name: route.departureLocation?.name || '',
      city: route.departureLocation?.city || '',
      address: route.departureLocation?.address || ''
    } : { name: '', city: '', address: '' };

    const arrivalLocation = route ? {
      name: route.arrivalLocation?.name || '',
      city: route.arrivalLocation?.city || '',
      address: route.arrivalLocation?.address || ''
    } : { name: '', city: '', address: '' };

    // Extract or calculate arrival time
    let arrivalTime = bus?.arrivalTime || '';
    if (!arrivalTime && bus?.departureTime && route?.duration) {
      // Calculate arrival time if not provided
      const depTime = bus.departureTime;
      const [depHour, depMin] = depTime.split(':').map(Number);
      const durationHours = parseInt(route.duration, 10) || 0;
      const arrivalTotalMin = (depHour * 60 + depMin) + (durationHours * 60);
      const arrivalHour = Math.floor(arrivalTotalMin / 60) % 24;
      const arrivalMin = arrivalTotalMin % 60;
      arrivalTime = `${String(arrivalHour).padStart(2, '0')}:${String(arrivalMin).padStart(2, '0')}`;
    }

    // Calculate duration string
    const durationStr = route?.duration ? `${route.duration}h` : 'N/A';

    // Calculate base fare per seat
    const baseFarePerSeat = req.body.baseFarePerSeat || 
      calculateBaseFarePerSeat(bus?.busType || '', parseInt(route?.duration, 10) || 1);

    // Calculate total seats booked
    const totalSeatsBooked = req.body.seats?.length || 0;

    // Add customerId (User ObjectId) to booking data
    const bookingData = {
      customerId: user._id,
      busId: req.body.busId,
      routeId: req.body.routeId,
      seats: req.body.seats,
      passengers: normalizedData.passengers, // Use normalized passengers field to match schema
      fare: req.body.fare,
      paymentMethod: req.body.paymentMethod || 'online',
      departureDate: req.body.departureDate || new Date(),
      bookingReference: bookingReference,
      totalDistance: route ? route.distance : 0,
      departureTime: bus ? bus.departureTime : '',
      arrivalTime: arrivalTime,
      // New journey detail fields
      departureLocation,
      arrivalLocation,
      journeyDate: req.body.departureDate || new Date().toISOString().split('T')[0],
      duration: durationStr,
      baseFarePerSeat,
      totalSeatsBooked,
      createdAt: new Date()
    };

    const LoggerService = require('../services/logger.service');
    const logger = new LoggerService();
    logger.info('Creating booking', { googleId, userId: user._id, bookingReference });

    // Validate booking data before saving
    if (!bookingData.passengers || !Array.isArray(bookingData.passengers) || bookingData.passengers.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Passengers array is required and must not be empty',
          statusCode: 400
        }
      });
    }

    if (!bookingData.seats || !Array.isArray(bookingData.seats) || bookingData.seats.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Seats must be provided',
          statusCode: 400
        }
      });
    }

    if (!bookingData.fare || bookingData.fare <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Fare must be a positive number',
          statusCode: 400
        }
      });
    }

    const booking = await Booking.create(bookingData);
    
    // Populate booking with full details for receipt
    const populatedBooking = await Booking.findById(booking._id)
      .populate('busId')
      .populate('routeId')
      .populate('customerId', 'name email')
      .lean()
      .exec();
    
    res.status(201).json({
      success: true,
      booking: populatedBooking,
      bookingReference: bookingReference
    });

  } catch (error) {
    const LoggerService = require('../services/logger.service');
    const logger = new LoggerService();
    logger.error('Error creating booking', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create booking',
        statusCode: 500,
        details: error.message
      }
    });
  }
};

/**
 * Get booking by ID
 * GET /api/bookings/:id
 * Enforces user ownership
 */
exports.getBookingById = async (req, res) => {
  try {
    const googleId = req.headers['x-user-id'];
    const { id } = req.params;

    if (!googleId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401
        }
      });
    }

    // Find user by googleId
    const User = require('../models/User');
    const user = await User.findOne({ googleId }).select('_id').lean().exec();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          statusCode: 404
        }
      });
    }

    const booking = await Booking.findById(id)
      .populate('busId')
      .populate('routeId')
      .lean()
      .exec();

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: 'Booking not found',
          statusCode: 404
        }
      });
    }

    // Check ownership - compare ObjectIds
    if (booking.customerId.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this booking',
          statusCode: 403
        }
      });
    }

    res.status(200).json(booking);

  } catch (error) {
    logger.error('Error fetching booking', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to retrieve booking',
        statusCode: 500
      }
    });
  }
};
