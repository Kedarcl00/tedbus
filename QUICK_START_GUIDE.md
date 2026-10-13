# TedBus - Quick Start Guide

## 🚀 Starting the Application

### 1. Start Backend Server
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/frontend/server
npm start
```

**Expected Output:**
```
[INFO] MongoDB connected successfully
[INFO] Server is running on port 5001
```

**URL:** http://localhost:5001

---

### 2. Start Frontend Server
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/frontend
ng serve
```

**Expected Output:**
```
Application bundle generation complete.
➜  Local:   http://localhost:4200/
```

**URL:** http://localhost:4200

---

## 🧪 Testing the Application

### Run Automated API Tests
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3
node comprehensive-test.js
```

**Expected:** 7/7 tests pass ✅

---

## 🗄️ Database Management

### Seed Database with Test Data
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/frontend/server
node seed-database.js
```

**Creates:**
- 5 routes (Mumbai→Goa, Delhi→Jaipur, etc.)
- 14 buses with various types

---

## 🧭 Testing User Flow

### 1. Login
1. Go to http://localhost:4200
2. Click "Sign in with Google"
3. Complete authentication

### 2. Search Buses
1. Fill the search form:
   - **From:** Mumbai
   - **To:** Goa
   - **Date:** Any future date (e.g., 2026-10-10)
2. Click "Search Buses"
3. **Expected:** 3 buses displayed

### 3. Book a Bus
1. Select a bus
2. Choose seats
3. Fill passenger details
4. Select payment: "Cash on Trip"
5. Click "Confirm Booking"
6. **Expected:** Success message with booking reference

### 4. View Booking
1. Click "Profile" in navbar
2. Click "Trips" in sidebar
3. **Expected:** Your booking appears in the list

---

## 📊 Available Routes

| From | To | Buses | Distance |
|------|-----|-------|----------|
| Mumbai | Goa | 3 | 580 km |
| Delhi | Jaipur | 2 | 280 km |
| Bangalore | Mysore | 3 | 150 km |
| Kolkata | Darjeeling | 3 | 620 km |
| Chennai | Pondicherry | 3 | 170 km |

---

## 🔍 API Endpoints

### Public Endpoints
- `GET /health` - Health check
- `GET /routes/:departure/:arrival/:date` - Search buses

### Authenticated Endpoints (require X-User-Id header)
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `GET /api/bookings/my` - Get user's bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/:id` - Get booking details

---

## 🛠️ Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5001 (backend)
kill -9 $(lsof -ti:5001)

# Kill process on port 4200 (frontend)
kill -9 $(lsof -ti:4200)
```

### Clear Angular Cache
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/frontend
rm -rf .angular/cache
```

### Check Server Logs
Backend logs are visible in the terminal where you ran `npm start`

Frontend logs are visible in the terminal where you ran `ng serve`

---

## 📝 Important Notes

1. **Google Sign-In:** Make sure Google OAuth is configured correctly
2. **User Isolation:** Each user can only see their own profile and bookings
3. **Payment Methods:** "Cash on Trip" and "Online" are both supported
4. **Database:** MongoDB Atlas is used, connection string in `.env` file

---

## ✅ Status Check

### Quick Health Check
```bash
# Check backend health
curl http://localhost:5001/health

# Check bus search API
curl http://localhost:5001/routes/Mumbai/Goa/2026-10-10
```

Both should return JSON responses with success status.

---

## 📖 Documentation

- **COMPLETE_VERIFICATION_SUMMARY.md** - Full verification report with all tests
- **FINAL_VERIFICATION_REPORT.md** - Detailed technical verification
- **comprehensive-test.js** - Automated test suite

---

**Application Version:** 1.0.0  
**Last Updated:** October 5, 2026  
**Status:** ✅ All Systems Working
