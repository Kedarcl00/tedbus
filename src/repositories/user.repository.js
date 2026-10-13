/**
 * UserRepository - Data access layer for User model
 * Abstracts MongoDB queries and provides a consistent interface for user operations
 * Used by CustomerService and AuthService
 */

const User = require('../models/User');
const { NotFoundError } = require('../utils/custom-errors');

class UserRepository {
  /**
   * Find user by email
   * @param {string} email - User email address
   * @returns {Promise<Object|null>} User document or null if not found
   */
  async findByEmail(email) {
    if (!email) {
      return null;
    }
    return User.findOne({ email: email.toLowerCase() }).lean();
  }

  /**
   * Find user by Google ID
   * @param {string} googleId - Google user ID
   * @returns {Promise<Object|null>} User document or null if not found
   */
  async findByGoogleId(googleId) {
    if (!googleId) {
      return null;
    }
    return User.findOne({ googleId }).lean();
  }

  /**
   * Find user by MongoDB ID
   * @param {string} userId - MongoDB user ID
   * @returns {Promise<Object|null>} User document or null if not found
   */
  async findById(userId) {
    if (!userId) {
      return null;
    }
    return User.findById(userId).lean();
  }

  /**
   * Create new user
   * @param {Object} userData - User data to create
   * @returns {Promise<Object>} Created user document
   */
  async create(userData) {
    const user = new User(userData);
    const savedUser = await user.save();
    return savedUser.toObject();
  }

  /**
   * Update user by ID
   * @param {string} userId - MongoDB user ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user document
   */
  async updateById(userId, updateData) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    return User.findByIdAndUpdate(userId, updateData, { new: true }).lean();
  }

  /**
   * Check if email exists in database
   * @param {string} email - Email to check
   * @returns {Promise<boolean>} True if email exists, false otherwise
   */
  async emailExists(email) {
    if (!email) {
      return false;
    }
    const count = await User.countDocuments({ email: email.toLowerCase() });
    return count > 0;
  }

  /**
   * Check if Google ID exists in database
   * @param {string} googleId - Google ID to check
   * @returns {Promise<boolean>} True if Google ID exists, false otherwise
   */
  async googleIdExists(googleId) {
    if (!googleId) {
      return false;
    }
    const count = await User.countDocuments({ googleId });
    return count > 0;
  }

  /**
   * Delete user by ID
   * @param {string} userId - MongoDB user ID
   * @returns {Promise<Object>} Deleted user document
   */
  async deleteById(userId) {
    return User.findByIdAndDelete(userId).lean();
  }

  /**
   * Get all users with pagination
   * @param {number} skip - Number of documents to skip
   * @param {number} limit - Maximum number of documents to return
   * @returns {Promise<Array>} Array of user documents
   */
  async findAll(skip = 0, limit = 10) {
    return User.find({})
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Count total users
   * @returns {Promise<number>} Total user count
   */
  async count() {
    return User.countDocuments({});
  }
}

module.exports = UserRepository;
