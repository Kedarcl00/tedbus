/**
 * Route Planner Controller
 * Provides route calculation with traffic simulation, alternative routes,
 * real OSRM integration (open-source, no API key needed), and saved routes CRUD.
 */

const SavedRoute = require('../models/savedRoute');
const https = require('https');
const http = require('http');

// ── Indian city geocoding table ──────────────────────────────────────────────
const INDIA_CITIES = {
  'Mumbai':            { lat: 19.0760, lng: 72.8777 },
  'Delhi':             { lat: 28.6139, lng: 77.2090 },
  'Bangalore':         { lat: 12.9716, lng: 77.5946 },
  'Bengaluru':         { lat: 12.9716, lng: 77.5946 },
  'Hyderabad':         { lat: 17.3850, lng: 78.4867 },
  'Chennai':           { lat: 13.0827, lng: 80.2707 },
  'Kolkata':           { lat: 22.5726, lng: 88.3639 },
  'Pune':              { lat: 18.5204, lng: 73.8567 },
  'Ahmedabad':         { lat: 23.0225, lng: 72.5714 },
  'Jaipur':            { lat: 26.9124, lng: 75.7873 },
  'Lucknow':           { lat: 26.8467, lng: 80.9462 },
  'Surat':             { lat: 21.1702, lng: 72.8311 },
  'Kanpur':            { lat: 26.4499, lng: 80.3319 },
  'Nagpur':            { lat: 21.1458, lng: 79.0882 },
  'Indore':            { lat: 22.7196, lng: 75.8577 },
  'Thane':             { lat: 19.2183, lng: 72.9781 },
  'Bhopal':            { lat: 23.2599, lng: 77.4126 },
  'Visakhapatnam':     { lat: 17.6868, lng: 83.2185 },
  'Patna':             { lat: 25.5941, lng: 85.1376 },
  'Vadodara':          { lat: 22.3072, lng: 73.1812 },
  'Goa':               { lat: 15.2993, lng: 74.1240 },
  'Kochi':             { lat: 9.9312,  lng: 76.2673 },
  'Nashik':            { lat: 19.9975, lng: 73.7898 },
  'Aurangabad':        { lat: 19.8762, lng: 75.3433 },
  'Coimbatore':        { lat: 11.0168, lng: 76.9558 },
  'Madurai':           { lat: 9.9252,  lng: 78.1198 },
  'Mysore':            { lat: 12.2958, lng: 76.6394 },
  'Mysuru':            { lat: 12.2958, lng: 76.6394 },
  'Varanasi':          { lat: 25.3176, lng: 82.9739 },
  'Amritsar':          { lat: 31.6340, lng: 74.8723 },
  'Rajkot':            { lat: 22.3039, lng: 70.8022 },
  'Agra':              { lat: 27.1767, lng: 78.0081 },
  'Meerut':            { lat: 28.9845, lng: 77.7064 },
  'Raipur':            { lat: 21.2514, lng: 81.6296 },
  'Srinagar':          { lat: 34.0837, lng: 74.7973 },
  'Chandigarh':        { lat: 30.7333, lng: 76.7794 },
  'Guwahati':          { lat: 26.1445, lng: 91.7362 },
  'Dehradun':          { lat: 30.3165, lng: 78.0322 },
  'Jodhpur':           { lat: 26.2389, lng: 73.0243 },
  'Pimpri':            { lat: 18.6279, lng: 73.7997 },
  'Navi Mumbai':       { lat: 19.0330, lng: 73.0297 },
  'Thiruvananthapuram':{ lat: 8.5241,  lng: 76.9366 },
  'Tiruchirappalli':   { lat: 10.7905, lng: 78.7047 },
  'Salem':             { lat: 11.6643, lng: 78.1460 },
  'Tirunelveli':       { lat: 8.7139,  lng: 77.7567 },
  'Hubli':             { lat: 15.3647, lng: 75.1240 },
  'Mangalore':         { lat: 12.9141, lng: 74.8560 },
  'Belgaum':           { lat: 15.8497, lng: 74.4977 },
  'Guntur':            { lat: 16.3067, lng: 80.4365 },
};

/**
 * Haversine distance between two lat/lng points (km)
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Resolve an address string to coordinates using INDIA_CITIES table or Nominatim OSM
 */
async function geocode(address) {
  // Fast local lookup first
  const normalized = Object.keys(INDIA_CITIES).find(
    k => k.toLowerCase() === address.trim().toLowerCase()
  );
  if (normalized) return { ...INDIA_CITIES[normalized], address };

  // Partial match
  const partial = Object.keys(INDIA_CITIES).find(
    k => k.toLowerCase().includes(address.trim().toLowerCase()) ||
         address.trim().toLowerCase().includes(k.toLowerCase())
  );
  if (partial) return { ...INDIA_CITIES[partial], address };

  // Nominatim fallback (no API key needed)
  return new Promise((resolve, reject) => {
    const query = encodeURIComponent(`${address}, India`);
    const reqOptions = {
      hostname: 'nominatim.openstreetmap.org',
      path: `/search?q=${query}&format=json&limit=1&countrycodes=in`,
      headers: { 'User-Agent': 'TedBus-Route-Planner/1.0' },
    };
    https.get(reqOptions, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results && results.length > 0) {
            resolve({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), address });
          } else {
            reject(new Error(`Location not found: ${address}`));
          }
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

/**
 * Generate a simple intermediate polyline between two points
 * (used as a fallback when OSRM is not reachable)
 */
function interpolatePolyline(start, end, steps = 8) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Add a slight curve for visual realism
    const lat = start.lat + (end.lat - start.lat) * t + Math.sin(t * Math.PI) * 0.05;
    const lng = start.lng + (end.lng - start.lng) * t + Math.sin(t * Math.PI) * 0.02;
    points.push({ lat: +lat.toFixed(5), lng: +lng.toFixed(5) });
  }
  return points;
}

/**
 * Call OSRM (open-source routing) for a real route between waypoints
 * Falls back to straight-line interpolation if unreachable
 */
async function osrmRoute(coords) {
  const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(';');
  return new Promise((resolve) => {
    const path = `/route/v1/driving/${coordStr}?overview=simplified&geometries=geojson&alternatives=true&steps=false`;
    const reqOptions = {
      hostname: 'router.project-osrm.org',
      path,
      headers: { 'User-Agent': 'TedBus-Route-Planner/1.0' },
    };
    const req = https.get(reqOptions, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.code === 'Ok' && parsed.routes && parsed.routes.length > 0) {
            resolve({ ok: true, routes: parsed.routes });
          } else {
            resolve({ ok: false });
          }
        } catch (e) { resolve({ ok: false }); }
      });
    });
    req.on('error', () => resolve({ ok: false }));
    req.setTimeout(5000, () => { req.destroy(); resolve({ ok: false }); });
  });
}

/**
 * Simulate real-time traffic based on time of day
 * Returns: congestionLevel, delayFactor (multiplier), delayMinutes
 */
function getTrafficData(distanceKm) {
  const hour = new Date().getHours();
  let congestionLevel = 'low';
  let delayFactor = 1.0;

  // Peak hours
  if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) {
    congestionLevel = 'high';
    delayFactor = 1.4 + Math.random() * 0.2; // 40-60% delay
  } else if ((hour >= 7 && hour <= 11) || (hour >= 16 && hour <= 21)) {
    congestionLevel = 'moderate';
    delayFactor = 1.15 + Math.random() * 0.15; // 15-30% delay
  } else {
    delayFactor = 1.0 + Math.random() * 0.05;
  }

  const baseSpeedKmph = 55; // Average intercity bus speed
  const baseDurationH = distanceKm / baseSpeedKmph;
  const delayH = baseDurationH * (delayFactor - 1);
  const delayMins = Math.round(delayH * 60);

  return { congestionLevel, delayFactor, delayMins };
}

/**
 * Format distance/duration helpers
 */
function fmtDist(km) {
  return km >= 1 ? `${Math.round(km)} km` : `${Math.round(km * 1000)} m`;
}
function fmtDuration(minutes) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/route-planner/routes
 */
exports.getSavedRoutes = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.sendError('UNAUTHORIZED', 401);

    const sortBy = req.query.sortBy || 'recent';
    const sortMap = {
      recent:   { createdAt: -1 },
      frequent: { useCount: -1 },
      name:     { name: 1 },
    };

    const routes = await SavedRoute.find({ userId })
      .sort(sortMap[sortBy] || sortMap.recent)
      .lean();

    res.json(routes);
  } catch (err) {
    console.error('Get saved routes error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * POST /api/route-planner/routes
 */
exports.saveRoute = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.sendError('UNAUTHORIZED', 401);

    const { name, origin, destination, waypoints, distance, duration, trafficDelay, congestionLevel, alternatives } = req.body;

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
      duration: duration || '',
      trafficDelay: trafficDelay || '0 min',
      congestionLevel: congestionLevel || 'low',
      alternatives: alternatives || [],
    });

    res.status(201).json(savedRoute);
  } catch (err) {
    console.error('Save route error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * PATCH /api/route-planner/routes/:id/use — increment useCount
 */
exports.incrementUseCount = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.sendError('UNAUTHORIZED', 401);

    const route = await SavedRoute.findOneAndUpdate(
      { _id: req.params.id, userId },
      { $inc: { useCount: 1 } },
      { new: true }
    );
    if (!route) return res.sendError('NOT_FOUND', 404);
    res.json(route);
  } catch (err) {
    console.error('Increment useCount error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * DELETE /api/route-planner/routes/:id
 */
exports.deleteRoute = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.sendError('UNAUTHORIZED', 401);

    const route = await SavedRoute.findById(req.params.id);
    if (!route) return res.sendError('NOT_FOUND', 404, 'Route not found');
    if (route.userId !== userId) return res.sendError('UNAUTHORIZED', 403, 'Permission denied');

    await SavedRoute.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete route error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * POST /api/route-planner/calculate
 * Full route calculation with geocoding, OSRM routing, traffic simulation, and alternatives
 */
exports.calculateRoute = async (req, res) => {
  try {
    const { origin, destination, waypoints = [] } = req.body;

    if (!origin || !destination) {
      return res.sendError('VALIDATION', 400, 'Origin and destination are required');
    }

    // 1. Geocode all locations
    let originCoord, destCoord;
    const waypointCoords = [];

    try {
      originCoord = await geocode(origin.address);
    } catch (e) {
      return res.status(400).json({ error: `Could not locate: ${origin.address}` });
    }
    try {
      destCoord = await geocode(destination.address);
    } catch (e) {
      return res.status(400).json({ error: `Could not locate: ${destination.address}` });
    }
    for (const wp of waypoints.filter(w => w.address && w.address.trim())) {
      try {
        const wc = await geocode(wp.address);
        waypointCoords.push(wc);
      } catch (e) {
        console.warn(`Could not geocode waypoint ${wp.address}:`, e.message);
      }
    }

    // 2. Build all route coords (origin → waypoints → destination)
    const allCoords = [originCoord, ...waypointCoords, destCoord];

    // 3. Calculate straight-line distance as baseline
    let straightKm = 0;
    for (let i = 0; i < allCoords.length - 1; i++) {
      straightKm += haversineKm(allCoords[i].lat, allCoords[i].lng, allCoords[i + 1].lat, allCoords[i + 1].lng);
    }
    // Road distance is typically ~20-40% longer than straight-line
    const roadFactor = 1.25 + Math.random() * 0.15;
    const roadDistKm = straightKm * roadFactor;

    // 4. Get traffic data
    const traffic = getTrafficData(roadDistKm);

    // 5. Try OSRM for real route; fall back to interpolation
    let mainPolyline = [];
    let osrmDistKm = roadDistKm;
    let osrmDurationMin;

    const osrmResult = await osrmRoute(allCoords);
    if (osrmResult.ok && osrmResult.routes[0]) {
      const r = osrmResult.routes[0];
      osrmDistKm = r.distance / 1000;
      osrmDurationMin = (r.duration / 60) * traffic.delayFactor;

      // Extract polyline from GeoJSON
      if (r.geometry && r.geometry.coordinates) {
        mainPolyline = r.geometry.coordinates.map(([lng, lat]) => ({ lat: +lat.toFixed(5), lng: +lng.toFixed(5) }));
      }
    } else {
      // Fallback: stitch interpolated polylines
      for (let i = 0; i < allCoords.length - 1; i++) {
        mainPolyline.push(...interpolatePolyline(allCoords[i], allCoords[i + 1]));
      }
      const avgSpeedKmph = 55;
      osrmDurationMin = (osrmDistKm / avgSpeedKmph) * 60 * traffic.delayFactor;
    }

    const delayMins = traffic.delayMins;

    // 6. Build alternative routes
    const alternatives = [
      {
        label: 'Recommended',
        distance: fmtDist(osrmDistKm),
        duration: fmtDuration(osrmDurationMin),
        trafficDelay: delayMins > 0 ? `+${delayMins} min` : '0 min',
        congestionLevel: traffic.congestionLevel,
        polyline: mainPolyline,
        isSelected: true,
      },
      {
        label: 'Shortest',
        distance: fmtDist(straightKm * 1.15),
        duration: fmtDuration((straightKm * 1.15 / 55) * 60 * 1.05),
        trafficDelay: '0 min',
        congestionLevel: 'low',
        polyline: interpolatePolyline(originCoord, destCoord, 6),
        isSelected: false,
      },
      {
        label: 'Less Traffic',
        distance: fmtDist(osrmDistKm * 1.10),
        duration: fmtDuration(osrmDurationMin * 0.85),
        trafficDelay: delayMins > 2 ? `+${Math.max(0, delayMins - 10)} min` : '0 min',
        congestionLevel: traffic.congestionLevel === 'high' ? 'moderate' : 'low',
        polyline: interpolatePolyline(
          originCoord,
          destCoord,
          10,
        ).map((p, i, a) => ({
          lat: +(p.lat + Math.sin(i / a.length * Math.PI) * 0.08).toFixed(5),
          lng: +(p.lng + Math.cos(i / a.length * Math.PI) * 0.08).toFixed(5),
        })),
        isSelected: false,
      },
    ];

    // 7. Build the response
    const response = {
      origin: originCoord,
      destination: destCoord,
      waypoints: waypointCoords,
      distance: fmtDist(osrmDistKm),
      duration: fmtDuration(osrmDurationMin),
      trafficDelay: delayMins > 0 ? `+${delayMins} min delay` : 'No delay',
      congestionLevel: traffic.congestionLevel,
      trafficMessage: getTrafficMessage(traffic.congestionLevel),
      polyline: mainPolyline,
      alternatives,
      routeStats: {
        distanceKm: +osrmDistKm.toFixed(1),
        durationMin: +osrmDurationMin.toFixed(0),
        delayMin: delayMins,
        speedKmph: +(osrmDistKm / (osrmDurationMin / 60)).toFixed(0),
      },
      updatedAt: new Date().toISOString(),
    };

    res.json(response);
  } catch (err) {
    console.error('Calculate route error:', err);
    res.status(500).json({ error: err.message || 'Route calculation failed' });
  }
};

/**
 * GET /api/route-planner/traffic?origin=xx&destination=xx
 * Live traffic refresh for a specific OD pair
 */
exports.getTrafficUpdate = async (req, res) => {
  try {
    const { origin, destination } = req.query;
    if (!origin || !destination) {
      return res.status(400).json({ error: 'origin and destination are required' });
    }

    let oc, dc;
    try { oc = await geocode(origin); } catch (e) { return res.status(400).json({ error: `Cannot locate: ${origin}` }); }
    try { dc = await geocode(destination); } catch (e) { return res.status(400).json({ error: `Cannot locate: ${destination}` }); }

    const distKm = haversineKm(oc.lat, oc.lng, dc.lat, dc.lng) * 1.25;
    const traffic = getTrafficData(distKm);

    res.json({
      congestionLevel: traffic.congestionLevel,
      trafficDelay: traffic.delayMins > 0 ? `+${traffic.delayMins} min` : '0 min',
      trafficMessage: getTrafficMessage(traffic.congestionLevel),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Traffic update error:', err);
    res.status(500).json({ error: 'Failed to fetch traffic update' });
  }
};

/**
 * GET /api/route-planner/cities — list of supported cities for autocomplete
 */
exports.getCities = async (req, res) => {
  res.json(Object.keys(INDIA_CITIES).sort());
};

function getTrafficMessage(level) {
  switch (level) {
    case 'high':     return 'Heavy traffic on this route — expect significant delays';
    case 'moderate': return 'Moderate traffic — slight delays possible';
    default:         return 'Traffic is flowing smoothly';
  }
}
