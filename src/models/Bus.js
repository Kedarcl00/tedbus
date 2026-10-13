/**
 * Bus Model - MongoDB schema for bus inventory
 * Stores bus information, seating capacity, and operational details
 */

const mongoose = require('mongoose');

const BusSchema = new mongoose.Schema(
  {
    // Bus identification
    operatorName: {
      type: String,
      required: true,
      index: true,
    },
    busType: {
      type: String,
      enum: ['AC', 'Non-AC', 'Sleeper', 'Seater'],
      required: true,
    },

    // Route information
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: true,
      index: true,
    },

    // Departure and arrival details
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

    // Seat information
    totalSeats: {
      type: Number,
      required: true,
      default: 50,
      min: 1,
      max: 100,
    },

    // Bus pricing and amenities
    baseFare: {
      type: Number,
      required: true,
      min: 0,
    },

    amenities: {
      wifi: { type: Boolean, default: false },
      charging: { type: Boolean, default: false },
      blanket: { type: Boolean, default: false },
      pillow: { type: Boolean, default: false },
      meal: { type: Boolean, default: false },
      toilet: { type: Boolean, default: false },
    },

    // Bus features
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 3.5,
    },

    image: {
      type: String,
      default: null,
    },

    // Operational flags
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    liveTracking: {
      type: Boolean,
      default: false,
    },

    isReschedulable: {
      type: Boolean,
      default: true,
    },

    // Duration of journey
    duration: {
      type: String, // Format: "10h 30m"
      required: false,
    },

    // Cancellation policy
    cancellationPolicy: {
      full: { type: Number, default: 0 }, // Hours before departure for full refund
      partial: { type: Number, default: 24 }, // Hours before departure for partial refund
      refundPercentage: { type: Number, default: 50 }, // Refund percentage after partial period
    },
  },
  {
    timestamps: true,
    collection: 'buses',
  }
);

// Index for common queries
BusSchema.index({ routeId: 1, 'departureDetails.date': 1 });
BusSchema.index({ operatorName: 1 });
BusSchema.index({ isActive: 1 });

module.exports = mongoose.model('Bus', BusSchema);
