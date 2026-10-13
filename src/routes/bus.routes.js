/**
 * Bus Routes
 * Defines endpoints for bus operations: search buses, get bus details, check availability
 * 
 * Public routes (no authentication required):
 * - GET /buses
 * - GET /buses/:id
 * - GET /buses/search
 */

const express = require('express');

/**
 * Create bus routes with dependency injection
 * @param {BusController} busController - Injected BusController instance
 * @returns {Router} Express router with bus endpoints
 *
 * @example
 * const busRoutes = createBusRoutes(busController);
 * app.use('/buses', busRoutes);
 */
function createBusRoutes(busController) {
  if (!busController) {
    throw new Error('BusController is required for bus routes');
  }

  const router = express.Router();

  /**
   * GET /buses/search
   * Search buses with filters and sorting
   * 
   * Authentication: NOT required (public endpoint)
   * 
   * Query Parameters:
   * - from: Source location name (required)
   * - to: Destination location name (required)
   * - date: Travel date in YYYY-MM-DD format (required)
   * - passengers: Number of passengers (optional, default: 1)
   * - busType: Filter by bus type (AC, NonAC, Sleeper) (optional)
   * - priceRange: Filter by price range, e.g., "0-50" or "100-200" (optional)
   * - departureTime: Filter by departure time range (optional)
   * - sortBy: Sort results by: price_asc, price_desc, departure_asc, duration_asc (optional, default: price_asc)
   * 
   * Response:
   * {
   *   success: true,
   *   data: [
   *     {
   *       busId: string,
   *       operatorName: string,
   *       departureTime: string,
   *       arrivalTime: string,
   *       fare: number,
   *       availableSeats: number,
   *       totalSeats: number,
   *       busType: string,
   *       amenities: string[],
   *       registrationNumber: string
   *     },
   *     ...
   *   ],
   *   count: number,
   *   message: "Buses retrieved successfully"
   * }
   * 
   * Error Codes:
   * - 400: Bad Request (missing required parameters, invalid date format)
   * - 500: Internal Server Error
   */
  router.get('/search', (req, res, next) => {
    busController.searchBuses(req, res);
  });

  /**
   * GET /buses/:id
   * Retrieve bus details by ID
   * 
   * Authentication: NOT required (public endpoint)
   * 
   * URL Parameters:
   * - id: Bus ID (MongoDB ObjectId)
   * 
   * Response:
   * {
   *   success: true,
   *   data: {
   *     busId: string,
   *     operatorName: string,
   *     busType: string,
   *     totalSeats: number,
   *     registrationNumber: string,
   *     amenities: string[],
   *     seatLayout: { rows: number, columns: number },
   *     ...bus details
   *   },
   *   message: "Bus details retrieved successfully"
   * }
   * 
   * Error Codes:
   * - 400: Bad Request (invalid bus ID format)
   * - 404: Not Found (bus doesn't exist)
   * - 500: Internal Server Error
   */
  router.get('/:id', (req, res, next) => {
    busController.getBusById(req, res);
  });

  /**
   * GET /buses
   * Retrieve all buses (for admin or listing)
   * 
   * Authentication: NOT required (public endpoint)
   * 
   * Query Parameters (optional):
   * - page: Pagination page number (optional)
   * - limit: Items per page (optional)
   * 
   * Response:
   * {
   *   success: true,
   *   data: [{ bus object }, ...],
   *   count: number,
   *   message: "Buses retrieved successfully"
   * }
   * 
   * Error Codes:
   * - 500: Internal Server Error
   */
  router.get('/', (req, res, next) => {
    // Route order matters: PUT /buses/:id/search before GET /buses/:id
    // For now, if searchBuses is called here, handle it
    if (req.query.search) {
      return busController.searchBuses(req, res);
    }
    // Return all buses or handle list endpoint
    return res.status(200).json({
      success: true,
      data: [],
      message: 'Use GET /buses/search to search buses',
    });
  });

  return router;
}

module.exports = createBusRoutes;
