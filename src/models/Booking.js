/**
 * Booking Model - MongoDB schema for bus ticket bookings
 * Stores booking information, passenger details, and payment status
 */

const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
  {
    // User information
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Bus and route information
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      required: true,
      index: true,
    },

    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: true,
    },

    // Seat information
    seats: {
      type: [Number],
      required: true,
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0 && v.every(s => Number.isInteger(s) && s > 0);
        },
        message: 'Seats must be an array of positive integers',
      },
    },

    // Passenger details
    passengerDetails: [
      {
        name: { type: String, required: true },
        gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
        age: { type: Number, required: true, min: 1 },
        email: { type: String, required: false },
        phone: { type: String, required: false },
      },
    ],

    // Contact information
    email: {
      type: String,
      required: true,
      lowercase: true,
    },

    phoneNumber: {
      type: String,
      required: true,
    },

    // Booking pricing
    fare: {
      type: Number,
      required: true,
      min: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Journey details
    departureDetails: {
      city: String,
      location: String,
      time: String, // Format: HH:MM
      date: {
        type: String, // Format: YYYY-MM-DD
        index: true,
      },
    },

    arrivalDetails: {
      city: String,
      location: String,
      time: String,
      date: String,
    },

    duration: {
      type: String,
      required: false,
    },

    // Booking status
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },

    // Payment information
    paymentMethod: {
      type: String,
      enum: ['cash_on_trip', 'online', 'wallet', 'upi'],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ['pending', 'received', 'refunded', 'failed'],
      default: 'pending',
      index: true,
    },

    transactionId: {
      type: String,
      default: null,
    },

    // Refund information
    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refundReason: {
      type: String,
      default: null,
    },

    refundDate: {
      type: Date,
      default: null,
    },

    // Business travel details (optional)
    isBusinessTravel: {
      type: Boolean,
      default: false,
    },

    businessDetails: {
      gst: { type: String, default: null },
      name: { type: String, default: null },
      address: { type: String, default: null },
      email: { type: String, default: null },
    },

    // Insurance (optional)
    isInsurance: {
      type: Boolean,
      default: false,
    },

    insuranceAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // COVID relief donation (optional)
    isCovidDonated: {
      type: Boolean,
      default: false,
    },

    covidDonationAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Cancellation information
    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      default: null,
    },

    // Special notes
    notes: {
      type: String,
      default: null,
    },

    // Booking reference for customer
    bookingReference: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'bookings',
  }
);

// Indexes for common queries
BookingSchema.index({ customerId: 1, 'departureDetails.date': 1 });
BookingSchema.index({ busId: 1, 'departureDetails.date': 1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('Booking', BookingSchema);
