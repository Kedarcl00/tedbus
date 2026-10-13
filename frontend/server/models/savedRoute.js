const mongoose = require('mongoose');
const { Schema } = mongoose;

const locationSchema = new Schema({
  lat: { type: Number },
  lng: { type: Number },
  address: { type: String, required: true }
}, { _id: false });

const savedRouteSchema = new Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  origin: { type: locationSchema, required: true },
  destination: { type: locationSchema, required: true },
  waypoints: [locationSchema],
  distance: { type: String },
  duration: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SavedRoute', savedRouteSchema);
