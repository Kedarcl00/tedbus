/**
 * Route Routes
 * Defines endpoints for route operations: get all routes, get single route
 * 
 * Public routes (no authentication required):
 * - GET /routes
 * - GET /routes/:id
 */

const express = require('express');

/**
 * Create route routes with dependency injection
 * @param {RouteController} routeController - Injected RouteController instance
 * @returns {Router} Express router with route endpoints
 *
 * @example
 * const routeRoutes = createRouteRoutes(routeController);
 * app.use('/routes', routeRoutes);
 */
function createRouteRoutes(routeController) {
  if (!routeController) {
    throw new Error('RouteController is required for route routes');
  }

  const router = express.Router();

  /**
   * GET /routes
   * Retrieve all available routes
   * 
   * Authentication: NOT required (public endpoint)
   * 
   * Response:
   * {
   *   success: true,
   *   data: [
   *     {
   *       id: string,
   *       source: string,
   *       destination: string,
   *       duration: number,
   *       distance: number
   *     },
   *     ...
   *   ],
   *   count: number,
   *   message: "Routes retrieved successfully"
   * }
   * 
   * Error Codes:
   * - 500: Internal Server Error
   */
  router.get('/', (req, res, next) => {
    routeController.getRoutes(req, res);
  });

  /**
   * GET /routes/:id
   * Retrieve single route by ID
   * 
   * Authentication: NOT required (public endpoint)
   * 
   * URL Parameters:
   * - id: Route ID (MongoDB ObjectId)
   * 
   * Response:
   * {
   *   success: true,
   *   data: {
   *     id: string,
   *     source: string,
   *     destination: string,
   *     duration: number,
   *     distance: number
   *   },
   *   message: "Route details retrieved successfully"
   * }
   * 
   * Error Codes:
   * - 400: Bad Request (invalid route ID format)
   * - 404: Not Found (route doesn't exist)
   * - 500: Internal Server Error
   */
  router.get('/:id', (req, res, next) => {
    routeController.getRouteById(req, res);
  });

  return router;
}

module.exports = createRouteRoutes;
