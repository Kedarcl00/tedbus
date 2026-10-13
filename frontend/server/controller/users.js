const User = require('../models/User');
const LoggerService = require('../services/logger.service');
const logger = new LoggerService();

/**
 * Users Controller
 * Handles user profile operations
 * User identification from X-User-Id header
 */

/**
 * Get current user's profile
 * GET /api/users/profile
 */
exports.getProfile = async (req, res) => {
  try {
    // Get Google ID from X-User-Id header (injected by frontend interceptor)
    const googleId = req.headers['x-user-id'];

    if (!googleId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401
        }
      });
    }

    logger.info('Fetching profile', { googleId });

    // Find user by Google ID
    const user = await User.findOne({ googleId }).lean().exec();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found',
          statusCode: 404
        }
      });
    }

    // Return user profile (exclude sensitive fields)
    res.status(200).json({
      id: user._id,
      googleId: user.googleId,
      name: user.name,
      email: user.email,
      picture: user.picture,
      preferences: user.preferences || {},
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });

  } catch (error) {
    logger.error('Error fetching profile', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to load profile',
        statusCode: 500
      }
    });
  }
};

/**
 * Update current user's profile
 * PUT /api/users/profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const googleId = req.headers['x-user-id'];

    if (!googleId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401
        }
      });
    }

    const { name, phone, picture, preferences } = req.body;

    logger.info('Updating profile', { googleId });

    // Find and update user
    const user = await User.findOneAndUpdate(
      { googleId },
      {
        $set: {
          ...(name && { name }),
          ...(phone && { phone }),
          ...(picture && { picture }),
          ...(preferences && { preferences }),
          updatedAt: new Date()
        }
      },
      { new: true, lean: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found',
          statusCode: 404
        }
      });
    }

    // Return updated profile
    res.status(200).json({
      id: user._id,
      googleId: user.googleId,
      name: user.name,
      email: user.email,
      picture: user.picture,
      phone: user.phone,
      preferences: user.preferences || {},
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });

  } catch (error) {
    logger.error('Error updating profile', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update profile',
        statusCode: 500
      }
    });
  }
};

/**
 * Get current user's preferences
 * GET /api/users/preferences
 */
exports.getPreferences = async (req, res) => {
  try {
    const googleId = req.headers['x-user-id'];

    if (!googleId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401
        }
      });
    }

    const user = await User.findOne({ googleId }).select('preferences').lean().exec();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          statusCode: 404
        }
      });
    }

    res.status(200).json(user.preferences || {});

  } catch (error) {
    logger.error('Error fetching preferences', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to load preferences',
        statusCode: 500
      }
    });
  }
};

/**
 * Update current user's preferred language
 * PUT /api/users/profile/language
 * Body: { language: 'en'|'hi'|'mr' }
 */
exports.updateLanguage = async (req, res) => {
  try {
    const googleId = req.headers['x-user-id'];

    if (!googleId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401
        }
      });
    }

    const { language } = req.body;

    // Validate language
    const validLanguages = ['en', 'hi', 'mr'];
    if (!language || !validLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LANGUAGE',
          message: 'Language must be one of: en, hi, mr',
          statusCode: 400
        }
      });
    }

    logger.info('Updating user language', { googleId, language });

    // Update user's preferred language
    const user = await User.findOneAndUpdate(
      { googleId },
      { $set: { preferredLanguage: language } },
      { new: true, lean: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          statusCode: 404
        }
      });
    }

    res.status(200).json({
      success: true,
      language: user.preferredLanguage
    });

  } catch (error) {
    logger.error('Error updating language', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update language',
        statusCode: 500
      }
    });
  }
};
