/**
 * Customer Routes
 * Defines endpoints for customer/user profile operations: get profile, update profile, get preferences
 * 
 * All endpoints require authentication middleware
 * Protected routes: /users/profile, /users/preferences
 */

const express = require('express');

/**
 * Create customer routes with dependency injection
 * @param {CustomerController} customerController - Injected CustomerController instance
 * @param {Function} authMiddleware - Express middleware for authentication
 * @returns {Router} Express router with customer endpoints
 *
 * @example
 * const customerRoutes = createCustomerRoutes(customerController, authMiddleware);
 * app.use('/users', customerRoutes);
 */
function createCustomerRoutes(customerController, authMiddleware) {
  if (!customerController) {
    throw new Error('CustomerController is required for customer routes');
  }

  const router = express.Router();

  /**
   * GET /users/profile
   * Retrieve authenticated user's profile
   * 
   * Authentication: Required
   * 
   * Response:
   * {
   *   success: true,
   *   data: {
   *     id: string,
   *     googleId: string,
   *     name: string,
   *     email: string,
   *     picture: string,
   *     preferences: object,
   *     createdAt: date
   *   },
   *   message: "Profile retrieved successfully"
   * }
   * 
   * Error Codes:
   * - 401: Unauthorized (not authenticated)
   * - 404: Not Found (user profile doesn't exist)
   * - 500: Internal Server Error
   */
  router.get('/profile', authMiddleware, (req, res, next) => {
    customerController.getProfile(req, res, next);
  });

  /**
   * PUT /users/profile
   * Update authenticated user's profile
   * 
   * Authentication: Required
   * 
   * Request Body (all fields optional):
   * {
   *   name: string,
   *   picture: string,
   *   phone: string,
   *   address: string
   * }
   * 
   * Response:
   * {
   *   success: true,
   *   data: { updated user profile object },
   *   message: "Profile updated successfully"
   * }
   * 
   * Error Codes:
   * - 400: Bad Request (validation error, invalid update data)
   * - 401: Unauthorized (not authenticated)
   * - 403: Forbidden (user attempting to update another user's profile)
   * - 404: Not Found (user profile doesn't exist)
   * - 500: Internal Server Error
   */
  router.put('/profile', authMiddleware, (req, res, next) => {
    customerController.updateProfile(req, res, next);
  });

  /**
   * GET /users/preferences
   * Retrieve authenticated user's preferences
   * 
   * Authentication: Required
   * 
   * Response:
   * {
   *   success: true,
   *   data: {
   *     busType: string,
   *     notifications: boolean,
   *     language: string,
   *     currency: string,
   *     ...other preferences
   *   },
   *   message: "Preferences retrieved successfully"
   * }
   * 
   * Error Codes:
   * - 401: Unauthorized (not authenticated)
   * - 404: Not Found (user preferences don't exist)
   * - 500: Internal Server Error
   */
  router.get('/preferences', authMiddleware, (req, res, next) => {
    customerController.getPreferences(req, res, next);
  });

  return router;
}

module.exports = createCustomerRoutes;
