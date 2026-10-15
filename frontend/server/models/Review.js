/**
 * Review Model - MongoDB schema for bus reviews
 * Stores verified post-journey ratings and reviews
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReviewSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    bookingId: {
      type: String,
      required: true,
      unique: true, // one review per booking
      index: true,
    },
    busId: {
      type: String,
      required: false,
      index: true,
    },
    routeId: {
      type: String,
      required: false,
      index: true,
    },
    userName: {
      type: String,
      default: '',
    },
    userPicture: {
      type: String,
      default: '',
    },
    isVerifiedUser: {
      type: Boolean,
      default: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    reviewText: {
      type: String,
      minlength: 20,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    helpful: {
      type: [String], // array of userIds who marked helpful
      default: [],
    },
    reported: {
      type: [String], // array of userIds who reported
      default: [],
    },
    hidden: {
      type: Boolean,
      default: false,
    },
    moderatedBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: false, // using custom createdAt
    collection: 'reviews',
  }
);

// Indexes for common queries
ReviewSchema.index({ busId: 1, hidden: 1 });
ReviewSchema.index({ routeId: 1, hidden: 1 });
ReviewSchema.index({ userId: 1 });

module.exports = mongoose.model('Review', ReviewSchema);
