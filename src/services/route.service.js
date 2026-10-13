/**
 * RouteService
 * Manages route catalog and route-related queries
 * 
 * Responsibility:
 * - Retrieve all available routes from the database
 * - Get individual route details by ID
 * - No user isolation required (routes are public data)
 * - No authentication required
 * - Standardize route response format across the application
 * 
 * @class RouteService
 */

const Route = require('../models/Route');
const { NotFoundError } = require('../utils/custom-errors');

class RouteService {
  /**
   * Get all available routes
   * 
   * Returns all routes in the system with source, destination, duration, and distance information.
   * Used for displaying route options in search interface.
   * 
   * @async
   * @returns {Promise<Array<Object>>} Array of route objects:
   *   - id: MongoDB ObjectId
   *   - source: Departure location name
   *   - destination: Arrival location name
   *   - duration: Travel duration in minutes
   *   - distance: Distance in kilometers
   * 
   * @throws {Error} If database query fails
   * 
   * @example
   * const routes = await routeService.getRoutes();
   * // Returns: [
   * //   { id: '507f...', source: 'NYC', destination: 'Boston', duration: 240, distance: 215 },
   * //   ...
   * // ]
   */
  async getRoutes() {
    try {
      const routes = await Route.find()
        .select('source destination duration distance')
        .lean()
        .exec();

      // Transform routes to match standardized response format
      return routes.map((route) => ({
        id: route._id,
        source: route.source || 'Unknown',
        destination: route.destination || 'Unknown',
        duration: route.duration || 0,
        distance: route.distance || 0,
      }));
    } catch (error) {
      throw new Error(`Failed to retrieve routes: ${error.message}`);
    }
  }

  /**
   * Get single route by ID
   * 
   * Retrieves details of a specific route by its MongoDB ObjectId.
   * Used for displaying detailed route information in the UI.
   * 
   * @async
   * @param {string} routeId - Route ID (MongoDB ObjectId)
   * @returns {Promise<Object>} Route details object:
   *   - id: MongoDB ObjectId
   *   - source: Departure location name
   *   - destination: Arrival location name
   *   - duration: Travel duration in minutes
   *   - distance: Distance in kilometers
   * 
   * @throws {NotFoundError} If route doesn't exist (HTTP 404)
   * @throws {Error} If database query fails (HTTP 500)
   * 
   * @example
   * const route = await routeService.getRouteById('507f1f77bcf86cd799439011');
   * // Returns: { id: '507f...', source: 'NYC', destination: 'Boston', duration: 240, distance: 215 }
   */
  async getRouteById(routeId) {
    try {
      const route = await Route.findById(routeId)
        .select('source destination duration distance')
        .lean()
        .exec();

      if (!route) {
        throw new NotFoundError('Route');
      }

      // Transform route to match standardized response format
      return {
        id: route._id,
        source: route.source || 'Unknown',
        destination: route.destination || 'Unknown',
        duration: route.duration || 0,
        distance: route.distance || 0,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to retrieve route: ${error.message}`);
    }
  }
}

// Export as singleton instance for dependency injection
module.exports = new RouteService();
