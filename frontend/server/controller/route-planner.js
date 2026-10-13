const SavedRoute = require('../models/savedRoute');

/**
 * GET /api/route-planner/routes
 * Get all saved routes for authenticated user
 * Requires X-User-Id header
 */
exports.getSavedRoutes = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.sendError('UNAUTHORIZED', 401, 'Authentication required. Please sign in.');
    }
    
    const routes = await SavedRoute.find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    
    res.json(routes);
  } catch (err) {
    console.error('Get saved routes error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * POST /api/route-planner/routes
 * Save a new route
 * Requires X-User-Id header
 */
exports.saveRoute = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.sendError('UNAUTHORIZED', 401, 'Authentication required. Please sign in.');
    }
    
    const { name, origin, destination, waypoints, distance, duration } = req.body;
    
    // Validate required fields
    if (!name || !origin || !destination) {
      return res.sendError('VALIDATION', 400, 'Name, origin, and destination are required');
    }
    
    if (!origin.address || !destination.address) {
      return res.sendError('VALIDATION', 400, 'Origin and destination must have an address');
    }
    
    const savedRoute = await SavedRoute.create({
      userId,
      name,
      origin,
      destination,
      waypoints: waypoints || [],
      distance: distance || '',
      duration: duration || ''
    });
    
    res.status(201).json(savedRoute);
  } catch (err) {
    console.error('Save route error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * DELETE /api/route-planner/routes/:id
 * Delete a saved route
 * Requires X-User-Id header and ownership verification
 */
exports.deleteRoute = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.sendError('UNAUTHORIZED', 401, 'Authentication required. Please sign in.');
    }
    
    const { id } = req.params;
    
    // Find the route and verify ownership
    const route = await SavedRoute.findById(id);
    
    if (!route) {
      return res.sendError('NOT_FOUND', 404, 'Route not found');
    }
    
    if (route.userId !== userId) {
      return res.sendError('UNAUTHORIZED', 403, 'You do not have permission to delete this route');
    }
    
    await SavedRoute.findByIdAndDelete(id);
    
    res.json({ success: true, message: 'Route deleted successfully' });
  } catch (err) {
    console.error('Delete route error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * POST /api/route-planner/calculate
 * Calculate route between origin and destination with optional waypoints
 * Returns distance, duration, and alternatives
 * 
 * If GOOGLE_MAPS_API_KEY or MAPBOX_API_KEY is configured, this endpoint
 * would integrate with the mapping service. For now, returns a graceful
 * stub response indicating API key is required.
 */
exports.calculateRoute = async (req, res) => {
  try {
    const { origin, destination, waypoints } = req.body;
    
    // Validate input
    if (!origin || !destination) {
      return res.sendError('VALIDATION', 400, 'Origin and destination are required');
    }
    
    // Check for API keys
    const hasGoogleMapsKey = !!process.env.GOOGLE_MAPS_API_KEY;
    const hasMapboxKey = !!process.env.MAPBOX_API_KEY;
    
    if (hasGoogleMapsKey || hasMapboxKey) {
      // Integration point for Google Maps or Mapbox API
      // When API key is available, make actual API call here
      // For now, return a stub response with a note
      console.log('Route calculation request received. API integration point ready.');
      console.log(`Origin: ${origin.address}, Destination: ${destination.address}`);
      if (waypoints && waypoints.length > 0) {
        console.log(`Waypoints: ${waypoints.map(w => w.address).join(', ')}`);
      }
    }
    
    // Return graceful stub response
    // This allows the feature to work without requiring external API keys
    const response = {
      distance: hasGoogleMapsKey || hasMapboxKey 
        ? 'Calculating with API...' 
        : 'API key required for distance calculation',
      duration: hasGoogleMapsKey || hasMapboxKey 
        ? 'Calculating with API...' 
        : 'API key required for duration calculation',
      alternatives: [],
      note: hasGoogleMapsKey || hasMapboxKey
        ? 'API integration ready. Implement actual API call in this endpoint.'
        : 'Set GOOGLE_MAPS_API_KEY or MAPBOX_API_KEY in .env to enable real route calculation'
    };
    
    res.json(response);
  } catch (err) {
    console.error('Calculate route error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};
