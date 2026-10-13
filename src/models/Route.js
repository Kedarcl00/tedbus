/**
 * Route Model - MongoDB schema for bus routes
 * Stores route information including source, destination, and route details
 */

const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema(
  {
    // Route identification
    routeName: {
      type: String,
      required: true,
      index: true,
    },

    // Source information
    source: {
      city: {
        type: String,
        required: true,
        index: true,
      },
      location: String,
      latitude: Number,
      longitude: Number,
    },

    // Destination information
    destination: {
      city: {
        type: String,
        required: true,
        index: true,
      },
      location: String,
      latitude: Number,
      longitude: Number,
    },

    // Route details
    distance: {
      type: Number, // In kilometers
      required: true,
      min: 0,
    },

    estimatedDuration: {
      type: String, // Format: "10h 30m"
      required: true,
    },

    stops: {
      type: [String], // Array of stop cities
      default: [],
    },

    // Route classification
    routeType: {
      type: String,
      enum: ['express', 'semi-express', 'local'],
      default: 'express',
    },

    // Route status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    popularity: {
      type: Number,
      default: 0, // Popularity score for trending routes
    },

    // Fare information
    baseFare: {
      type: Number,
      required: true,
      min: 0,
    },

    fareVariations: {
      peakHours: Number, // Additional charge during peak hours
      offPeaks: Number, // Discount during off-peak hours
    },

    // Route metadata
    description: String,
    notes: String,
  },
  {
    timestamps: true,
    collection: 'routes',
  }
);

// Indexes for common queries
RouteSchema.index({ 'source.city': 1, 'destination.city': 1 });
RouteSchema.index({ isActive: 1 });
RouteSchema.index({ popularity: -1 });

module.exports = mongoose.model('Route', RouteSchema);
