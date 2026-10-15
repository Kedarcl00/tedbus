const mongoose = require('mongoose');
const { Schema } = mongoose;

const locationSchema = new Schema({
  lat:     { type: Number },
  lng:     { type: Number },
  address: { type: String, required: true }
}, { _id: false });

const alternativeSchema = new Schema({
  label:         { type: String },       // e.g. 'Fastest', 'Shortest', 'No Toll'
  distance:      { type: String },
  duration:      { type: String },
  trafficDelay:  { type: String, default: '0 min' },
  congestionLevel: { type: String, enum: ['low', 'moderate', 'high'], default: 'low' },
  polyline:      [{ lat: Number, lng: Number }],
}, { _id: false });

const savedRouteSchema = new Schema({
  userId:      { type: String, required: true, index: true },
  name:        { type: String, required: true },
  origin:      { type: locationSchema, required: true },
  destination: { type: locationSchema, required: true },
  waypoints:   [locationSchema],
  distance:    { type: String },
  duration:    { type: String },
  trafficDelay:   { type: String, default: '0 min' },
  congestionLevel: { type: String, enum: ['low', 'moderate', 'high'], default: 'low' },
  alternatives:   [alternativeSchema],
  useCount:    { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('SavedRoute', savedRouteSchema);

