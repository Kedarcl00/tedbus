# 🧪 Testing Fares - Quick Start Guide

## Current Status
✅ **14 buses created with calculated fares**
✅ **MongoDB Atlas database populated**
✅ **Backend API endpoint ready**
✅ **Frontend services ready (FareCalculationService, ArrivalTimeService)**

## Quick Test Steps

### 1. Start the Backend Server
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/frontend/server
npm start
```

The server should connect to MongoDB Atlas and be ready on `http://localhost:5001`

###2. Test API Directly (Terminal)

**List all buses with fares for Mumbai → Goa:**
```bash
curl -X GET "http://localhost:5001/routes/Mumbai/Goa/2024-12-25" | jq '.matchedBuses[] | {reg: .registrationNumber, type: .busType, fare: .fare, departure: .departureTime, arrival: .arrivalTime}'
```

**Expected output:**
```json
{
  "reg": "MH01ZE3128",
  "type": "AC",
  "fare": 2175,
  "departure": "18:45",
  "arrival": "04:45"
}
```

### 3. Start Frontend App
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/frontend
ng serve
```

Navigate to `http://localhost:4200` in your browser

### 4. Test Complete Booking Flow

#### Step 1: Search for Buses
- Enter: From: **Mumbai**, To: **Goa**
- Enter: Date: **Any future date**
- Click: **Search**
- ✅ Verify: Buses display with fares on cards

#### Step 2: Select a Bus
- Click on a bus card
- ✅ Verify: Fare details shown on the selected bus page

#### Step 3: Select Seats
- Click on available seats
- ✅ Verify: Fare updates dynamically as seats selected/deselected
- ✅ Verify: Fare breakdown shows:
  - Fare per seat: ₹X
  - Number of seats: Y
  - Total amount: ₹Z

#### Step 4: Proceed to Payment
- Click: **Proceed to Payment**
- ✅ Verify: Fare total matches what was shown in seat selection

#### Step 5: Select Payment Method
- Choose: **Online Payment** OR **Cash on Trip**
- If Cash on Trip: ✅ Verify message shows "Pay ₹[amount] to operator"
- Click: **Submit Booking**

#### Step 6: Booking Confirmation
- ✅ Verify: Booking reference ID is shown
- ✅ Verify: Receipt shows all details including:
  - Bus details
  - Passenger names/count
  - Seats selected
  - Fare breakdown
  - Total amount
  - Payment method

#### Step 7: Download Receipt
- Click: **Download PDF**
- ✅ Verify: PDF contains booking reference and all details

### 5. Verify Database Storage
Connect to MongoDB Atlas and check:

```javascript
// In MongoDB Atlas shell
db.bookings.findOne({})
// Check fields:
// - baseFarePerSeat
// - totalSeatsBooked
// - totalAmount
// - paymentMethod
// - departureLocation
// - arrivalLocation
```

## Test Routes Available

| From | To | Distance | Buses | Sample Fares |
|---|---|---|---|---|
| Mumbai | Goa | 580 km | 3 | ₹2,175 - ₹2,755 |
| Delhi | Jaipur | 280 km | 3 | ₹450 - ₹1,100 |
| Bangalore | Mysore | 150 km | 3 | ₹255 - ₹750 |
| Kolkata | Darjeeling | 620 km | 3 | ₹960 - ₹1,910 |
| Chennai | Pondicherry | 170 km | 2 | ₹540 - ₹1,025 |

## What to Verify

### Fares
- [ ] Fares display on bus search results
- [ ] Fares are different for different bus types
- [ ] Fares recalculate when seats are selected/deselected
- [ ] Final fare on payment page matches seat selection

### Arrival Times
- [ ] Arrival times show on bus cards
- [ ] Arrival times show on payment page
- [ ] Next-day arrivals marked correctly (if applicable)
- [ ] Format is HH:MM

### Payment Methods
- [ ] Online Payment option available
- [ ] Cash on Trip option available
- [ ] Correct amount shown for Cash on Trip

### Receipt
- [ ] Receipt includes all booking details
- [ ] Receipt shows correct fare breakdown
- [ ] PDF download works
- [ ] PDF is readable with all information

### Database
- [ ] Booking saved with correct fare
- [ ] All customer details saved
- [ ] Payment method saved correctly
- [ ] Booking reference generated

## Troubleshooting

### Issue: API returns fare: 0
**Solution:**
1. Check if database was properly seeded:
   ```bash
   node frontend/server/seed-database.js
   ```
2. Restart server:
   ```bash
   npm start
   ```
3. Verify route.js returns `bus.fare` (not `bus.baseFare`)

### Issue: MongoDB connection error
**Solution:**
1. Check .env file has correct MONGODB_URI
2. Verify internet connection to MongoDB Atlas
3. Check IP whitelist in MongoDB Atlas console

### Issue: No buses appear in search
**Solution:**
1. Verify buses were created (check seeding output)
2. Use exact city names: Mumbai, Goa, Delhi, Jaipur, etc. (case-insensitive)
3. Use future date in YYYY-MM-DD format

### Issue: Fares don't recalculate on seat selection
**Solution:**
1. Ensure FareCalculationService is injected in component
2. Check console for JavaScript errors
3. Verify seat selection emits events

## Expected Behavior

✅ **Bus Search Results:**
- Show 2-3 buses per route
- Display fare clearly on each bus card
- Show departure and arrival times

✅ **Seat Selection:**
- Show available seats with current fare
- Dynamically update total as seats selected
- Show fare breakdown (per seat × count)

✅ **Payment Page:**
- Display total amount to pay
- Show selected payment method
- For Cash on Trip: show "Pay ₹X to operator"

✅ **Confirmation:**
- Show booking reference
- Display receipt with all details
- Provide PDF download

✅ **Database:**
- All bookings stored with correct fare
- Can retrieve bookings by customer ID
- Booking data matches UI display

## Debug Information

### To enable logging:
Check browser console (F12) for:
- API responses with fare values
- FareCalculationService calculations
- Payment method selection
- Booking submission status

### To check server logs:
Look at terminal where `npm start` is running for:
- Database connection status
- API request logs
- Any error messages

## Next Actions After Testing

1. If all tests pass:
   - ✅ Fares are working correctly
   - ✅ Arrival times displaying
   - ✅ Bookings saved with correct data
   - ✅ Cash on Trip working
   - ✅ Receipts generated

2. If issues found:
   - Check troubleshooting section above
   - Review error messages
   - Contact support with details

---

**Ready to test? Start with Step 1 above!**
