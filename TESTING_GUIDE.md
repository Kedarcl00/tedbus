# TedBus Testing Guide

## Testing the New Features

This guide will walk you through testing all three newly implemented features:
1. Intelligent Fare Calculation
2. Arrival Time Display
3. Downloadable PDF Receipts

---

## Prerequisites

### Servers Running
Ensure both servers are running:

**Backend Server** (Port 5001)
```bash
cd frontend/server
npm start
```
Should see: `✅ Server is running on port 5001`

**Frontend Server** (Port 4200)
```bash
cd frontend
ng serve
```
Should see: `✓ Browser application bundle generation complete.`

### Database Seeded
The database should be populated with sample data:
```bash
cd frontend/server
node seed-database.js
```

---

## Test 1: Fare Calculation

### What to Test
Verify that fares are calculated correctly based on:
- Route distance
- Bus type (Non-AC, AC, Sleeper, Premium)
- Facilities (Live Tracking, Reschedulable)

### Test Steps

1. **Open the application**
   - Navigate to http://localhost:4200

2. **Search for buses**
   - From: `Mumbai`
   - To: `Goa`
   - Date: Any future date (e.g., `2026-10-10`)
   - Click "SEARCH BUSES"

3. **Observe fare differences**
   - Compare fares between different bus types
   - AC buses should be more expensive than Non-AC
   - Buses with Live Tracking should have +₹50
   - Buses with Reschedulable should have +₹30

4. **Test other routes**
   - Delhi → Jaipur (280 km)
   - Bangalore → Mysore (150 km)
   - Kolkata → Darjeeling (650 km)
   - Chennai → Pondicherry (165 km)

### Expected Results

**Mumbai → Goa (590 km)**
- AC with Reschedulable: ~₹1,770
- Non-AC (no extras): ~₹885
- Premium with both: ~₹2,293

**Delhi → Jaipur (280 km)**
- Sleeper with Reschedulable: ~₹786
- AC with Live Tracking: ~₹890

### ✅ Pass Criteria
- All buses display fare in ₹ (INR)
- Longer routes cost more
- AC/Premium buses cost more than Non-AC
- Facilities add to the base fare

---

## Test 2: Arrival Time Display

### What to Test
Verify that both departure and arrival times are displayed correctly.

### Test Steps

1. **Search for any route**
   - Example: Mumbai → Goa

2. **Check each bus card**
   - Look for "Departure Time"
   - Look for "Arrival Time"

3. **Verify time format**
   - Should be in HH:MM format (e.g., "18:45")

4. **Check overnight journeys**
   - For long routes (>10 hours departing in evening)
   - Arrival time should show next day's time correctly
   - Example: Depart 18:45, Duration 10.5 hours = Arrive 04:45

### Expected Results

**Mumbai → Goa** (10.5 hours)
- Bus departing 18:45 arrives at 04:45 (next day)
- Bus departing 08:30 arrives at 19:00 (same day)

**Delhi → Jaipur** (5.5 hours)
- Bus departing 22:00 arrives at 03:30 (next day)
- Bus departing 06:00 arrives at 11:30 (same day)

### ✅ Pass Criteria
- Both departure and arrival times are visible
- Times are in correct HH:MM format
- Overnight calculations are correct (modulo 24)

---

## Test 3: Downloadable PDF Receipts

### What to Test
Complete booking flow with "Cash on Trip" payment and verify receipt generation.

### Test Steps

#### Step 1: Search and Select Bus
1. Navigate to http://localhost:4200
2. Search: Mumbai → Goa, Date: 2026-10-10
3. Click "View Seats" on any bus

#### Step 2: Select Seats
1. Click on 1-2 available seats (shown in white/gray)
2. Seats should turn red when selected
3. Fare should update based on number of seats
4. Click "Continue" or "Book Now"

#### Step 3: Enter Passenger Details
1. Fill in passenger information:
   - Name: `John Doe`
   - Age: `30`
   - Gender: `Male`
2. For multiple seats, enter details for each passenger
3. Verify customer email is pre-filled (if logged in)
4. Click "Proceed to Payment"

#### Step 4: Select Cash on Trip
1. On payment page, select **"Cash on Trip"** radio button
2. Online payment section should hide
3. Cash on Trip section should appear showing:
   - "You selected Cash on Trip"
   - "Pay the driver ₹[amount] when you board"
   - "Keep the receipt for your records"
4. Click **"Confirm Booking"** button

#### Step 5: Receipt Modal Appears
Verify the receipt modal displays with:

**Header**
- ✅ "Booking Confirmed!" message
- ✅ Close button (×) in top-right

**Customer Information**
- ✅ Customer name
- ✅ Email address
- ✅ Booking reference (format: TB + timestamp)

**Journey Details**
- ✅ Route: Mumbai → Goa
- ✅ Total Distance: 590 km
- ✅ Departure: Date and Time
- ✅ Arrival: Date and Time
- ✅ Duration: 10 hours 30 minutes
- ✅ Seats: Your booked seat numbers

**Bus Information**
- ✅ Operator name
- ✅ Bus type (AC/Non-AC/etc.)
- ✅ Amenities list with icons
  - Air Conditioning
  - Push Back Seats
  - Water Bottle
  - Charging Point
  - Reading Light
  - Emergency Exit
  - Live Tracking (if available)
  - Reschedulable (if available)

**Passenger Details**
- ✅ Table with columns: Name, Age, Gender
- ✅ Row for each passenger

**Fare Breakdown**
- ✅ Total Fare in ₹
- ✅ Payment Method: Cash on Trip
- ✅ Note: "Please pay the driver ₹[amount] when you board"

**Action Buttons**
- ✅ "Download/Print Receipt" button (green)
- ✅ "Close" button (gray)

#### Step 6: Download/Print PDF
1. Click **"Download/Print Receipt"** button
2. Browser print dialog should open
3. In print dialog:
   - **To save as PDF**: Select "Save as PDF" as destination
   - **To print**: Select your printer
4. Verify preview shows:
   - No modal overlay/background
   - No header with "Booking Confirmed!"
   - No action buttons
   - Only the receipt content
5. Save or print

#### Step 7: Close Receipt
1. Click **"Close"** button OR
2. Click outside the modal (on dark overlay)
3. Receipt should close
4. Should return to payment page

### Expected Results

**Booking Reference Format**
- Should be: `TB1791543670000` (TB + timestamp)
- Unique for each booking

**Receipt Layout**
- Clean, professional appearance
- TedBus branding at top
- All information clearly organized
- Easy to read on screen and paper

**PDF Quality**
- Print preview shows clean layout
- No overlapping text
- All sections visible
- Page margins appropriate

### ✅ Pass Criteria
- Receipt appears immediately after booking confirmation
- All booking details are accurate and complete
- Passenger table shows all passengers
- Print dialog opens when download button clicked
- Receipt can be saved as PDF successfully
- Receipt can be printed directly
- PDF/Print version is clean (no modal elements)
- Modal closes properly

---

## Common Issues and Solutions

### Issue: Backend not responding
**Solution**: Check if backend is running on port 5001
```bash
curl http://localhost:5001/routes
# Should return JSON with routes
```

### Issue: Frontend not loading
**Solution**: Check if Angular is running on port 4200
```bash
curl http://localhost:4200
# Should return HTML
```

### Issue: No buses found
**Solution**: Reseed the database
```bash
cd frontend/server
node seed-database.js
```

### Issue: Departure date error
**Solution**: Ensure you select a future date, not a past date

### Issue: Receipt not showing
**Solution**: 
- Check browser console for errors (F12)
- Verify "Cash on Trip" is selected
- Ensure booking completed successfully

### Issue: Print dialog doesn't open
**Solution**:
- Check browser popup blocker
- Try in different browser (Chrome, Firefox, Safari)
- Check browser console for errors

---

## API Testing (Optional)

### Test Backend Directly

**Get all routes**
```bash
curl http://localhost:5001/routes | jq
```

**Search buses for a route**
```bash
curl "http://localhost:5001/routes/Mumbai/Goa/2026-10-10" | jq
```

**Create a booking** (requires auth token)
```bash
curl -X POST http://localhost:5001/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "busId": "6ac8c82d191e4d3fb3f5ba6e",
    "routeId": "6ac8c82d191e4d3fb3f5ba68",
    "seats": [12, 13],
    "fare": 1770,
    "paymentMethod": "cash_on_trip",
    "departureDate": "2026-10-10",
    "passengers": [
      {"name": "John Doe", "age": 30, "gender": "M"}
    ]
  }'
```

---

## Browser Compatibility

### Tested Browsers
- ✅ Google Chrome (recommended)
- ✅ Mozilla Firefox
- ✅ Safari
- ✅ Microsoft Edge

### Known Browser Issues
- **Safari**: May prompt for print destination differently
- **Firefox**: Print preview may look slightly different
- **Edge**: Should work identically to Chrome

---

## Mobile Testing

### Responsive Design
- Receipt modal should be responsive
- Should work on tablets and phones
- Print functionality may vary on mobile devices

### Mobile Print
- iOS: Use "Share" → "Print" → "Save as PDF"
- Android: Standard print dialog with PDF option

---

## Performance Checks

### Page Load Time
- Landing page: < 2 seconds
- Search results: < 3 seconds
- Receipt generation: Instant

### Network Requests
- Search should make 1 API call
- Booking should make 1 API call
- Receipt is generated client-side (no extra calls)

---

## Security Checks

### Payment Method
- Verify "Cash on Trip" doesn't process payment online
- No card details requested for cash payment
- Booking status should be "pending" not "completed"

### Data Validation
- Try invalid dates (past dates should fail)
- Try selecting occupied seats (should fail)
- Try booking without passenger details (should fail)

---

## Final Checklist

Before marking testing as complete, verify:

- [ ] Fares calculate correctly for all route and bus type combinations
- [ ] All buses show both departure and arrival times
- [ ] Times display in correct HH:MM format
- [ ] Overnight journeys calculate correctly
- [ ] "Cash on Trip" payment option works
- [ ] Receipt modal appears after booking
- [ ] All receipt sections have correct data
- [ ] Booking reference is unique and formatted correctly
- [ ] Passenger table shows all passengers
- [ ] Print dialog opens successfully
- [ ] Receipt can be saved as PDF
- [ ] Receipt can be printed directly
- [ ] Print version is clean (no modal elements)
- [ ] Modal closes properly
- [ ] No console errors during booking flow
- [ ] All features work in at least 2 browsers

---

## Reporting Issues

If you find any issues during testing:

1. Note the exact steps to reproduce
2. Take screenshots if possible
3. Check browser console for errors (F12)
4. Note the browser and version
5. Document expected vs actual behavior

---

## Success Metrics

**Feature is successful if:**
- 0 critical bugs (blocking usage)
- < 3 minor bugs (UI issues, minor errors)
- All pass criteria met
- Positive user feedback on usability
- PDF receipts are readable and professional

---

## Next Steps After Testing

1. ✅ Fix any critical bugs found
2. ✅ Document minor issues for future enhancement
3. ✅ Update user documentation
4. ✅ Prepare for production deployment
5. ✅ Train support team on new features

---

**Happy Testing! 🚌✅**
