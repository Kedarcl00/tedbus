const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const locationSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  address: {
    type: String,
  },
  city: {
    type: String,
  },
  state: {
    type: String,
  },
}, { _id: false });

const routeSchema = new Schema(
  {
    departureLocation: {
      type: locationSchema,
      required: true,
    },
    arrivalLocation: {
      type: locationSchema,
      required: true,
    },
    distance: {
      type: Number,
      required: true,
    },
    duration: {
      type: String,
      required: true,
    },
    fare: {
      type: Number,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Route", routeSchema);
