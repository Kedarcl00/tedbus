const User = require('../models/User');
const LoggerService = require('../services/logger.service');
const logger = new LoggerService();

/**
 * Authentication Controller
 * Handles Google Sign-In, logout, and session management
 */

/**
 * Handle Google Sign-In
 * Creates new user or returns existing user
 */
exports.loginWithGoogle = async (req, res) => {
  try {
    const { googleId, name, email, picture } = req.body;

    // Validate required fields
    if (!googleId || !email) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: googleId and email'
      });
    }

    logger.info('Google login attempt', { email });

    // Find existing user or create new one
    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if user exists with same email (prevent duplicate accounts)
      user = await User.findOne({ email });
      
      if (user) {
        // Update existing user with Google ID
        user.googleId = googleId;
        user.picture = picture || user.picture;
        user.name = name || user.name;
        await user.save();
        logger.info('Updated existing user with Google ID', { email });
      } else {
        // Create new user
        user = new User({
          googleId,
          name,
          email,
          picture,
          preferences: {}
        });
        await user.save();
        logger.info('Created new user via Google Sign-In', { email });
      }
    } else {
      // User exists, update last login info if needed
      user.picture = picture || user.picture;
      user.name = name || user.name;
      await user.save();
      logger.info('User logged in via Google', { email });
    }

    // Return user data (don't include sensitive fields)
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        googleId: user.googleId,
        name: user.name,
        email: user.email,
        picture: user.picture,
        preferences: user.preferences,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    logger.error('Google login failed', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Handle user logout
 * Clears session data
 */
exports.logout = async (req, res) => {
  try {
    // In a session-based system, you would destroy the session here
    // In JWT-based system, client removes token
    // For now, just acknowledge the logout
    logger.info('User logged out');
    
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout failed', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get current user (for session restoration)
 * TODO: Implement JWT token validation or session check
 */
exports.getCurrentUser = async (req, res) => {
  try {
    // TODO: Implement session/JWT token validation
    // For now, return null (not implemented)
    res.status(200).json({
      success: true,
      user: null,
      message: 'Session management not yet implemented'
    });
  } catch (error) {
    logger.error('Get current user failed', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get current user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Handle email/password registration
 * Placeholder for future implementation
 */
exports.register = async (req, res) => {
  try {
    res.status(501).json({
      success: false,
      message: 'Email/password registration not yet implemented. Please use Google Sign-In.'
    });
  } catch (error) {
    logger.error('Registration failed', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
