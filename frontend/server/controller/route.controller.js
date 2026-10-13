/**
 * RouteController
 * Handles HTTP requests for route operations
 * Delegates business logic to RouteService
 * 
 * Key Principles:
 * - Thin controller that delegates to services
 * - Handle route list and detail retrieval
 * - No authentication required (public endpoints)
 * - Return proper HTTP status codes for each scenario
 * - Let ErrorHandlerService format all error responses
 * - Return standardized response format: {success: true, data: ...}
 */

const RouteService = require('../services/route.service');
const ErrorHandlerService = require('../services/error-handler.service');
const { ValidationError, NotFoundError } = require('../utils/custom-errors');

class RouteController {
  /**
   * Get all available routes
   * GET /routes
   * 
   * Returns a list of all available routes with:
   * - id: Route ID
   * - source: Departure location name
   * - destination: Arrival location name
   * - duration: Travel duration in minutes/hours
   * - distance: Distance between source and destination in km
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>} 200 OK with routes array or 500 Internal Server Error
   */
  async getRoutes(req, res) {
    try {
      // Call RouteService to retrieve all routes
      const routes = await RouteService.getRoutes();

      // Return 200 OK with routes array
      return res.status(200).json({
        success: true,
        data: routes,
        count: routes.length,
        message: routes.length > 0
          ? 'Routes retrieved successfully'
          : 'No routes available',
      });
    } catch (error) {
      // Log error and format response
      ErrorHandlerService.logError(error, {
        action: 'getRoutes',
        endpoint: '/routes',
      });

      // Format and return error response
      const formattedError = ErrorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Get single route by ID
   * GET /routes/:id
   * 
   * Returns details of a specific route:
   * - id: Route ID
   * - source: Departure location name
   * - destination: Arrival location name
   * - duration: Travel duration in minutes/hours
   * - distance: Distance between source and destination in km
   * 
   * @param {Object} req - Express request object
   * @param {string} req.params.id - Route ID (MongoDB ObjectId)
   * @param {Object} res - Express response object
   * @returns {Promise<void>} 200 OK with route details or 404 Not Found
   */
  async getRouteById(req, res) {
    try {
      // Extract and validate route ID from URL parameters
      const { id: routeId } = req.params;

      if (!routeId) {
        return res.status(400).json(
          ErrorHandlerService.formatError(
            new ValidationError('Route ID is required')
          )
        );
      }

      // Call RouteService to retrieve route by ID
      const route = await RouteService.getRouteById(routeId);

      // Return 200 OK with route details
      return res.status(200).json({
        success: true,
        data: route,
        message: 'Route details retrieved successfully',
      });
    } catch (error) {
      // Handle specific error types with appropriate status codes
      if (error instanceof NotFoundError) {
        return res.status(404).json(ErrorHandlerService.formatError(error));
      }

      if (error instanceof ValidationError) {
        return res.status(400).json(ErrorHandlerService.formatError(error));
      }

      // Log error and format response
      ErrorHandlerService.logError(error, {
        action: 'getRouteById',
        endpoint: '/routes/:id',
        routeId: req.params.id,
      });

      // Format and return error response
      const formattedError = ErrorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }
}

// Export as singleton instance for dependency injection
module.exports = new RouteController();
