# 🔧 Google Sign-In Complete Fix - Exact Changes Required

## 📊 Error Analysis

### Error 1: Google OAuth 403 ❌
```
Failed to load resource: the server responded with a status of 403
[GSI_LOGGER]: The given origin is not allowed for the given client ID.
```
**CAUSE:** Google Cloud Console OAuth settings don't allow `http://localhost:4200`  
**TYPE:** Google Cloud Configuration Issue

### Error 2: Backend Connection Refused ❌
```
Failed to load resource: net::ERR_CONNECTION_REFUSED
Trying to reach: http://localhost:3001/auth/login
```
**CAUSE:** Frontend configured for port 3001, but backend runs on port 5001  
**TYPE:** Port Mismatch Configuration Issue

### Error 3: Cross-Origin-Opener-Policy ⚠️
```
Cross-Origin-Opener-Policy policy would block the window.postMessage call.
```
**CAUSE:** Browser security policy (informational warning, not blocking)  
**TYPE:** Security Policy Warning (can be ignored for now)

### Error 4: Missing Auth Routes ❌
```
Backend doesn't have /auth/login endpoint
```
**CAUSE:** Auth routes not implemented in Express backend  
**TYPE:** Missing Backend Implementation

---

## ✅ EXACT FIXES REQUIRED

---

## FIX 1: Update Frontend API URL (Port 3001 → 5001)

### File: `frontend/src/app/config/index.ts`

**CURRENT (WRONG):**
```typescript
// Backend API configuration
// Points to the Express.js backend at port 3001
export const url: string = 'http://localhost:3001/';
```

**CHANGE TO:**
```typescript
// Backend API configuration
// Points to the Express.js backend at port 5001
export const url: string = 'http://localhost:5001/';
```

**WHY:** Your backend runs on port 5001 (as shown in server/.env), not 3001.

---

## FIX 2: Update Backend CORS Configuration

### File: `frontend/server/index.js`

**CURRENT:**
```javascript
app.use(cors());
```

**CHANGE TO:**
```javascript
// CORS configuration - Allow Angular frontend to make requests
const corsOptions = {
  origin: [
    'http://localhost:4200',  // Angular dev server
    'http://localhost:3000',  // Alternative dev port
  ],
  credentials: true,           // Allow cookies and auth headers
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

**WHY:** Explicitly configure CORS to allow your Angular app and enable credentials.

---

## FIX 3: Create Auth Routes in Backend

### Create New File: `frontend/server/routes/auth.js`

```javascript
const express = require('express');
const router = express.Router();
const authController = require('../controller/auth');

// Google Sign-In login endpoint
router.post('/login', authController.loginWithGoogle);

// Logout endpoint
router.post('/logout', authController.logout);

// Get current user endpoint
router.get('/me', authController.getCurrentUser);

// Register endpoint (for future use)
router.post('/register', authController.register);

module.exports = router;
```

### Create New File: `frontend/server/controller/auth.js`

```javascript
const User = require('../models/User');
const LoggerService = require('../services/logger.service');
const logger = new LoggerService();

/**
 * Handle Google Sign-In
 * Creates new user or returns existing user
 */
exports.loginWithGoogle = async (req, res) => {
  try {
    const { googleId, name, email, picture } = req.body;

    // Validate required fields
    if (!googleId || !email) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: googleId and email'
      });
    }

    // Find existing user or create new one
    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if user exists with same email (prevent duplicate accounts)
      user = await User.findOne({ email });
      
      if (user) {
        // Update existing user with Google ID
        user.googleId = googleId;
        user.picture = picture || user.picture;
        await user.save();
        logger.info('Updated existing user with Google ID', { email });
      } else {
        // Create new user
        user = new User({
          googleId,
          name,
          email,
          picture,
          preferences: {}
        });
        await user.save();
        logger.info('Created new user via Google Sign-In', { email });
      }
    } else {
      // User exists, update last login info if needed
      user.picture = picture || user.picture;
      await user.save();
      logger.info('User logged in via Google', { email });
    }

    // Return user data (don't include sensitive fields)
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        googleId: user.googleId,
        name: user.name,
        email: user.email,
        picture: user.picture,
        preferences: user.preferences,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    logger.error('Google login failed', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
      error: error.message
    });
  }
};

/**
 * Handle user logout
 */
exports.logout = async (req, res) => {
  try {
    // In a session-based system, you would destroy the session here
    // For now, just acknowledge the logout
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout failed', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message
    });
  }
};

/**
 * Get current user (for session restoration)
 */
exports.getCurrentUser = async (req, res) => {
  try {
    // TODO: Implement session/JWT token validation
    // For now, return null (not implemented)
    res.status(200).json({
      success: true,
      user: null
    });
  } catch (error) {
    logger.error('Get current user failed', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get current user',
      error: error.message
    });
  }
};

/**
 * Handle registration (placeholder for future implementation)
 */
exports.register = async (req, res) => {
  try {
    res.status(501).json({
      success: false,
      message: 'Registration not yet implemented'
    });
  } catch (error) {
    logger.error('Registration failed', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};
```

### Update File: `frontend/server/index.js`

**ADD THIS AFTER THE EXISTING ROUTES:**
```javascript
// Import auth routes
const authRoutes = require('./routes/auth');

// Use auth routes
app.use('/auth', authRoutes);
```

**COMPLETE UPDATED SECTION:**
```javascript
const customerroutes = require('./routes/customer');
const routesroute = require('./routes/route');
const bookingroute = require('./routes/booking');
const authRoutes = require('./routes/auth');  // ADD THIS

app.use(bookingroute);
app.use(routesroute);
app.use(customerroutes);
app.use('/auth', authRoutes);  // ADD THIS
```

---

## FIX 4: Configure Google Cloud Console

### Step-by-Step Instructions

1. **Go to:** https://console.cloud.google.com/apis/credentials

2. **Sign in with:** kedarpatil966@gmail.com

3. **Find your OAuth Client ID:**
   ```
   791529522730-e08dj90ak5669aahirpe84c9ukuku8pd.apps.googleusercontent.com
   ```

4. **Click the EDIT icon (✏️)**

5. **Add to "Authorized JavaScript origins":**
   ```
   http://localhost:4200
   http://localhost:5001
   ```

6. **Add to "Authorized redirect URIs":**
   ```
   http://localhost:4200
   http://localhost:4200/auth/callback
   http://localhost:5001/auth/callback
   ```

7. **Click SAVE**

8. **Wait 60 seconds** for changes to propagate

---

## FIX 5: Optional - Add Cross-Origin-Opener-Policy Header

### File: `frontend/server/index.js`

**ADD AFTER CORS CONFIGURATION:**
```javascript
// Security headers
app.use((req, res, next) => {
  // Allow opener for Google Sign-In popup
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});
```

**COMPLETE ORDER:**
```javascript
app.use(cors(corsOptions));

// Security headers
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

app.use(bodyparser.json());
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Frontend Changes
- [ ] Update `frontend/src/app/config/index.ts` - Change port 3001 → 5001

### Backend Changes
- [ ] Update `frontend/server/index.js` - Add CORS configuration
- [ ] Update `frontend/server/index.js` - Add COOP header
- [ ] Update `frontend/server/index.js` - Register auth routes
- [ ] Create `frontend/server/routes/auth.js` - Auth routes
- [ ] Create `frontend/server/controller/auth.js` - Auth controller

### Google Cloud Console
- [ ] Go to Google Cloud Console credentials
- [ ] Edit OAuth Client ID
- [ ] Add `http://localhost:4200` to JavaScript origins
- [ ] Add `http://localhost:5001` to JavaScript origins
- [ ] Add redirect URIs
- [ ] Save and wait 60 seconds

### Testing
- [ ] Restart backend server
- [ ] Restart frontend server
- [ ] Clear browser cache
- [ ] Test Google Sign-In button

---

## 🚀 EXACT TERMINAL COMMANDS

### Stop Both Servers
Press `Ctrl+C` in both terminals

### Restart Backend
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/frontend/server
npm start
```

### Restart Frontend (New Terminal)
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/frontend
rm -rf .angular/cache
ng serve
```

### Test Backend Auth Endpoint
```bash
curl -X POST http://localhost:5001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"googleId":"test123","name":"Test User","email":"test@example.com"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "...",
    "googleId": "test123",
    "name": "Test User",
    "email": "test@example.com"
  }
}
```

---

## 🎯 ERROR MAPPING

| Error | Root Cause | Fix Number |
|-------|-----------|-----------|
| `ERR_CONNECTION_REFUSED` | Port mismatch (3001 vs 5001) | FIX 1 |
| `403 origin not allowed` | Google Cloud config | FIX 4 |
| `Cross-Origin-Opener-Policy` | Missing COOP header | FIX 5 (optional) |
| `404 /auth/login` | Missing auth routes | FIX 3 |
| CORS errors | Backend CORS not configured | FIX 2 |

---

## ✅ SUCCESS CRITERIA

After implementing all fixes, you should see:

1. ✅ No `ERR_CONNECTION_REFUSED` errors
2. ✅ No 403 errors from Google
3. ✅ Google Sign-In button appears
4. ✅ Clicking button opens Google account picker
5. ✅ After selecting account, redirected to homepage
6. ✅ Console shows: "Google Sign-In successful"
7. ✅ Account menu appears (logged in state)
8. ✅ Backend logs show: "User logged in via Google"

---

## 🐛 DEBUGGING

### If still getting 403:
- Wait 2-3 minutes after Google Cloud Console changes
- Use Incognito mode
- Check Client ID matches exactly

### If still getting connection refused:
- Verify backend is running: `curl http://localhost:5001/health`
- Check config file: `cat frontend/src/app/config/index.ts`

### If auth endpoint 404:
- Check routes are registered: Look for `app.use('/auth', authRoutes)` in index.js
- Test directly: `curl http://localhost:5001/auth/login`

---

*Complete implementation guide for Google Sign-In with exact file changes*
*Last Updated: October 5, 2026*
