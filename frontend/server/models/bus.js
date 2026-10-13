const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const busSchema = new Schema(
  {
    operatorName: {
      type: String,
      required: true,
    },
    busType: {
      type: String,
      required: true,
      enum: ["AC", "non-AC", "Sleeper", "Premium"],
    },
    totalSeats: {
      type: Number,
      required: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
    },
    routes: {
      type: Schema.Types.ObjectId,
      ref: "Route",
      required: true,
    },
    amenities: {
      type: [String],
      required: false,
    },
    departureTime: {
      type: String,
      required: false,
    },
    arrivalTime: {
      type: String,
      required: false,
    },
    fare: {
      type: Number,
      required: false,
    },
    rating: {
      type: [Number],
      default: [],
    },
    liveTracking: {
      type: Number,
      default: 0,
    },
    reschedulable: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bus", busSchema);
