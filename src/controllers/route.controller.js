/**
 * RouteController
 * Handles HTTP requests for route operations (get all routes, get single route)
 * Delegates business logic to RouteService
 * 
 * Key Principles:
 * - Thin controller that only handles HTTP concerns
 * - Delegate all business logic to services
 * - Extract and validate query/path parameters from requests
 * - Return proper HTTP status codes for each scenario
 * - Let ErrorHandlerService format error responses
 * - No authentication required for route operations (public endpoint)
 * 
 * @class RouteController
 */

const RouteService = require('../services/route.service');
const ErrorHandlerService = require('../services/error-handler.service');
const { ValidationError, NotFoundError } = require('../utils/custom-errors');

class RouteController {
  /**
   * Constructor for dependency injection
   * @param {RouteService} routeService - Route service for business logic
   * @param {ErrorHandlerService} errorHandlerService - Error formatting service
   */
  constructor(routeService, errorHandlerService) {
    if (!routeService) {
      throw new Error('RouteService is required for RouteController');
    }
    if (!errorHandlerService) {
      throw new Error('ErrorHandlerService is required for RouteController');
    }

    this.routeService = routeService;
    this.errorHandlerService = errorHandlerService;
  }

  /**
   * Get all available routes
   * GET /routes
   * 
   * Response: 200 OK with routes array
   * Error: 500 Internal Server Error
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async getRoutes(req, res) {
    try {
      // Call service to retrieve all routes
      const routes = await this.routeService.getRoutes();

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
      this.errorHandlerService.logError(error, {
        action: 'getRoutes',
        endpoint: '/routes',
      });

      // Format and return error response
      const formattedError = this.errorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }

  /**
   * Get single route by ID
   * GET /routes/:id
   * 
   * URL Parameters:
   * - id: Route ID (MongoDB ObjectId)
   * 
   * Response: 200 OK with route details
   * Error: 400 Bad Request (invalid ID format), 404 Not Found
   * 
   * @param {Object} req - Express request object
   * @param {Object} req.params - Path parameters
   * @param {string} req.params.id - Route ID
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async getRouteById(req, res) {
    try {
      // Extract and validate route ID from URL parameters
      const { id: routeId } = req.params;

      if (!routeId) {
        return res.status(400).json(
          this.errorHandlerService.formatError(
            new ValidationError('Route ID is required', { field: 'id' })
          )
        );
      }

      // Call service to retrieve route by ID
      const route = await this.routeService.getRouteById(routeId);

      // Return 200 OK with route details
      return res.status(200).json({
        success: true,
        data: route,
        message: 'Route details retrieved successfully',
      });
    } catch (error) {
      // Handle specific error types with appropriate status codes
      if (error instanceof NotFoundError) {
        return res.status(404).json(this.errorHandlerService.formatError(error));
      }

      if (error instanceof ValidationError) {
        return res.status(400).json(this.errorHandlerService.formatError(error));
      }

      // Log error and format response
      this.errorHandlerService.logError(error, {
        action: 'getRouteById',
        endpoint: '/routes/:id',
        routeId: req.params.id,
      });

      // Format and return error response
      const formattedError = this.errorHandlerService.formatError(error);
      return res.status(formattedError.error.statusCode).json(formattedError);
    }
  }
}

module.exports = RouteController;
