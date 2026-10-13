# Implementation Plan: Fix Cash on Trip Booking Failure

**Error:** `Booking validation failed: fare: Cast to Number failed for value "NaN" (type string) at path "fare"`

**Root Cause:** Backend has `baseFare`, frontend expects `fare`. Duration type mismatch causes `NaN` in fare calculation. Missing required booking fields.

---

## Implementation Plan

- [ ] 1. **Fix Backend Bus Search Response — Add Fare and Parse Duration**
      
      Modify the legacy route controller to map `baseFare` to `fare` and parse `duration` string into numeric `durationHours`.
      
      **Files:**
      - `frontend/server/controller/route.js`
      
      **Changes:**
      - In `getoneroute()` method, after fetching buses, transform each bus:
        - Add `fare: bus.baseFare` (map baseFare to fare)
        - Parse `duration` string (e.g., "10h 30m") into `durationHours` number
        - If duration is already a number, use it directly
        - Include `arrivalTime: bus.arrivalDetails?.time` and `arrivalDate: bus.arrivalDetails?.date`
      - Update response to include transformed buses
      
      **Verify:** 
      - Run backend server: `cd frontend/server && node server.js` (or appropriate start command)
      - Make request: `curl http://localhost:5001/routes/Mumbai/Goa/2026-10-11`
      - Confirm response includes `fare` as a number and `durationHours` as a number
      - Check that if baseFare is 850, fare is also 850

- [ ] 2. **Update Frontend Bus Model — Add Fare and Arrival Fields**
      
      Add missing properties to the Bus interface that the frontend now receives from the backend.
      
      **Files:**
      - `frontend/src/app/model/bus.model.ts`
      
      **Changes:**
      - Add `fare: number` (per-seat base fare from backend)
      - Add `arrivalTime?: string` (arrival time in HH:MM format)
      - Add `arrivalDate?: string` (arrival date in YYYY-MM-DD format)
      - Add `durationHours?: number` (numeric duration for calculations)
      - Keep existing `busType`, `operatorName`, `departureTime`, etc.
      
      **Verify:** 
      - Run `cd frontend && ng build --configuration development`
      - Check for TypeScript compilation errors
      - No errors should occur in bus-related components

- [ ] 3. **Fix Frontend Fare Calculation — Use Backend Fare**
      
      Replace hardcoded fare calculation with backend-provided fare. Calculate total fare as `fare * selectedSeats.length`.
      
      **Files:**
      - `frontend/src/app/Component/selectbus-page/right/bus-box/bus-box.component.ts`
      - `frontend/src/app/Component/selectbus-page/right/bus-box/bus-box.component.html` (if fare display needs update)
      
      **Changes in bus-box.component.ts:**
      - Add `@Input() fare: number = 0` (receive fare from parent)
      - Remove or comment out the hardcoded fare calculation logic (lines 38-51):
        ```typescript
        // OLD: this.seatprivce = (50 * Math.floor(this.routedetails.duration)) / 2;
        ```
      - Replace with:
        ```typescript
        this.seatprivce = this.fare; // Use backend fare directly
        ```
      - If `fare` is 0 or undefined, log a warning and set a fallback or prevent booking
      - Update `busarrivaltime` calculation to handle both string and number duration:
        ```typescript
        const durationHours = this.routedetails.durationHours || 
                              (typeof this.routedetails.duration === 'number' ? this.routedetails.duration : 0);
        this.busarrivaltime = (numericvalue + durationHours) % 24;
        ```
      
      **Changes in parent components:**
      - Update `right.component.html` to pass `[fare]="bus.fare"` to `app-bus-box`
      - Cascade down through `bottom-tab`, `view-seats`, `form-drawer` to `bus-booking-form`
      
      **Verify:**
      - Run frontend: `cd frontend && ng serve`
      - Navigate to search page, search Mumbai → Goa, 2026-10-11
      - Inspect bus card: fare should be displayed (e.g., ₹850)
      - Open browser console, log `this.seatprivce` and verify it's a valid number (not NaN)

- [ ] 4. **Fix Payment Page Booking Payload — Add All Required Fields**
      
      Include `email`, `phoneNumber`, `totalAmount`, and `departureDetails` in the booking request. Validate fare is a valid number.
      
      **Files:**
      - `frontend/src/app/Component/payment-page/payment-page.component.ts`
      
      **Changes:**
      - In `makepayment()` method (around line 115), update `bookingData`:
        ```typescript
        const bookingData = {
          busId: this.busid,
          routeId: this.routeId,
          seats: this.passseatarray,
          fare: this.passfare,
          totalAmount: this.calculateTotalAmount(), // fare + insurance + donation
          paymentMethod: this.selectedPaymentMethod,
          departureDate: this.selecteddate,
          passengers: this.passengerdetails,
          email: this.email, // Already captured in component
          phoneNumber: this.phonenumber, // Already captured in component
          departureDetails: {
            city: this.routedetails.departureLocation?.name,
            location: this.routedetails.departureLocation?.location,
            time: this.busdepauturetime,
            date: this.selecteddate,
          },
          arrivalDetails: {
            city: this.routedetails.arrivalLocation?.name,
            location: this.routedetails.arrivalLocation?.location,
            time: this.busarrivaltime,
            date: this.calculateArrivalDate(),
          },
          duration: this.duration,
        };
        ```
      - Add validation before submit:
        ```typescript
        if (!this.passfare || isNaN(this.passfare) || this.passfare <= 0) {
          this.errorMessage = 'Invalid fare. Please reselect the bus and try again.';
          return;
        }
        ```
      - Add helper method `calculateTotalAmount()`:
        ```typescript
        calculateTotalAmount(): number {
          let total = this.passfare || 0;
          if (this.isinsurance) total += 50; // Example insurance amount
          if (this.iscoviddonated) total += 10; // Example donation
          return total;
        }
        ```
      - Add helper method `calculateArrivalDate()` (handle overnight trips):
        ```typescript
        calculateArrivalDate(): string {
          // If arrival time < departure time, add 1 day
          if (this.busarrivaltime < this.busdepauturetime) {
            const date = new Date(this.selecteddate);
            date.setDate(date.getDate() + 1);
            return date.toISOString().split('T')[0];
          }
          return this.selecteddate;
        }
        ```
      
      **Verify:**
      - Complete a booking flow from search to payment
      - Before clicking "Confirm Booking", inspect the payload in browser DevTools Network tab
      - Confirm payload includes: `fare` (number), `email`, `phoneNumber`, `totalAmount`, `departureDetails`, `seats`
      - Confirm `fare` is not `NaN` or `undefined`

- [ ] 5. **Backend Booking Validation — Recalculate and Validate Fare**
      
      Add server-side fare recalculation and validation. Do not trust frontend-provided fare as the sole authority.
      
      **Files:**
      - `src/services/booking.service.js`
      - `src/models/Bus.js` (read baseFare)
      
      **Changes in booking.service.js:**
      - In `createBooking()` method (around line 60), before creating the Booking document:
        ```javascript
        // Fetch bus to get authoritative baseFare
        const Bus = require('../models/Bus');
        const bus = await Bus.findById(bookingData.busId).lean();
        if (!bus) {
          throw new NotFoundError('Bus');
        }
        
        // Recalculate fare server-side
        const calculatedFare = bus.baseFare * bookingData.seats.length;
        const receivedFare = parseFloat(bookingData.fare);
        
        // Validate fare (allow small rounding differences)
        if (isNaN(receivedFare) || receivedFare <= 0) {
          throw new ValidationError('Fare must be a positive number', { field: 'fare' });
        }
        
        const fareDifference = Math.abs(calculatedFare - receivedFare);
        if (fareDifference > calculatedFare * 0.1) { // More than 10% difference
          console.warn(`Fare mismatch: expected ${calculatedFare}, received ${receivedFare}`);
          // Option 1: Overwrite with calculated fare
          bookingData.fare = calculatedFare;
          // Option 2: Reject booking (stricter)
          // throw new ValidationError('Fare does not match bus pricing');
        }
        
        // Calculate totalAmount if not provided or incorrect
        const calculatedTotal = bookingData.fare + 
                                (bookingData.taxAmount || 0) + 
                                (bookingData.insuranceAmount || 0) + 
                                (bookingData.covidDonationAmount || 0);
        bookingData.totalAmount = calculatedTotal;
        ```
      - Update Booking creation to use validated `bookingData.fare` and `bookingData.totalAmount`
      
      **Verify:**
      - Write a unit test in `src/services/booking.service.test.js`:
        ```javascript
        test('rejects booking with NaN fare', async () => {
          await expect(bookingService.createBooking(userId, { ...validData, fare: NaN }))
            .rejects.toThrow(ValidationError);
        });
        
        test('rejects booking with manipulated fare', async () => {
          await expect(bookingService.createBooking(userId, { ...validData, fare: 1 }))
            .rejects.toThrow(ValidationError); // Or overwrites with correct fare
        });
        ```
      - Run tests: `cd src && npm test`
      - Confirm tests pass

- [ ] 6. **Backend Error Handling — Return HTTP 400 for Validation Errors**
      
      Catch Mongoose ValidationError and return HTTP 400 instead of HTTP 500.
      
      **Files:**
      - `src/controllers/booking.controller.js`
      
      **Changes:**
      - In `createBooking()` method (around line 81), add catch for Mongoose ValidationError:
        ```javascript
        } catch (error) {
          // Catch Mongoose validation errors
          if (error.name === 'ValidationError') {
            // Mongoose ValidationError (e.g., cast to Number failed)
            const validationError = new ValidationError(
              error.message,
              { mongooseErrors: error.errors }
            );
            return res.status(400).json(this.errorHandlerService.formatError(validationError));
          }
          
          if (error instanceof ValidationError) {
            return res.status(400).json(this.errorHandlerService.formatError(error));
          }
          // ... rest of error handling
        }
        ```
      - Import or define `ValidationError` utility at the top if not already imported
      
      **Verify:**
      - Send a malformed booking request: `curl -X POST http://localhost:5001/api/bookings -H "Content-Type: application/json" -d '{"fare":"NaN"}'` (with auth headers)
      - Confirm response is HTTP 400, not HTTP 500
      - Confirm response body has a user-friendly error message

- [ ] 7. **Add Arrival Time Display (Optional Enhancement)**
      
      Display arrival time, arrival date, and journey duration on bus cards and payment page.
      
      **Files:**
      - `frontend/src/app/Component/selectbus-page/right/bus-box/bus-box.component.html`
      - `frontend/src/app/Component/selectbus-page/right/bus-box/bus-box.component.ts`
      - `frontend/src/app/Component/payment-page/payment-page.component.html`
      
      **Changes in bus-box.component.ts:**
      - Add `@Input() arrivalTime: string = ''` and `@Input() arrivalDate: string = ''`
      - Calculate if trip is overnight:
        ```typescript
        const isOvernight = this.busarrivaltime < this.busdepauturetime;
        ```
      - Format duration for display:
        ```typescript
        const durationHours = Math.floor(this.routedetails.durationHours || 0);
        const durationMinutes = Math.round(((this.routedetails.durationHours || 0) - durationHours) * 60);
        this.durationDisplay = `${durationHours}h ${durationMinutes}m`;
        ```
      
      **Changes in bus-box.component.html:**
      - Display departure time, arrival time, and duration:
        ```html
        <div class="journey-time">
          <span>{{ busdeparturetime }}:00</span>
          <span class="duration">{{ durationDisplay }}</span>
          <span>{{ busarrivaltime }}:00</span>
          <span *ngIf="isOvernight" class="next-day">Next day</span>
        </div>
        ```
      
      **Changes in payment-page.component.html:**
      - Display journey schedule:
        ```html
        <div class="journey-details">
          <p>Departure: {{ selecteddate }} at {{ busdepauturetime }}:00</p>
          <p>Arrival: {{ arrivalDate }} at {{ busarrivaltime }}:00</p>
          <p>Duration: {{ duration }}</p>
        </div>
        ```
      
      **Verify:**
      - Navigate to search results
      - Confirm each bus card shows: departure time, arrival time, duration, and "Next day" indicator if overnight
      - Confirm payment page shows the same information
      - Confirm PDF receipt (in `generateReceiptHTML()`) includes arrival time and duration

- [ ] 8. **End-to-End Testing — Complete Booking Flow**
      
      Test the complete flow from search to booking confirmation with valid and invalid scenarios.
      
      **Test Scenarios:**
      
      **A. Valid Booking with Cash on Trip:**
      - Search: Mumbai → Goa, 2026-10-11
      - Select a bus with valid `fare` (e.g., ₹850)
      - Select 2 seats → total fare ₹1700
      - Fill passenger details
      - Select payment method: Cash on Trip
      - Confirm booking
      - Expected: HTTP 201, booking created, PDF generated, shows in My Trips
      
      **B. Invalid Fare (Missing Bus Data):**
      - Search a route with no buses
      - Expected: Empty search results, cannot proceed to payment
      
      **C. Invalid Fare (Manipulated):**
      - Intercept request and change `fare` to 1
      - Expected: Backend recalculates and overwrites, or returns HTTP 400 validation error
      
      **D. Missing Required Fields:**
      - Submit booking without `email` or `phoneNumber`
      - Expected: Backend returns HTTP 400 with error message: "Email is required"
      
      **E. Multiple Seats:**
      - Select 3 seats
      - Verify total fare = baseFare × 3
      
      **Verify:**
      - Run frontend: `cd frontend && ng serve`
      - Run backend: `cd src && npm start` (or `cd frontend/server && node server.js` depending on setup)
      - Complete each test scenario manually or with automated E2E tests (Playwright/Cypress)
      - Check MongoDB database after successful booking:
        ```bash
        mongo
        use tedbus
        db.bookings.find().sort({_id:-1}).limit(1).pretty()
        ```
      - Confirm `fare`, `seats`, `email`, `phoneNumber`, `departureDetails.date` are correctly saved

- [ ] 9. **Documentation Update — Record Changes**
      
      Document the fixes and field mappings for future developers.
      
      **Files:**
      - `README.md` (root)
      - Create or update `docs/API.md` (if exists)
      
      **Changes:**
      - Add a section "Bus Search API Response" with example response showing `fare`, `durationHours`, `arrivalTime`
      - Add a section "Booking API Request" with example payload
      - Note: Backend recalculates fare server-side for security
      - Note: `baseFare` in Bus model is mapped to `fare` in search API response
      - Note: `duration` can be string or number; `durationHours` is always a number
      
      **Verify:**
      - Review documentation with a fresh perspective
      - Confirm examples match actual API behavior

---

## Verification Summary

**Build Commands:**
- Backend (main): `cd src && npm install && npm start` (if exists)
- Backend (frontend/server): `cd frontend/server && npm install && node server.js`
- Frontend: `cd frontend && npm install && ng serve`

**Test Commands:**
- Backend unit tests: `cd src && npm test` or `cd frontend/server && npm test`
- Frontend build: `cd frontend && ng build --configuration development`
- E2E tests (if available): `cd frontend && npm run e2e`

**Manual Test Checklist:**
- [ ] Search returns buses with valid `fare` (number, not NaN)
- [ ] Bus card displays fare in INR (₹850)
- [ ] Selecting seats calculates correct total fare
- [ ] Payment page shows correct fare before submission
- [ ] Booking request payload includes `fare`, `email`, `phoneNumber`, `departureDetails`
- [ ] Backend accepts valid booking and returns HTTP 201
- [ ] Backend rejects booking with NaN fare and returns HTTP 400
- [ ] Backend recalculates and validates fare against `baseFare`
- [ ] Booking saves correctly in MongoDB with all required fields
- [ ] My Trips displays booking with correct fare
- [ ] PDF receipt shows correct fare, seats, and journey details

**Database Verification:**
```bash
mongo
use tedbus
# Check a bus has baseFare:
db.buses.findOne({ operatorName: /.*/ })
# Check recent booking:
db.bookings.find().sort({_id:-1}).limit(1).pretty()
# Verify fare, email, phoneNumber, seats, departureDetails.date are present
```

---

## Estimated Impact

**Files Modified:** 7-9 files
**Lines Changed:** ~150-200 lines (mostly additions and small fixes)
**Risk Level:** Medium (touches critical booking flow)
**Testing Required:** High (unit tests + integration tests + E2E tests)
**Backward Compatibility:** High (no breaking changes for existing bookings)

---

## Rollback Plan

If fixes cause new issues:

1. **Backend:** Revert `frontend/server/controller/route.js` to original version. Old fare calculation in frontend will resume (still broken, but no worse).
2. **Frontend:** Revert `payment-page.component.ts` to original version. Booking will fail with same error as before.
3. **Database:** No schema changes, no migration needed. Existing bookings are unaffected.

---

## Post-Implementation

After all fixes:

1. **Monitor logs** for booking errors in the first 24 hours.
2. **Track fare mismatches** between frontend and backend (server-side logs).
3. **Verify** at least 5 successful Cash on Trip bookings in production.
4. **Update** test suite to prevent regression.
5. **Document** field mappings and validation rules for the team.

---

## Notes

- The backend has TWO servers: `src/server.js` (new architecture) and `frontend/server/server.js` (legacy). The frontend Angular app calls `http://localhost:5001` which is the **legacy server** (`frontend/server`). This is where the bus search fix must be applied.
- The new backend (`src/server.js`) at port 3001 has the `/api/bookings` endpoint, so booking creation goes there. Make sure both servers are running.
- The fare field name inconsistency exists because the project was partially refactored. The new backend uses `baseFare`, but the legacy search endpoint was not updated.
- The frontend `bus.service.ts` still has an old `addbusmongo()` method that is not used by the payment page. The payment page correctly uses `booking.service.ts` → `createBooking()`.
