# TedBus Cash on Trip Booking Failure — Investigation Report

**Date:** 2024
**Journey:** Mumbai → Goa, 2026-10-11
**Error:** `Booking validation failed: fare: Cast to Number failed for value "NaN" (type string) at path "fare"`

---

## Executive Summary

The root cause of the booking failure is a **complete mismatch between the backend bus data model and the frontend expectations**. The backend stores bus pricing in a field named `baseFare`, but the frontend code assumes a field named `fare`. Since `fare` does not exist in the backend response, it becomes `undefined` in the frontend, which leads to `NaN` when calculations are performed.

Additionally:
- The frontend **calculates fare locally** based on hardcoded formulas using `busType` and `duration`, ignoring any backend pricing.
- The backend Bus model has `baseFare`, but the search endpoint does not return bus objects—it returns them through a legacy route controller.
- Arrival time is present in the backend Bus schema (`arrivalDetails.time`, `arrivalDetails.date`) but may not be populated in actual data.

---

## Root Cause Analysis

### 1. The Fare Field Mismatch

**Backend Bus Model** (`src/models/Bus.js`, line 58):
```javascript
baseFare: {
  type: Number,
  required: true,
  min: 0,
}
```

**Frontend Bus Interface** (`frontend/src/app/model/bus.model.ts`):
```typescript
export interface Bus {
    _id?: string;
    operatorName: string;
    busType: string;
    departureTime: string;
    rating: number[];
    totalSeats?: number;
    routes: string;
    images: string;
    liveTracking: number;
    reschedulable: number;
    // NO fare property defined
}
```

**Frontend Booking Service DTO** (`frontend/src/app/service/booking.service.ts`, line 70):
```typescript
export interface Bus {
  busId: string;
  operatorName: string;
  departureTime: string;
  arrivalTime: string;
  fare: number;  // ← This expects 'fare', but backend provides 'baseFare'
  availableSeats: number;
  // ...
}
```

**Actual Backend Response** (from `frontend/server/controller/route.js`, line 5-40):
The search endpoint `GET /routes/:departure/:arrival/:date` returns:
```json
{
  "route": { "_id": "...", "departureLocation": {...}, "arrivalLocation": {...}, "duration": 10 },
  "matchedBuses": [
    {
      "_id": "...",
      "operatorName": "...",
      "busType": "...",
      "departureTime": "...",
      "rating": [...],
      "totalSeats": 50,
      "routes": "routeId",
      "images": "...",
      "liveTracking": 0,
      "reschedulable": 1,
      // NO 'fare' field in the response, but 'baseFare' is in the model
    }
  ],
  "busidwithseatobj": { "busId": [bookedSeats] }
}
```

The backend bus documents have `baseFare`, but the legacy route controller does not transform or include it in the response.

---

### 2. Frontend Fare Calculation Logic

**Location:** `frontend/src/app/Component/selectbus-page/right/bus-box/bus-box.component.ts`, lines 38-51

```typescript
ngOnInit(): void {
  // ...

  if (this.bustype === 'standard') {
    this.seatprivce = (50 * Math.floor(this.routedetails.duration)) / 2;
  } else if (this.bustype === 'sleeper') {
    this.seatprivce = (100 * Math.floor(this.routedetails.duration)) / 2;
  } else if (this.bustype === 'A/C Seater') {
    this.seatprivce = (125 * Math.floor(this.routedetails.duration)) / 2;
  } else {
    this.seatprivce = (75 * Math.floor(this.routedetails.duration)) / 2;
  }
  // ...
}
```

The frontend **ignores any backend fare** and calculates it locally using hardcoded per-km/hour rates based on `busType` and route `duration`.

---

### 3. Payment Page Fare Handling

**Location:** `frontend/src/app/Component/payment-page/payment-page.component.ts`, line 27

```typescript
passfare: number = 0;
```

**Location:** Line 82 (reading from route params):
```typescript
this.passfare = params['seatprice'];
```

**Location:** Line 122 (booking payload):
```typescript
const bookingData = {
  busId: this.busid,
  routeId: this.routeId,
  seats: this.passseatarray,
  fare: this.passfare,  // ← This is the calculated seatprice from bus-box.component
  paymentMethod: this.selectedPaymentMethod,
  departureDate: this.selecteddate,
  passengers: this.passengerdetails,
};
```

The `passfare` comes from the route parameter `seatprice`, which is calculated in `bus-box.component.ts` and passed through the booking form (`bus-booking-form.component.ts`, line 69).

**Problem:**
- If `routedetails.duration` is `undefined`, `NaN`, or malformed, the calculation produces `NaN`.
- If `seatprice` is not a number, `passfare` becomes `NaN`.
- When this is sent to the backend, Mongoose cannot cast `"NaN"` (string) to a Number.

---

### 4. Backend Booking Validation

**Backend Booking Schema** (`src/models/Booking.js`, line 67):
```javascript
fare: {
  type: Number,
  required: true,
  min: 0,
},
```

**Backend Booking Controller** (`src/controllers/booking.controller.js`, line 65):
```javascript
const booking = await this.bookingService.createBooking(userId, req.body);
```

**Backend Booking Service** (`src/services/booking.service.js`, line 89):
```javascript
const booking = new Booking({
  customerId: userId,
  busId: bookingData.busId,
  routeId: bookingData.routeId,
  seats: bookingData.seats,
  passengers: bookingData.passengers,
  fare: bookingData.fare,  // ← If this is NaN (string), Mongoose fails
  // ...
});
const savedBooking = await booking.save();
```

Mongoose schema validation throws:
```
Booking validation failed: fare: Cast to Number failed for value "NaN" (type string) at path "fare"
```

The backend returns HTTP 500 because it's a Mongoose validation error, not a business rule validation. The controller does not catch and transform this to HTTP 400/422.

---

## Complete Fare Data Flow

### Current (Broken) Flow

1. **Backend Bus Model**: Stores `baseFare` (Number, required).
2. **Backend Search Endpoint** (`GET /routes/:departure/:arrival/:date`): Returns bus objects from MongoDB **without including `baseFare`** in the JSON response.
3. **Frontend Bus Model**: Does not define a `fare` property; only has `operatorName`, `busType`, `departureTime`, etc.
4. **Frontend Bus Box Component**: Calculates `seatprice` locally using hardcoded formulas based on `busType` and `route.duration`.
5. **Frontend Booking Form**: Passes `seatprice` to payment page via route parameters.
6. **Frontend Payment Page**: Reads `passfare = params['seatprice']`.
7. **Frontend Booking Service**: Sends `fare: this.passfare` in POST `/api/bookings`.
8. **Backend Booking Service**: Attempts to save `fare` to MongoDB.
9. **Mongoose Validation**: Fails if `fare` is `NaN` or invalid.

### Why `fare` Becomes `NaN`

The fare calculation depends on `this.routedetails.duration`:

**Location:** `bus-box.component.ts`, line 40
```typescript
this.seatprivce = (50 * Math.floor(this.routedetails.duration)) / 2;
```

If `routedetails.duration` is:
- `undefined`: `Math.floor(undefined)` → `NaN` → `seatprivce = NaN`
- `null`: `Math.floor(null)` → `0` → fare is `0` (also invalid)
- A string like `"10h 30m"`: `Math.floor("10h 30m")` → `NaN`

The backend Bus model has:
```javascript
duration: {
  type: String, // Format: "10h 30m"
  required: false,
},
```

The frontend expects `duration` to be a **number** (e.g., `10` for 10 hours), but the backend schema defines it as a **string** (e.g., `"10h 30m"`).

**If the database has duration as a formatted string**, the calculation fails.

---

## Mismatched Fields Summary

| Field | Backend Bus Model | Backend Response (route.js) | Frontend Bus Model | Frontend Usage |
|-------|-------------------|----------------------------|-------------------|----------------|
| **Fare** | `baseFare` (Number, required) | Not included | Not defined | Calculated locally, ignores backend |
| **Duration** | `duration` (String, "10h 30m") | Included as-is | Expected as Number | Used in fare calculation; fails if string |
| **Arrival Time** | `arrivalDetails.time` (String) | Included if present | Not defined | Missing in frontend model |
| **Arrival Date** | `arrivalDetails.date` (String) | Included if present | Not defined | Missing in frontend model |
| **Departure Time** | `departureDetails.time` (String) | Mapped to `departureTime` | `departureTime` (string) | Used correctly |

---

## Secondary Issues

### 1. Arrival Time and Journey Duration

**Backend Bus Schema** (`src/models/Bus.js`, lines 36-44):
```javascript
arrivalDetails: {
  city: String,
  location: String,
  time: String,
  date: String,
},
```

**Frontend Bus Model** (`frontend/src/app/model/bus.model.ts`):
No `arrivalDetails` or `arrivalTime` property.

**Frontend Booking Service** (`frontend/src/app/service/booking.service.ts`, line 54):
```typescript
export interface Bus {
  arrivalTime: string; // HH:MM format
}
```

The frontend expects `arrivalTime`, but the backend provides `arrivalDetails.time`.

**Calculation in `bus-box.component.ts`** (line 54):
```typescript
this.busarrivaltime = (numericvalue + this.routedetails.duration) % 24;
```

This assumes `duration` is a number (hours), but the backend has it as a string.

### 2. Backend Error Handling

**Current:** The booking controller returns HTTP 500 for Mongoose validation errors.

**Expected:** HTTP 400 Bad Request or 422 Unprocessable Entity for invalid client data.

**Location:** `src/controllers/booking.controller.js`, lines 81-98

The controller catches `ValidationError` and `BusinessRuleError` but not Mongoose `ValidationError`. Mongoose errors bubble up as generic errors and return 500.

### 3. Frontend Booking Payload

**Location:** `frontend/src/app/Component/payment-page/payment-page.component.ts`, line 118

```typescript
const bookingData = {
  busId: this.busid,
  routeId: this.routeId,
  seats: this.passseatarray,
  fare: this.passfare,
  paymentMethod: this.selectedPaymentMethod,
  departureDate: this.selecteddate,
  passengers: this.passengerdetails,
};
```

**Missing fields:**
- `email` (required by backend Booking schema)
- `phoneNumber` (required by backend Booking schema)
- `totalAmount` (required by backend Booking schema)
- `departureDetails` (required by backend Booking schema for journey date)
- `arrivalDetails` (optional)

The backend Booking schema requires:
- `email` (line 54)
- `phoneNumber` (line 59)
- `totalAmount` (line 82)
- `departureDetails.date` (line 92)

The frontend payment page reads `email` and `phonenumber` from route params but does not include them in the booking payload.

---

## Prioritized Fixes

### Priority 1: Fix Fare Field Mismatch (Critical — Blocks Booking)

**Problem:** Backend has `baseFare`, frontend expects `fare`.

**Solutions:**
1. **Option A (Backend Change):** Modify the legacy route controller (`frontend/server/controller/route.js`) to map `baseFare` to `fare` in the response.
2. **Option B (Frontend Change):** Update the frontend to read `baseFare` instead of `fare`.
3. **Option C (Both):** Standardize on `baseFare` or `fare` across the entire stack.

**Recommendation:** **Option A** — Modify the backend search response to include `fare: bus.baseFare`. This is the smallest change and keeps the frontend booking flow intact.

### Priority 2: Fix Duration Type Mismatch (Critical — Causes NaN)

**Problem:** Backend has `duration` as a string (`"10h 30m"`), frontend expects a number (10).

**Solutions:**
1. **Backend:** Parse `duration` string into numeric hours and include both in the response.
2. **Frontend:** Parse `duration` string before using it in calculations.
3. **Database:** Populate duration as a number (e.g., 10) or provide both `durationFormatted` and `durationHours`.

**Recommendation:** **Backend change** — Add a computed field `durationHours` (number) in the search response. Keep `duration` string for display.

### Priority 3: Fix Missing Booking Payload Fields (Critical — Blocks Save)

**Problem:** Payment page does not send `email`, `phoneNumber`, `totalAmount`, or `departureDetails`.

**Solution:** Update `payment-page.component.ts` to include all required fields in the booking payload.

### Priority 4: Backend Fare Validation (High — Security)

**Problem:** Frontend calculates fare; backend trusts it without recalculation or validation.

**Solution:**
1. Backend recalculates `totalAmount` using `baseFare * seats.length` and validates it matches the frontend-provided `fare`.
2. Or, backend ignores the frontend `fare` and calculates it server-side.

**Recommendation:** **Hybrid approach** — Frontend sends `fare`, backend recalculates and overwrites it. If there's a large mismatch (> 10%), log a warning.

### Priority 5: Improve Backend Error Handling (Medium — UX)

**Problem:** Mongoose validation errors return HTTP 500 instead of HTTP 400.

**Solution:** Catch Mongoose `ValidationError` in the booking controller and return HTTP 400.

### Priority 6: Add Arrival Time to Frontend (Low — Feature Enhancement)

**Problem:** Arrival time is in the backend schema but not displayed or used in the frontend.

**Solution:**
1. Update frontend Bus model to include `arrivalTime` and `arrivalDate`.
2. Update search response to include `arrivalDetails`.
3. Display arrival time on bus cards and payment page.

---

## Test Data Analysis

**Journey:** Mumbai → Goa, 2026-10-11

The console shows the selected journey, but we need to verify:
1. Does the route exist in MongoDB with `departureLocation.name = "Mumbai"` and `arrivalLocation.name = "Goa"`?
2. Do buses exist for this route with `routes` field matching the route `_id`?
3. Do buses have `baseFare` populated?
4. Do buses have `duration` populated? Is it a number or a string?

**Action:** Inspect the actual MongoDB data for the Mumbai → Goa route.

---

## Files Changed (Proposed)

### Backend

1. **`frontend/server/controller/route.js`** (Legacy search endpoint)
   - Map `baseFare` → `fare` in the response.
   - Parse `duration` string into `durationHours` number.
   - Include `arrivalDetails.time` and `arrivalDetails.date` in the response.

2. **`src/controllers/booking.controller.js`**
   - Catch Mongoose `ValidationError` and return HTTP 400.

3. **`src/services/booking.service.js`**
   - Recalculate `fare` server-side using `baseFare * seats.length`.
   - Validate `totalAmount = fare + taxAmount + insuranceAmount + covidDonationAmount`.

### Frontend

4. **`frontend/src/app/model/bus.model.ts`**
   - Add `fare: number`, `arrivalTime: string`, `arrivalDate: string`, `durationHours: number`.

5. **`frontend/src/app/Component/selectbus-page/right/bus-box/bus-box.component.ts`**
   - Remove hardcoded fare calculation.
   - Use `bus.fare` (from backend) multiplied by selected seat count.
   - Handle `duration` as either string or number.

6. **`frontend/src/app/Component/payment-page/payment-page.component.ts`**
   - Add `email` and `phoneNumber` to the booking payload.
   - Calculate `totalAmount = fare + taxes + insurance + donation`.
   - Add `departureDetails` with correct date.
   - Validate `fare` is a finite positive number before submitting.

---

## Recommended Implementation Order

1. **Backend search response fix** (`frontend/server/controller/route.js`) — Adds `fare` field.
2. **Frontend Bus model update** — Adds `fare` property.
3. **Frontend fare calculation fix** (`bus-box.component.ts`) — Use backend `fare` instead of local calculation.
4. **Frontend payment page fix** (`payment-page.component.ts`) — Include all required fields, validate fare.
5. **Backend fare validation** (`booking.service.js`) — Recalculate and validate fare server-side.
6. **Backend error handling** (`booking.controller.js`) — Return HTTP 400 for validation errors.
7. **Arrival time feature** (all layers) — Add and display arrival time.

---

## Verification Steps

After fixes:

1. **Unit Test:** Create a booking with valid fare and verify it saves.
2. **Integration Test:** Search Mumbai → Goa, select a bus, verify `fare` is a number.
3. **E2E Test:** Complete a Cash on Trip booking and verify PDF shows correct fare.
4. **Validation Test:** Try to submit booking with `fare: NaN` and verify backend returns HTTP 400.
5. **Security Test:** Submit booking with manipulated fare (e.g., ₹1 instead of ₹850) and verify backend recalculates.

---

## Conclusion

The root cause is a **field name mismatch** (`baseFare` vs. `fare`) combined with a **type mismatch** (`duration` string vs. number) that causes the fare calculation to produce `NaN`. The frontend calculates fare locally and ignores the backend pricing, creating a security gap. The backend does not validate or recalculate the fare before saving.

**Immediate Fix:** Modify the backend search response to map `baseFare` to `fare` and parse `duration` into a numeric `durationHours`. Update the frontend to use the backend `fare` instead of calculating it locally.

**Long-Term Fix:** Move fare calculation entirely to the backend, validate all booking amounts server-side, and return HTTP 400 for invalid data instead of HTTP 500.
