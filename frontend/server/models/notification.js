const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema({
  userId:        { type: String, required: true, index: true },
  channel:       { type: String, enum: ['email', 'push', 'in-app'], default: 'in-app', required: true },
  type:          { type: String, required: true },   // e.g. 'BOOKING_CONFIRMED', 'SCHEDULE_CHANGE', 'JOURNEY_REMINDER', 'PROMOTIONAL_OFFER'
  title:         { type: String, required: true },
  body:          { type: String, required: true },
  status:        { type: String, enum: ['pending', 'sent', 'delivered', 'failed'], default: 'pending', index: true },
  language:      { type: String, default: 'en', enum: ['en', 'hi', 'mr'] },
  failureReason: { type: String },
  read:          { type: Boolean, default: false },
  delivered:     { type: Boolean, default: false },
  retryCount:    { type: Number, default: 0 },
  maxRetries:    { type: Number, default: 3 },
  metadata:      { type: Schema.Types.Mixed, default: {} },
  createdAt:     { type: Date, default: Date.now },
  deliveredAt:   { type: Date },
});

module.exports = mongoose.model('Notification', notificationSchema);

