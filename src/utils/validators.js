/**
 * Validation Utilities for TedBus Service-Oriented Architecture
 * Provides input validation functions for common data types with structured error details
 * Ensures validation errors include field-specific details
 */

const { ValidationError } = require('./custom-errors');

/**
 * Validates email format according to RFC 5322 simplified rules
 * Returns void if valid, throws ValidationError if invalid
 *
 * @param {string} email - The email address to validate
 * @returns {void}
 * @throws {ValidationError} If email format is invalid
 *
 * @example
 * validateEmail('user@example.com'); // OK
 * validateEmail('invalid-email'); // Throws ValidationError
 */
function validateEmail(email) {
  const details = {};
  let isValid = true;

  // Check if email exists
  if (!email) {
    details.email = 'Email is required';
    isValid = false;
  } else {
    // Email format regex: simplified RFC 5322
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      details.email = 'Email format is invalid. Expected format: example@domain.com';
      isValid = false;
    }

    // Additional checks for email length (RFC 5321: 254 chars max)
    if (email.length > 254) {
      details.email = 'Email is too long (max 254 characters)';
      isValid = false;
    }

    // Check for valid domain
    const [localPart, domain] = email.split('@');
    if (localPart && localPart.length > 64) {
      details.email = 'Local part of email is too long (max 64 characters)';
      isValid = false;
    }
  }

  if (!isValid) {
    throw new ValidationError('Email validation failed', details);
  }
}

/**
 * Validates booking data object with field-specific error details
 * Validates: busId, routeId, seats, passengers, fare, paymentMethod
 * Returns void if valid, throws ValidationError if invalid
 *
 * @param {Object} bookingData - The booking data to validate
 * @param {string} bookingData.busId - Required, must be non-empty string
 * @param {string} bookingData.routeId - Required, must be non-empty string
 * @param {Array} bookingData.seats - Required, must be non-empty array of numbers
 * @param {Array} bookingData.passengers - Required, must be non-empty array of objects
 * @param {number} bookingData.fare - Required, must be positive number
 * @param {string} bookingData.paymentMethod - Required, must be 'online' or 'cash_on_trip'
 * @returns {void}
 * @throws {ValidationError} If booking data is invalid
 *
 * @example
 * validateBookingData({
 *   busId: 'BUS001',
 *   routeId: 'ROUTE_NYC_BOS',
 *   seats: [12, 13, 14],
 *   passengers: [{ name: 'John', age: 25 }],
 *   fare: 135.97,
 *   paymentMethod: 'cash_on_trip'
 * }); // OK
 */
function validateBookingData(bookingData) {
  const details = {};
  let isValid = true;

  // Validate bookingData is an object
  if (!bookingData || typeof bookingData !== 'object') {
    throw new ValidationError('Booking data must be an object', {
      bookingData: 'Invalid booking data format',
    });
  }

  // Validate busId
  if (!bookingData.busId || typeof bookingData.busId !== 'string' || bookingData.busId.trim() === '') {
    details.busId = 'Bus ID is required and must be a non-empty string';
    isValid = false;
  }

  // Validate routeId
  if (!bookingData.routeId || typeof bookingData.routeId !== 'string' || bookingData.routeId.trim() === '') {
    details.routeId = 'Route ID is required and must be a non-empty string';
    isValid = false;
  }

  // Validate seats (array of seat numbers)
  if (!Array.isArray(bookingData.seats) || bookingData.seats.length === 0) {
    details.seats = 'At least one seat must be selected';
    isValid = false;
  } else if (!bookingData.seats.every(seat => typeof seat === 'number' && Number.isInteger(seat) && seat > 0)) {
    details.seats = 'All seats must be positive integers';
    isValid = false;
  } else if (bookingData.seats.length > 1) {
    // Check for duplicate seats
    const uniqueSeats = new Set(bookingData.seats);
    if (uniqueSeats.size !== bookingData.seats.length) {
      details.seats = 'Duplicate seat numbers are not allowed';
      isValid = false;
    }
  }

  // Validate passengers (array of passenger objects)
  if (!Array.isArray(bookingData.passengers) || bookingData.passengers.length === 0) {
    details.passengers = 'At least one passenger is required';
    isValid = false;
  } else if (!bookingData.passengers.every(p => p && typeof p === 'object')) {
    details.passengers = 'All passengers must be objects';
    isValid = false;
  } else {
    // Validate each passenger has required fields
    const invalidPassengers = bookingData.passengers.filter(
      p => !p.name || typeof p.name !== 'string' || p.name.trim() === ''
    );
    if (invalidPassengers.length > 0) {
      details.passengers = 'Each passenger must have a valid name (non-empty string)';
      isValid = false;
    }
  }

  // Validate fare (must be positive number)
  if (typeof bookingData.fare !== 'number' || bookingData.fare <= 0) {
    details.fare = 'Fare must be a positive number';
    isValid = false;
  }

  // Validate paymentMethod
  if (!bookingData.paymentMethod || typeof bookingData.paymentMethod !== 'string') {
    details.paymentMethod = 'Payment method is required';
    isValid = false;
  } else {
    const validMethods = ['online', 'cash_on_trip'];
    if (!validMethods.includes(bookingData.paymentMethod.toLowerCase())) {
      details.paymentMethod = `Payment method must be one of: ${validMethods.join(', ')}`;
      isValid = false;
    }
  }

  // Validate that seats count matches passengers count
  if (bookingData.seats && Array.isArray(bookingData.seats) &&
      bookingData.passengers && Array.isArray(bookingData.passengers) &&
      bookingData.seats.length !== bookingData.passengers.length) {
    details.booking = 'Number of seats must match number of passengers';
    isValid = false;
  }

  if (!isValid) {
    throw new ValidationError('Booking data validation failed', details);
  }
}

/**
 * Validates user registration data
 * Validates: name, email, googleId (googleId can be optional)
 * Returns void if valid, throws ValidationError if invalid
 *
 * @param {Object} userData - The user data to validate
 * @param {string} userData.name - Required, must be non-empty string
 * @param {string} userData.email - Required, must be valid email format
 * @param {string} [userData.googleId] - Optional, but if provided must be non-empty string
 * @returns {void}
 * @throws {ValidationError} If user data is invalid
 *
 * @example
 * validateUserData({
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   googleId: '123456789'
 * }); // OK
 */
function validateUserData(userData) {
  const details = {};
  let isValid = true;

  // Validate userData is an object
  if (!userData || typeof userData !== 'object') {
    throw new ValidationError('User data must be an object', {
      userData: 'Invalid user data format',
    });
  }

  // Validate name
  if (!userData.name || typeof userData.name !== 'string' || userData.name.trim() === '') {
    details.name = 'Name is required and must be a non-empty string';
    isValid = false;
  } else if (userData.name.length > 100) {
    details.name = 'Name must be 100 characters or less';
    isValid = false;
  }

  // Validate email exists and format
  if (!userData.email || typeof userData.email !== 'string' || userData.email.trim() === '') {
    details.email = 'Email is required and must be a non-empty string';
    isValid = false;
  } else {
    // Use email validator function for consistent validation
    try {
      validateEmail(userData.email);
    } catch (error) {
      details.email = error.details.email;
      isValid = false;
    }
  }

  // Validate googleId if provided (optional)
  if (userData.googleId !== undefined && userData.googleId !== null) {
    if (typeof userData.googleId !== 'string' || userData.googleId.trim() === '') {
      details.googleId = 'Google ID must be a non-empty string if provided';
      isValid = false;
    }
  }

  if (!isValid) {
    throw new ValidationError('User data validation failed', details);
  }
}

/**
 * Validates seat numbers are within valid range
 * Returns void if valid, throws ValidationError if invalid
 *
 * @param {Array} seatNumbers - Array of seat numbers to validate
 * @param {number} totalSeats - Total number of seats available on the bus
 * @returns {void}
 * @throws {ValidationError} If seat numbers are invalid
 *
 * @example
 * validateSeatNumbers([12, 13, 14], 50); // OK
 * validateSeatNumbers([0, 12], 50); // Throws ValidationError
 * validateSeatNumbers([12, 51], 50); // Throws ValidationError
 */
function validateSeatNumbers(seatNumbers, totalSeats) {
  const details = {};
  let isValid = true;

  // Validate seatNumbers is an array
  if (!Array.isArray(seatNumbers)) {
    throw new ValidationError('Seat numbers must be an array', {
      seatNumbers: 'Seat numbers must be provided as an array',
    });
  }

  // Validate totalSeats is a positive integer
  if (typeof totalSeats !== 'number' || !Number.isInteger(totalSeats) || totalSeats <= 0) {
    throw new ValidationError('Total seats must be a positive integer', {
      totalSeats: 'Total seats must be a positive integer',
    });
  }

  // Validate seatNumbers is not empty
  if (seatNumbers.length === 0) {
    details.seatNumbers = 'At least one seat must be selected';
    isValid = false;
  } else {
    // Validate each seat number
    const invalidSeats = [];
    const outOfRangeSeats = [];
    const duplicateSeats = [];

    const seatSet = new Set();
    seatNumbers.forEach(seat => {
      // Check if seat is a valid positive integer
      if (typeof seat !== 'number' || !Number.isInteger(seat) || seat <= 0) {
        invalidSeats.push(seat);
      }
      // Check if seat is within range
      else if (seat > totalSeats) {
        outOfRangeSeats.push(seat);
      }
      // Check for duplicates
      else if (seatSet.has(seat)) {
        duplicateSeats.push(seat);
      }
      seatSet.add(seat);
    });

    if (invalidSeats.length > 0) {
      details.seatNumbers = `Invalid seat numbers: ${invalidSeats.join(', ')}. Seats must be positive integers.`;
      isValid = false;
    }

    if (outOfRangeSeats.length > 0) {
      details.seatNumbers = `Seat numbers out of range: ${outOfRangeSeats.join(', ')}. Valid range is 1-${totalSeats}.`;
      isValid = false;
    }

    if (duplicateSeats.length > 0) {
      details.seatNumbers = `Duplicate seat numbers: ${duplicateSeats.join(', ')}`;
      isValid = false;
    }
  }

  if (!isValid) {
    throw new ValidationError('Seat number validation failed', details);
  }
}

// Export all validation functions
module.exports = {
  validateEmail,
  validateBookingData,
  validateUserData,
  validateSeatNumbers,
};
