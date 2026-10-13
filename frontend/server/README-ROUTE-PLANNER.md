# Route Planner Feature Documentation

## Overview

The Interactive Route Planning Tool allows users to plan routes with multiple waypoints, view route details, and save/manage their favorite routes.

## Features

- **Route Calculation**: Calculate distance and duration between origin and destination
- **Waypoints**: Add, remove, and reorder intermediate stops
- **Map Placeholder**: Visual placeholder for future map integration
- **Save Routes**: Authenticated users can save their planned routes
- **Manage Saved Routes**: View, load, and delete saved routes
- **Graceful Degradation**: Works without external API keys (shows placeholder data)

## Environment Variables

To enable real-time route calculation with external mapping services, configure one of the following API keys:

### Google Maps API

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

**How to obtain:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Directions API
   - Distance Matrix API
   - Maps JavaScript API (for future map display)
4. Create credentials → API Key
5. Restrict the key to your domain for security

**Pricing:** Google Maps offers $200 free credit per month. [Pricing details](https://mapsplatform.google.com/pricing/)

### Mapbox API (Alternative)

```env
MAPBOX_API_KEY=your_mapbox_api_key_here
```

**How to obtain:**
1. Go to [Mapbox Account](https://account.mapbox.com/)
2. Sign up or sign in
3. Navigate to Access Tokens
4. Create a new token or use default public token
5. Enable the following scopes:
   - Directions API
   - Geocoding API

**Pricing:** Mapbox offers 100,000 free requests per month. [Pricing details](https://www.mapbox.com/pricing/)

## API Endpoints

### 1. Get Saved Routes

**Endpoint:** `GET /api/route-planner/routes`

**Headers Required:**
- `X-User-Id`: User's ID (automatically injected by auth interceptor)

**Response:**
```json
[
  {
    "_id": "route_id",
    "userId": "user_id",
    "name": "Daily Commute",
    "origin": {
      "address": "Mumbai",
      "lat": 19.0760,
      "lng": 72.8777
    },
    "destination": {
      "address": "Pune",
      "lat": 18.5204,
      "lng": 73.8567
    },
    "waypoints": [
      {
        "address": "Lonavala",
        "lat": 18.7537,
        "lng": 73.4087
      }
    ],
    "distance": "150 km",
    "duration": "3 hours",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

### 2. Save Route

**Endpoint:** `POST /api/route-planner/routes`

**Headers Required:**
- `X-User-Id`: User's ID (automatically injected by auth interceptor)

**Request Body:**
```json
{
  "name": "Weekend Trip",
  "origin": {
    "address": "Delhi",
    "lat": 28.6139,
    "lng": 77.2090
  },
  "destination": {
    "address": "Jaipur",
    "lat": 26.9124,
    "lng": 75.7873
  },
  "waypoints": [],
  "distance": "280 km",
  "duration": "5 hours"
}
```

**Response:**
```json
{
  "_id": "new_route_id",
  "userId": "user_id",
  "name": "Weekend Trip",
  ...
}
```

### 3. Delete Route

**Endpoint:** `DELETE /api/route-planner/routes/:id`

**Headers Required:**
- `X-User-Id`: User's ID (automatically injected by auth interceptor)

**Response:**
```json
{
  "success": true,
  "message": "Route deleted successfully"
}
```

### 4. Calculate Route

**Endpoint:** `POST /api/route-planner/calculate`

**Request Body:**
```json
{
  "origin": {
    "address": "Mumbai"
  },
  "destination": {
    "address": "Pune"
  },
  "waypoints": [
    {
      "address": "Lonavala"
    }
  ]
}
```

**Response (with API key configured):**
```json
{
  "distance": "150 km",
  "duration": "3 hours",
  "alternatives": [
    {
      "distance": "165 km",
      "duration": "3 hours 15 minutes"
    }
  ],
  "note": "API integration ready. Implement actual API call in this endpoint."
}
```

**Response (without API key):**
```json
{
  "distance": "API key required for distance calculation",
  "duration": "API key required for duration calculation",
  "alternatives": [],
  "note": "Set GOOGLE_MAPS_API_KEY or MAPBOX_API_KEY in .env to enable real route calculation"
}
```

## Integration Guide

### Implementing Google Maps Directions API

Update `/frontend/server/controller/route-planner.js` in the `calculateRoute` function:

```javascript
if (hasGoogleMapsKey) {
  const axios = require('axios');
  const waypointsParam = waypoints && waypoints.length > 0
    ? `&waypoints=${waypoints.map(w => w.address).join('|')}`
    : '';
  
  const apiUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin.address)}&destination=${encodeURIComponent(destination.address)}${waypointsParam}&alternatives=true&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  
  const response = await axios.get(apiUrl);
  const routes = response.data.routes;
  
  if (routes && routes.length > 0) {
    const mainRoute = routes[0].legs.reduce((acc, leg) => ({
      distance: acc.distance + leg.distance.value,
      duration: acc.duration + leg.duration.value
    }), { distance: 0, duration: 0 });
    
    return res.json({
      distance: `${(mainRoute.distance / 1000).toFixed(1)} km`,
      duration: `${Math.round(mainRoute.duration / 60)} minutes`,
      alternatives: routes.slice(1).map(r => {
        const altRoute = r.legs.reduce((acc, leg) => ({
          distance: acc.distance + leg.distance.value,
          duration: acc.duration + leg.duration.value
        }), { distance: 0, duration: 0 });
        return {
          distance: `${(altRoute.distance / 1000).toFixed(1)} km`,
          duration: `${Math.round(altRoute.duration / 60)} minutes`
        };
      })
    });
  }
}
```

### Implementing Mapbox Directions API

Update `/frontend/server/controller/route-planner.js` in the `calculateRoute` function:

```javascript
if (hasMapboxKey) {
  const axios = require('axios');
  const coordinates = [origin, ...waypoints, destination]
    .map(loc => `${loc.lng},${loc.lat}`)
    .join(';');
  
  const apiUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?alternatives=true&access_token=${process.env.MAPBOX_API_KEY}`;
  
  const response = await axios.get(apiUrl);
  const routes = response.data.routes;
  
  if (routes && routes.length > 0) {
    const mainRoute = routes[0];
    return res.json({
      distance: `${(mainRoute.distance / 1000).toFixed(1)} km`,
      duration: `${Math.round(mainRoute.duration / 60)} minutes`,
      alternatives: routes.slice(1).map(r => ({
        distance: `${(r.distance / 1000).toFixed(1)} km`,
        duration: `${Math.round(r.duration / 60)} minutes`
      }))
    });
  }
}
```

## Frontend Usage

### Navigate to Route Planner

```typescript
// In any component with Router
this.router.navigate(['/route-planner']);
```

### Or add link in navbar/menu

```html
<a routerLink="/route-planner">Route Planner</a>
```

## Database Schema

### SavedRoute Model

```javascript
{
  userId: String,          // User ID from X-User-Id header
  name: String,            // User-provided route name
  origin: {
    lat: Number,           // Optional: latitude
    lng: Number,           // Optional: longitude
    address: String        // Required: address text
  },
  destination: {
    lat: Number,
    lng: Number,
    address: String
  },
  waypoints: [{
    lat: Number,
    lng: Number,
    address: String
  }],
  distance: String,        // e.g., "150 km"
  duration: String,        // e.g., "3 hours"
  createdAt: Date          // Auto-generated timestamp
}
```

## Security

- **Authentication Required**: All save/delete operations require `X-User-Id` header
- **Ownership Verification**: Users can only delete their own routes
- **Input Validation**: All route data is validated before saving
- **API Key Security**: Store API keys in `.env`, never commit to git
- **Rate Limiting**: Consider adding rate limiting for external API calls

## Testing

### Without API Keys

1. Navigate to `/route-planner`
2. Enter origin and destination
3. Add waypoints (optional)
4. Click "Calculate Route"
5. Verify placeholder response is shown
6. Save route (requires sign-in)
7. View saved routes
8. Load and delete routes

### With API Keys

1. Set `GOOGLE_MAPS_API_KEY` or `MAPBOX_API_KEY` in `.env`
2. Restart backend server
3. Implement API integration code (see Integration Guide above)
4. Test route calculation with real data
5. Verify distance and duration are calculated correctly
6. Test with multiple waypoints
7. Verify alternative routes are shown

## Troubleshooting

### "Authentication required" error
- Ensure user is signed in with Google Sign-In
- Check that X-User-Id header is being sent (verify in Network tab)

### Routes not calculating
- Check if API key is set correctly in `.env`
- Verify API key has proper permissions and quotas
- Check server logs for API errors
- Ensure addresses are valid and geocodable

### Saved routes not loading
- Verify MongoDB connection is active
- Check user ID matches between sessions
- Inspect network requests in browser DevTools

### Map not displaying
- This is expected - map display requires separate implementation
- The placeholder message indicates where to configure API keys
- Implement map integration separately after API keys are configured

## Future Enhancements

1. **Real-time Traffic**: Integrate traffic data for accurate duration estimates
2. **Map Visualization**: Display routes on interactive map (Google Maps/Mapbox)
3. **Route Sharing**: Allow users to share routes with others
4. **Export Routes**: Export routes as GPX or KML files
5. **Route Analytics**: Track popular routes and optimize suggestions
6. **Public Transport**: Include bus, train, and metro options
7. **Cost Estimation**: Calculate fuel cost or fare estimates

## Dependencies

**Backend:**
- mongoose: MongoDB ODM
- express: Web framework
- axios (optional): For API calls to mapping services

**Frontend:**
- @angular/common: Common Angular utilities
- @angular/forms: Form handling
- HttpClient: HTTP requests

## Support

For issues or questions:
1. Check server logs: `cd frontend && npm run server`
2. Check browser console for frontend errors
3. Verify all environment variables are set correctly
4. Ensure MongoDB is running and connected
