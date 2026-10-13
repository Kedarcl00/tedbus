/**
 * RouteService
 * Manages route catalog and route-related queries
 * 
 * Responsibility:
 * - Retrieve available routes from the database
 * - Get individual route details by ID
 * - No user isolation required (routes are public data)
 * - No authentication required
 */

const Route = require('../models/route');
const { NotFoundError } = require('../utils/custom-errors');

class RouteService {
  /**
   * Get all available routes
   * @returns {Promise<Array>} Array of all routes with source, destination, duration, distance
   * @throws {Error} If database query fails
   */
  async getRoutes() {
    try {
      const routes = await Route.find()
        .select('departureLocation arrivalLocation duration')
        .lean()
        .exec();

      // Transform routes to match standardized response format
      return routes.map((route) => ({
        id: route._id,
        source: route.departureLocation?.name || 'Unknown',
        destination: route.arrivalLocation?.name || 'Unknown',
        duration: route.duration || 0,
        distance: route.distance || 0, // If distance field exists in model
      }));
    } catch (error) {
      throw new Error(`Failed to retrieve routes: ${error.message}`);
    }
  }

  /**
   * Get single route by ID
   * @param {string} routeId - Route ID (MongoDB ObjectId)
   * @returns {Promise<Object>} Route details with source, destination, duration, distance
   * @throws {NotFoundError} If route doesn't exist
   * @throws {Error} If database query fails
   */
  async getRouteById(routeId) {
    try {
      const route = await Route.findById(routeId)
        .select('departureLocation arrivalLocation duration')
        .lean()
        .exec();

      if (!route) {
        throw new NotFoundError('Route');
      }

      // Transform route to match standardized response format
      return {
        id: route._id,
        source: route.departureLocation?.name || 'Unknown',
        destination: route.arrivalLocation?.name || 'Unknown',
        duration: route.duration || 0,
        distance: route.distance || 0, // If distance field exists in model
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
