/**
 * Authentication Routes
 * Defines endpoints for user authentication: login, register, logout, getCurrentUser
 */

const express = require('express');

/**
 * Create auth routes with dependency injection
 * @param {AuthController} authController - Injected AuthController instance
 * @returns {Router} Express router with auth endpoints
 *
 * @example
 * const authRoutes = createAuthRoutes(authController);
 * app.use('/auth', authRoutes);
 */
function createAuthRoutes(authController) {
  if (!authController) {
    throw new Error('AuthController is required for auth routes');
  }

  const router = express.Router();

  /**
   * POST /auth/login
   * Google OAuth login endpoint
   */
  router.post('/login', (req, res, next) => {
    authController.login(req, res, next);
  });

  /**
   * POST /auth/register
   * Email/password registration endpoint
   */
  router.post('/register', (req, res, next) => {
    authController.register(req, res, next);
  });

  /**
   * POST /auth/logout
   * Logout endpoint
   */
  router.post('/logout', (req, res, next) => {
    authController.logout(req, res, next);
  });

  /**
   * GET /auth/current-user
   * Get current authenticated user endpoint
   */
  router.get('/current-user', (req, res, next) => {
    authController.getCurrentUser(req, res, next);
  });

  return router;
}

module.exports = createAuthRoutes;
