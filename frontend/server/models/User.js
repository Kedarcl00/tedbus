const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    picture: {
      type: String,
      required: false,
    },
    phone: {
      type: String,
      required: false,
    },
    gender: {
      type: String,
      required: false,
    },
    dateOfBirth: {
      type: Date,
      required: false,
    },
    preferences: {
      type: Object,
      default: {},
    },
    notificationPreferences: {
      type: Object,
      default: { email: true, push: false, inApp: true, promotional: true },
    },
    preferredLanguage: {
      type: String,
      default: 'en',
      enum: ['en', 'hi', 'mr'],
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
