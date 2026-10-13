/**
 * User Model - MongoDB schema for user/customer data
 * Stores user profiles for both Google OAuth and email/password registration
 * Supports user isolation and authentication
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // Google OAuth fields
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // User profile fields
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
      trim: true,
    },

    // Profile picture URL (from Google or uploaded)
    picture: {
      type: String,
      default: null,
    },

    profilePicture: {
      type: String,
      default: null,
    },

    // Password for email/password registration (optional if using Google)
    password: {
      type: String,
      default: null,
    },

    // Phone number for booking
    phone: {
      type: String,
      default: null,
    },

    // User preferences
    preferences: {
      language: {
        type: String,
        default: 'en',
      },
      notifications: {
        email: {
          type: Boolean,
          default: true,
        },
        sms: {
          type: Boolean,
          default: false,
        },
      },
    },

    // Account status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Track when user was created and last updated
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// Index for faster queries by email
userSchema.index({ email: 1 });

// Index for faster queries by Google ID
userSchema.index({ googleId: 1 });

// Index for sorting by creation date
userSchema.index({ createdAt: -1 });

// Virtual for getting profile picture
userSchema.virtual('displayPicture').get(function() {
  return this.profilePicture || this.picture;
});

module.exports = mongoose.model('User', userSchema);
