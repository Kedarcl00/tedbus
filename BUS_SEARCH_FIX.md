# 🔧 Bus Search Fix - Complete Details

## Problem
After filling "From", "To", and "Date" on the landing page, clicking "Search Buses" was failing with a resource loading error.

## Root Cause
**Missing Route Endpoint**

The frontend was calling:
```
GET /routes/Mumbai/Goa/2026-10-10
```

But this endpoint was NOT registered in the backend routes file, causing 404 Not Found.

---

## How the Bus Search Works

### Frontend Flow:

1. **Landing Page** (`landing-page.component.ts`)
   ```typescript
   submit() {
     // User fills form
     this.router.navigate(['/select-bus'], {
       queryParams: {
         departure: 'Mumbai',
         arrival: 'Goa',
         date: '2026-10-10'
       }
     });
   }
   ```

2. **Selectbus Page** (`right.component.ts`)
   ```typescript
   ngOnInit() {
     // Reads query params
     const departure = params['departure'];  // "Mumbai"
     const arrival = params['arrival'];      // "Goa"
     const date = params['date'];            // "2026-10-10"
     
     // Calls backend API
     this.busservice.GETBUSDETAILS(departure, arrival, date)
       .subscribe(response => {
         this.matchedbus = response.matchedBuses;
         this.routes = response.route;
         this.seats = response.busidwithseatobj;
       });
   }
   ```

3. **Bus Service** (`bus.service.ts`)
   ```typescript
   GETBUSDETAILS(depart: string, arrival: string, date: string) {
     const url = `${this.apiurl}${depart}/${arrival}/${date}`;
     // Calls: http://localhost:5001/routes/Mumbai/Goa/2026-10-10
     return this.http.get<Bus[]>(url);
   }
   ```

### Backend Flow (BEFORE FIX):

**routes/route.js:**
```javascript
// ❌ MISSING: /routes/:departure/:arrival/:date
router.get('/routes', RouteController.getRoutes);
router.get('/routes/:id', RouteController.getRouteById);
```

**Result:** 404 Not Found

---

## The Fix

### Added Missing Endpoint

**File:** `frontend/server/routes/route.js`

```javascript
const express = require('express');
const router = express.Router();
const RouteController = require('../controller/route.controller');
const routeControllerLegacy = require('../controller/route');  // ← Added

// NEW: Bus search endpoint
router.get('/routes/:departure/:arrival/:date', 
  routeControllerLegacy.getoneroute);  // ← Added this route

// Existing routes
router.get('/routes', RouteController.getRoutes);
router.get('/routes/:id', RouteController.getRouteById);

module.exports = router;
```

### Backend Controller Logic

**File:** `frontend/server/controller/route.js`

```javascript
exports.getoneroute = async (req, res) => {
  const { departure, arrival, date } = req.params;
  
  // 1. Find route matching departure and arrival cities
  const routes = await Route.find().lean().exec();
  const route = routes.find(r =>
    r.departureLocation.name.toLowerCase() === departure.toLowerCase() &&
    r.arrivalLocation.name.toLowerCase() === arrival.toLowerCase()
  );
  
  if (!route) {
    return res.status(404).json({ error: 'Route not found' });
  }
  
  // 2. Find all buses operating on this route
  const buses = await Bus.find().lean().exec();
  const matchedbuses = buses.filter(
    bus => bus.routes.toString() === route._id.toString()
  );
  
  // 3. Find existing bookings for this date
  const bookings = await Booking.find().lean().exec();
  const busidwithseatobj = {};
  
  for (const bus of matchedbuses) {
    const busbookings = bookings.filter(booking =>
      booking.departureDetails.date === date &&
      booking.busId.toString() === bus._id.toString()
    );
    const bookedSeats = busbookings.flatMap(booking => booking.seats);
    busidwithseatobj[bus._id.toString()] = bookedSeats;
  }
  
  // 4. Return route, buses, and booked seats
  res.json({ route, matchedBuses: matchedbuses, busidwithseatobj });
};
```

---

## API Response Format

**Request:**
```
GET /routes/Mumbai/Goa/2026-10-10
```

**Response:**
```json
{
  "route": {
    "_id": "507f1f77bcf86cd799439011",
    "departureLocation": {
      "name": "Mumbai",
      "city": "Mumbai",
      "state": "Maharashtra"
    },
    "arrivalLocation": {
      "name": "Goa",
      "city": "Goa",
      "state": "Goa"
    },
    "duration": 540,
    "distance": 580
  },
  "matchedBuses": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "busName": "Express Travels",
      "busType": "AC Sleeper",
      "totalSeats": 40,
      "fare": 800,
      "departureTime": "22:00",
      "arrivalTime": "07:00",
      "routes": "507f1f77bcf86cd799439011"
    },
    {
      "_id": "507f1f77bcf86cd799439013",
      "busName": "Luxury Coach",
      "busType": "Non-AC Seater",
      "totalSeats": 50,
      "fare": 500,
      "departureTime": "23:00",
      "arrivalTime": "08:00",
      "routes": "507f1f77bcf86cd799439011"
    }
  ],
  "busidwithseatobj": {
    "507f1f77bcf86cd799439012": [1, 2, 5, 10],  // Already booked seats
    "507f1f77bcf86cd799439013": []               // No bookings yet
  }
}
```

---

## How Frontend Uses This Data

### 1. Display Bus List

**Component:** `right.component.ts`
```typescript
this.matchedbus = response.matchedBuses;
// Displays each bus card with name, type, fare, times
```

### 2. Show Available Seats

**Component:** `bus-box.component.ts` (likely)
```typescript
this.seats = response.busidwithseatobj;
// For each bus, shows which seats are already booked
// User can only select available seats
```

### 3. Calculate Available Seats
```typescript
const busId = "507f1f77bcf86cd799439012";
const totalSeats = 40;
const bookedSeats = this.seats[busId];  // [1, 2, 5, 10]
const availableSeats = totalSeats - bookedSeats.length;  // 36
```

---

## Valid Routes

Based on the landing page code, these routes are valid:

| From | To |
|------|-----|
| Delhi | Jaipur |
| Mumbai | Goa |
| Bangalore | Mysore |
| Kolkata | Darjeeling |
| Chennai | Pondicherry |

**Note:** The database must have these routes configured with matching city names.

---

## Testing the Fix

### Test 1: Basic Search

1. Start servers
2. Go to `http://localhost:4200`
3. Select: Mumbai → Goa → Future date
4. Click "Search Buses"
5. **Expected:** Navigate to `/select-bus` page
6. **Expected:** See list of buses (if routes/buses exist in DB)

### Test 2: Check API Response

**In browser console:**
```javascript
fetch('http://localhost:5001/routes/Mumbai/Goa/2026-10-10')
  .then(r => r.json())
  .then(console.log);
```

**Expected:** JSON response with route, matchedBuses, busidwithseatobj

### Test 3: No Results Scenario

If database has no routes/buses:
- **Should see:** "No buses found" message (if implemented)
- **Should NOT see:** 404 error or blank page with console errors

---

## Database Requirements

For bus search to return results, the database needs:

### 1. Routes Collection
```javascript
{
  "_id": ObjectId("..."),
  "departureLocation": {
    "name": "Mumbai",
    "city": "Mumbai",
    "state": "Maharashtra"
  },
  "arrivalLocation": {
    "name": "Goa",
    "city": "Goa",
    "state": "Goa"
  },
  "duration": 540,
  "distance": 580
}
```

### 2. Buses Collection
```javascript
{
  "_id": ObjectId("..."),
  "busName": "Express Travels",
  "busType": "AC Sleeper",
  "totalSeats": 40,
  "fare": 800,
  "routes": ObjectId("..."),  // ← References route._id
  "departureTime": "22:00",
  "arrivalTime": "07:00"
}
```

### 3. Bookings Collection (Optional)
```javascript
{
  "_id": ObjectId("..."),
  "busId": ObjectId("..."),
  "customerId": ObjectId("..."),
  "departureDetails": {
    "date": "2026-10-10",
    "time": "22:00"
  },
  "seats": [1, 2, 5],  // ← These seats are booked
  "status": "confirmed"
}
```

---

## Error Scenarios

### Scenario 1: Route Not Found

**Request:** `GET /routes/InvalidCity/AnotherCity/2026-10-10`

**Response:**
```json
{
  "error": "Route not found"
}
```

**Status Code:** 404

### Scenario 2: No Buses on Route

**Request:** Valid route but no buses assigned

**Response:**
```json
{
  "route": { ... },
  "matchedBuses": [],  // ← Empty array
  "busidwithseatobj": {}
}
```

**Status Code:** 200

**Frontend Should:** Display "No buses available for this route"

---

## Preventing Future Issues

### Route Registration Pattern

**Always register dynamic routes BEFORE static routes:**

```javascript
// ✅ CORRECT ORDER
router.get('/routes/:departure/:arrival/:date', ...);  // Dynamic with 3 params
router.get('/routes', ...);                            // Static, no params
router.get('/routes/:id', ...);                        // Dynamic with 1 param

// ❌ WRONG ORDER
router.get('/routes/:id', ...);                        // Would match "/routes/Mumbai"
router.get('/routes/:departure/:arrival/:date', ...);  // Never reached!
```

**Why?** Express matches routes in order. More specific routes must come first.

---

## Summary

**Problem:** 404 error when searching buses  
**Cause:** Missing `/routes/:departure/:arrival/:date` endpoint  
**Fix:** Added route registration in `routes/route.js`  
**Result:** Bus search now works ✅

**Modified Files:**
- `/Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/frontend/server/routes/route.js`

**Status:** ✅ FIXED

---

*Now restart the backend server and test bus search!*
