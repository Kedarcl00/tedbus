const express = require('express');
const router = express.Router();
const RouteController = require('../controller/route.controller');
const routeControllerLegacy = require('../controller/route');

/**
 * Route Endpoints for bus ticket booking system
 * 
 * Public endpoints (no authentication required):
 * GET /routes - Get all available routes
 * GET /routes/:id - Get single route by ID
 * GET /routes/:departure/:arrival/:date - Search buses by route and date
 */

/**
 * GET /routes
 * Retrieve all available routes
 * 
 * Response Format:
 * {
 *   success: true,
 *   data: [
 *     {
 *       id: "507f1f77bcf86cd799439011",
 *       source: "New York",
 *       destination: "Boston",
 *       duration: 240,
 *       distance: 215
 *     },
 *     ...
 *   ],
 *   count: 5,
 *   message: "Routes retrieved successfully"
 * }
 */
router.get('/routes', (req, res) => RouteController.getRoutes(req, res));

/**
 * GET /routes/:departure/:arrival/:date
 * Search buses for specific route and date
 * 
 * URL Parameters:
 * - departure: Source city name (e.g., "Delhi")
 * - arrival: Destination city name (e.g., "Jaipur")
 * - date: Travel date in YYYY-MM-DD format (e.g., "2026-10-10")
 * 
 * Response Format:
 * {
 *   route: { _id, departureLocation, arrivalLocation, ... },
 *   matchedBuses: [ { _id, busName, busType, ... }, ... ],
 *   busidwithseatobj: { "busId": [bookedSeats], ... }
 * }
 */
router.get('/routes/:departure/:arrival/:date', routeControllerLegacy.getoneroute);

/**
 * GET /routes/:id
 * Retrieve single route by ID
 * 
 * URL Parameters:
 * - id: Route ID (MongoDB ObjectId)
 * 
 * Response Format:
 * {
 *   success: true,
 *   data: {
 *     id: "507f1f77bcf86cd799439011",
 *     source: "New York",
 *     destination: "Boston",
 *     duration: 240,
 *     distance: 215
 *   },
 *   message: "Route details retrieved successfully"
 * }
 * 
 * Error Responses:
 * 404 Not Found: Route doesn't exist
 * 400 Bad Request: Invalid route ID format
 * 500 Internal Server Error: Database or server error
 */
router.get('/routes/:id', (req, res) => RouteController.getRouteById(req, res));

module.exports = router;