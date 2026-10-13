const express = require('express');
const router = express.Router();
const authController = require('../controller/auth');

/**
 * Authentication Routes
 * Handles user login, logout, and session management
 */

/**
 * POST /auth/login
 * Login with Google Sign-In credentials
 * Body: { googleId, name, email, picture }
 */
router.post('/login', authController.loginWithGoogle);

/**
 * POST /auth/logout
 * Logout current user
 */
router.post('/logout', authController.logout);

/**
 * GET /auth/me
 * Get current authenticated user
 * Used for session restoration after page refresh
 */
router.get('/me', authController.getCurrentUser);

/**
 * POST /auth/register
 * Register new user with email/password
 * Placeholder - not yet implemented
 */
router.post('/register', authController.register);

module.exports = router;
