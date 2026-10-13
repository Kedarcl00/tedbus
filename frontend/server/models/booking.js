const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    busId: {
      type: Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    routeId: {
      type: Schema.Types.ObjectId,
      ref: "Route",
      required: true,
    },
    seats: {
      type: [Number],
      required: true,
    },
    passengers: {
      type: [
        {
          name: {
            type: String,
            required: true,
          },
          age: {
            type: Number,
            required: true,
          },
          gender: {
            type: String,
            required: true,
          },
        },
      ],
      required: true,
    },
    fare: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "in_progress", "completed", "cancelled"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["online", "cash_on_trip"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "received", "failed"],
      default: "pending",
    },
    departureDate: {
      type: Date,
      required: true,
    },
    bookingReference: {
      type: String,
      unique: true,
    },
    totalDistance: {
      type: Number,
    },
    departureTime: {
      type: String,
    },
    arrivalTime: {
      type: String,
    },
    // New fields for journey details (Phase 2)
    departureLocation: {
      name: String,
      city: String,
      address: String,
    },
    arrivalLocation: {
      name: String,
      city: String,
      address: String,
    },
    journeyDate: {
      type: String,
      description: "Date of journey in YYYY-MM-DD format"
    },
    duration: {
      type: String,
      description: "Journey duration in human-readable format (e.g., 10h 30m)"
    },
    baseFarePerSeat: {
      type: Number,
      description: "Unit price per seat for fare recalculation"
    },
    totalSeatsBooked: {
      type: Number,
      description: "Count of seats booked"
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index on (customerId, createdAt) for efficient user booking retrieval
bookingSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model("Booking", bookingSchema);
