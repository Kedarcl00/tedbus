const express = require('express');
const router = express.Router();
const usersController = require('../controller/users');

/**
 * User Profile Routes
 * All routes require X-User-Id header (injected by frontend interceptor)
 */

/**
 * GET /api/users/profile
 * Get current authenticated user's profile
 * User ID from X-User-Id header
 */
router.get('/profile', usersController.getProfile);

/**
 * PUT /api/users/profile  
 * Update current authenticated user's profile
 * User ID from X-User-Id header
 */
router.put('/profile', usersController.updateProfile);

/**
 * GET /api/users/preferences
 * Get current user's preferences
 * User ID from X-User-Id header
 */
router.get('/preferences', usersController.getPreferences);

/**
 * PUT /api/users/profile/language
 * Update current user's preferred language
 * User ID from X-User-Id header
 * Body: { language: 'en'|'hi'|'mr' }
 */
router.put('/profile/language', usersController.updateLanguage);

module.exports = router;
