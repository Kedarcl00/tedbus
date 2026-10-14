# TedBus Feature Implementation Plan

**Phase**: Feature Implementation (Phase 1 Bug Fixes Complete and Approved)  
**Worktree**: `/Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/.worktrees/tedbus-complete-upgrade`  
**Branch**: `feature/tedbus-complete-upgrade`

---

## Overview

This plan implements six new features for the TedBus application. Each feature builds on existing infrastructure identified during investigation. The features are designed to be implemented sequentially with local commits after each feature is complete.

**Key Findings from Investigation:**
- Community platform: Backend routes and models exist, frontend has partial UI - needs completion
- Notification system: Backend complete, frontend drawer exists but not integrated in navbar
- i18n: Fully implemented for English and Hindi, needs Marathi translation file
- Route planner: Does NOT exist - needs complete implementation
- Dark mode: Fully functional on frontend, needs backend sync for authenticated users
- Reviews: Does NOT exist - needs complete implementation

---

## Feature 1: Traveler Community Platform (FEAT-001)

**Status**: Partially implemented - enhance existing code

### Backend Changes

#### New Files to Create
- None (controllers and models exist)

#### Files to Modify
1. **`frontend/server/controller/community.js`**
   - Add `updatePost(req, res)` method: allows author to edit post, checks req.headers['x-user-id'] === post.authorId, validates title and body, returns 403 if non-author attempts edit
   - Add `deletePost(req, res)` method: soft delete by setting post.hidden = true, checks authorization

2. **`frontend/server/routes/community.js`**
   - Add `router.put('/api/v1/community/posts/:id', verifiedGuard, ctrl.updatePost);`
   - Add `router.delete('/api/v1/community/posts/:id', ctrl.deletePost);`

3. **`frontend/server/models/post.js`**
   - Add field: `imageUrl: { type: String }`

### Frontend Changes

#### Files to Modify
1. **`frontend/src/app/service/community.service.ts`**
   - Add `updatePost(postId: string, payload: any): Observable<Post>`
   - Add `deletePost(postId: string): Observable<any>`

2. **`frontend/src/app/Component/community/community-page/community-page.component.ts`**
   - Add `showPostForm` boolean and `togglePostForm()` method
   - Add post creation form UI in template

3. **`frontend/src/app/Component/community/community-feed/community-feed.component.ts`**
   - Add `searchTerm` and `selectedTag` properties
   - Add `filteredPosts` computed from posts array filtered by searchTerm and selectedTag
   - Add filter dropdown for tags and search input to template

4. **`frontend/src/app/Component/community/post-card/post-card.component.ts`**
   - Add `@Input() currentUserId: string`
   - Add `isAuthor` computed: `this.currentUserId === post.authorId`
   - Add `editMode` boolean and `toggleEdit()` method
   - Add edit and delete buttons with *ngIf="isAuthor"
   - Add inline edit form that appears when editMode is true
   - Add delete confirmation dialog using window.confirm() or Material dialog

#### Files to Create
5. **`frontend/src/app/Component/community/post-form/post-form.component.ts`**
   - Standalone component with template and styles
   - Form fields: title (required), body (required), tags (comma-separated input), imageUrl (optional)
   - Submit button calls communityService.createPost()
   - Uses TranslateModule for all labels

#### Translation Files
6. **`frontend/src/assets/i18n/en.json`**
   - Add keys: `COMMUNITY.POST_IMAGE`, `COMMUNITY.EDIT_POST`, `COMMUNITY.DELETE_POST`, `COMMUNITY.DELETE_CONFIRM`, `COMMUNITY.FILTER_BY_TAG`, `COMMUNITY.SEARCH_POSTS`, `COMMUNITY.POST_TITLE`, `COMMUNITY.POST_BODY`, `COMMUNITY.POST_TAGS`

7. **`frontend/src/assets/i18n/hi.json`**
   - Add same keys with Hindi translations

8. **`frontend/src/assets/i18n/mr.json`**
   - Create file by copying en.json structure (Marathi translations will be added in FEAT-003)

### Security Controls
- verifiedGuard middleware ensures only users with completed bookings can create and edit posts
- Authorization checks in updatePost and deletePost verify userId from X-User-Id header matches post.authorId
- Report functionality (already implemented) auto-hides posts when reportedBy.length >= 5

### Database Indexes
- Existing indexes on Post model are sufficient: `{ authorId: 1 }`, `{ createdAt: -1 }`

### Verification
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/.worktrees/tedbus-complete-upgrade/frontend
npm run build
# Should produce no TypeScript errors

# Manual verification:
# 1. Start backend: cd frontend/server && npm start
# 2. Start frontend: cd frontend && npm start
# 3. Sign in with Google
# 4. Navigate to /community
# 5. Verify "New Post" button appears
# 6. Create post, verify it appears in feed
# 7. Verify edit and delete buttons appear on your post
# 8. Edit post, verify changes save
# 9. Sign in as different user, verify edit/delete buttons do NOT appear
# 10. Test tag filter and search - verify filtering works
```

---

## Feature 2: Advanced Notification System (FEAT-002)

**Status**: Backend complete, frontend partial - integrate into navbar

### Backend Changes

#### Files to Modify
1. **`frontend/server/models/User.js`**
   - Add field: `notificationPreferences: { type: Object, default: { email: true, push: false, inApp: true } }`

2. **`frontend/server/index.js`**
   - Add after other route registrations (line ~60):
   ```javascript
   const notificationRoutes = require('./routes/notification');
   app.use(notificationRoutes);
   ```

3. **`frontend/server/controller/booking.js`**
   - Import notification helper: `const { createNotification } = require('../services/notification-helper');`
   - After successful booking creation (after booking.save()), add:
   ```javascript
   await createNotification(
     customerId,
     'BOOKING_CONFIRMED',
     'Booking Confirmed',
     `Your booking ${bookingReference} is confirmed for ${journeyDate}`,
     ['in-app', 'email']
   );
   ```
   - After booking cancellation, add similar notification with type 'BOOKING_CANCELLED'

#### Files to Create
4. **`frontend/server/services/notification-helper.js`**
   ```javascript
   const Notification = require('../models/notification');
   const nodemailer = require('nodemailer');
   const webpush = require('web-push');

   async function createNotification(userId, type, title, body, channels = ['in-app']) {
     for (const channel of channels) {
       if (channel === 'email') {
         if (!process.env.SMTP_HOST) {
           console.warn('SMTP not configured - skipping email notification');
           continue;
         }
         // Create in-app notification and attempt email send
         // Email sending implementation here (or queued)
       } else if (channel === 'push') {
         if (!process.env.VAPID_PUBLIC_KEY) {
           console.warn('VAPID keys not configured - skipping push notification');
           continue;
         }
         // Create in-app notification and attempt push
       }
       
       // Always create in-app notification
       await Notification.create({ userId, channel: 'in-app', type, title, body, read: false });
     }
   }

   module.exports = { createNotification };
   ```

5. **`frontend/server/README-NOTIFICATIONS.md`**
   - Document required environment variables:
     - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` for email notifications
     - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` for web push notifications
   - Explain fallback behavior: system works without these, but only in-app notifications are delivered

### Frontend Changes

#### Files to Modify
1. **`frontend/src/app/Component/navbar/navbar.component.html`**
   - After account dropdown, add notification bell icon:
   ```html
   <button *ngIf="isloggedIn" class="notification-bell" (click)="toggleNotificationDrawer()">
     <mat-icon>notifications</mat-icon>
     <span *ngIf="unreadCount > 0" class="notification-badge">{{ unreadCount }}</span>
   </button>
   ```
   - Add at end of template (for drawer):
   ```html
   <app-notification-drawer
     [isOpen]="showNotificationDrawer"
     (close)="showNotificationDrawer = false">
   </app-notification-drawer>
   ```

2. **`frontend/src/app/Component/navbar/navbar.component.ts`**
   - Import: `import { NotificationService } from '../../service/notification.service';`
   - Inject in constructor: `private notificationService: NotificationService`
   - Add properties: `showNotificationDrawer = false;`, `unreadCount = 0;`
   - In ngOnInit(), after auth check:
   ```typescript
   if (this.isloggedIn && user?._id) {
     this.notificationService.load(user._id).subscribe();
     this.notificationService.notifications$.subscribe(list => {
       this.unreadCount = list.filter(n => !n.read).length;
     });
   }
   ```
   - Add method: `toggleNotificationDrawer() { this.showNotificationDrawer = !this.showNotificationDrawer; }`

3. **`frontend/src/app/Component/navbar/navbar.component.css`**
   - Add styles for `.notification-bell`, `.notification-badge` (absolute positioned red circle with count)

4. **`frontend/src/app/app.component.ts`**
   - Import NotificationDrawerComponent in imports array

#### Translation Files
5. **Update `frontend/src/assets/i18n/en.json`, `hi.json`, `mr.json`**
   - Verify NOTIFICATIONS.* keys exist (investigation report shows they do)

### Security Controls
- Notification endpoints filter by userId from X-User-Id header
- Users can only see their own notifications

### Verification
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/.worktrees/tedbus-complete-upgrade/frontend
npm run build

# Manual verification:
# 1. Start backend (without SMTP env vars) - verify it starts and logs warning
# 2. Start frontend
# 3. Sign in
# 4. Verify bell icon appears in navbar with badge showing 0
# 5. Complete a booking
# 6. Verify badge updates to 1
# 7. Click bell, verify drawer opens showing booking notification
# 8. Click "Mark all read", verify badge returns to 0
# 9. Test GET /api/v1/notifications?userId=X returns notifications array
```

---

## Feature 3: Full Internationalization (FEAT-003)

**Status**: Partially implemented - add Marathi, apply translate pipe everywhere

### Backend Changes

#### Files to Modify
1. **`frontend/server/models/User.js`**
   - Add field: `preferredLanguage: { type: String, enum: ['en', 'hi', 'mr'], default: 'en' }`

2. **`frontend/server/routes/users.js`** or create if not exists
   - Add route: `router.put('/api/users/profile/language', ctrl.updateLanguage);`

3. **`frontend/server/controller/users.js`** or create if not exists
   - Add method:
   ```javascript
   async updateLanguage(req, res) {
     const { userId, language } = req.body;
     if (!['en', 'hi', 'mr'].includes(language)) {
       return res.status(400).json({ error: 'Invalid language' });
     }
     const user = await User.findOneAndUpdate(
       { googleId: userId },
       { preferredLanguage: language },
       { new: true }
     );
     res.json({ success: true, user });
   }
   ```

### Frontend Changes

#### Translation Files
1. **Create `frontend/src/assets/i18n/mr.json`**
   - Copy en.json structure
   - Add comment at top: `/* TODO: Add Marathi translations - currently using English placeholders */`
   - Keep all values in English for now

2. **Delete `frontend/src/assets/i18n/es.json`**

3. **Update `en.json`, `hi.json`, `mr.json`**
   - Add missing keys for booking details:
   ```json
   "BOOKING": {
     ...existing keys...,
     "DEPARTURE_TIME": "Departure Time",
     "ARRIVAL_TIME": "Arrival Time",
     "FARE": "Fare",
     "SEATS": "Seats",
     "PASSENGER_COUNT": "Passengers",
     "STATUS_CONFIRMED": "Confirmed",
     "STATUS_PENDING": "Pending",
     "STATUS_COMPLETED": "Completed",
     "STATUS_CANCELLED": "Cancelled",
     "JOURNEY_DATE": "Journey Date",
     "BOOKING_REFERENCE": "Booking Reference",
     "BUS_OPERATOR": "Bus Operator"
   }
   ```

#### Service Files
4. **Create or update `frontend/src/app/service/language.service.ts`**
   ```typescript
   import { Injectable } from '@angular/core';
   import { TranslateService } from '@ngx-translate/core';
   import { HttpClient } from '@angular/common/http';
   import { AuthService } from './auth.service';
   import { url } from '../config';

   @Injectable({ providedIn: 'root' })
   export class LanguageService {
     constructor(
       private translate: TranslateService,
       private http: HttpClient,
       private auth: AuthService
     ) {}

     setLanguage(lang: string): void {
       this.translate.use(lang);
       localStorage.setItem('tedbus_language', lang);
       
       const user = this.auth.currentUser;
       if (user?.googleId) {
         this.http.put(`${url}api/users/profile/language`, {
           userId: user.googleId,
           language: lang
         }).subscribe();
       }
     }
   }
   ```

5. **Update `frontend/src/app/service/auth.service.ts`**
   - Import TranslateService
   - In restoreSession() after setting currentUserSubject:
   ```typescript
   if (user.preferredLanguage) {
     this.translateService.use(user.preferredLanguage);
   }
   ```

#### Component Template Updates
6. **Apply translate pipe to ALL components** - audit these files:
   - `frontend/src/app/Component/landing-page/landing-page.component.html` - hero title, search labels
   - `frontend/src/app/Component/selectbus-page/selectbus-page.component.html` - bus details, filters
   - `frontend/src/app/Component/payment-page/payment-page.component.html` - payment methods, labels
   - `frontend/src/app/Component/profile-page/profile-page.component.html` - section titles
   - `frontend/src/app/Component/profile-page/my-trip/my-trip.component.html` - booking details labels (departure, arrival, fare, etc.)
   - `frontend/src/app/Component/navbar/navbar.component.html` - verify all menu items use translate pipe
   - `frontend/src/app/Component/footer/footer.component.html` if exists - all links and text

   Example transformation:
   ```html
   <!-- Before -->
   <h1>Departure Time</h1>
   
   <!-- After -->
   <h1>{{ 'BOOKING.DEPARTURE_TIME' | translate }}</h1>
   ```

7. **Update navbar language selector**
   - Modify dropdown to include three options: English (en), Hindi (hi), Marathi (mr)
   - Bind click to `languageService.setLanguage(lang)`

### Verification
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/.worktrees/tedbus-complete-upgrade/frontend
npm run build

# Manual verification:
# 1. Start backend and frontend
# 2. Change language to Hindi without signing in
# 3. Verify all visible text translates
# 4. Reload page, verify Hindi persists
# 5. Sign in with Google
# 6. Change language to Marathi
# 7. Sign out and sign in again
# 8. Verify Marathi is restored
# 9. Navigate to every page and verify all text uses translations
# 10. Check network tab for PUT /api/users/profile/language call
```

---

## Feature 4: Interactive Route Planning Tool (FEAT-004)

**Status**: Does NOT exist - create from scratch

### Backend Changes

#### Files to Create
1. **`frontend/server/models/savedRoute.js`**
   ```javascript
   const mongoose = require('mongoose');
   const { Schema } = mongoose;

   const savedRouteSchema = new Schema({
     userId: { type: String, required: true, index: true },
     name: { type: String, required: true },
     origin: {
       name: String,
       lat: Number,
       lng: Number
     },
     destination: {
       name: String,
       lat: Number,
       lng: Number
     },
     waypoints: [{
       name: String,
       lat: Number,
       lng: Number
     }],
     distance: { type: Number }, // in km
     duration: { type: Number }, // in minutes
     createdAt: { type: Date, default: Date.now }
   });

   module.exports = mongoose.model('SavedRoute', savedRouteSchema);
   ```

2. **`frontend/server/controller/routePlanner.js`**
   - Methods: getSavedRoutes, saveRoute, deleteRoute, calculateRoute
   - calculateRoute implementation:
     - Check for MAP_API_KEY in process.env
     - If missing, log warning and use Haversine formula for distance, estimate duration as distance / 60
     - If present, call Google Maps Directions API or Mapbox Directions API

3. **`frontend/server/routes/routePlanner.js`**
   ```javascript
   const express = require('express');
   const router = express.Router();
   const ctrl = require('../controller/routePlanner');

   router.get('/api/v1/route-planner/saved', ctrl.getSavedRoutes);
   router.post('/api/v1/route-planner/saved', ctrl.saveRoute);
   router.delete('/api/v1/route-planner/saved/:id', ctrl.deleteRoute);
   router.post('/api/v1/route-planner/calculate', ctrl.calculateRoute);

   module.exports = router;
   ```

4. **`frontend/server/README-MAPS.md`**
   - Document MAP_API_KEY environment variable
   - Instructions for Google Maps (enable Directions API and Places API) or Mapbox token
   - Explain fallback: mock calculation with Haversine formula, no live traffic data

#### Files to Modify
5. **`frontend/server/index.js`**
   - Add: `const routePlannerRoutes = require('./routes/routePlanner'); app.use(routePlannerRoutes);`

### Frontend Changes

#### Files to Create
1. **`frontend/src/app/service/route-planner.service.ts`**
   ```typescript
   import { Injectable } from '@angular/core';
   import { HttpClient } from '@angular/common/http';
   import { Observable } from 'rxjs';
   import { url } from '../config';

   export interface SavedRoute {
     _id: string;
     userId: string;
     name: string;
     origin: { name: string; lat: number; lng: number };
     destination: { name: string; lat: number; lng: number };
     waypoints: Array<{ name: string; lat: number; lng: number }>;
     distance: number;
     duration: number;
     createdAt: string;
   }

   @Injectable({ providedIn: 'root' })
   export class RoutePlannerService {
     private base = `${url}api/v1/route-planner`;

     constructor(private http: HttpClient) {}

     getSavedRoutes(userId: string): Observable<SavedRoute[]> {
       return this.http.get<SavedRoute[]>(`${this.base}/saved?userId=${userId}`);
     }

     saveRoute(routeData: any): Observable<SavedRoute> {
       return this.http.post<SavedRoute>(`${this.base}/saved`, routeData);
     }

     deleteRoute(routeId: string): Observable<any> {
       return this.http.delete(`${this.base}/saved/${routeId}`);
     }

     calculateRoute(origin: any, destination: any, waypoints: any[]): Observable<any> {
       return this.http.post(`${this.base}/calculate`, { origin, destination, waypoints });
     }
   }
   ```

2. **`frontend/src/app/Component/route-planner/route-planner.component.ts`**
   - Standalone component
   - Template: origin autocomplete, destination autocomplete, waypoint list with add/remove, calculate button, save button, saved routes list
   - For autocomplete: hardcode major Indian cities with lat/lng (Mumbai, Delhi, Bangalore, Pune, etc.) if no MAP_API_KEY
   - Display distance and duration after calculation
   - If MAP_API_KEY exists, embed map with route polyline (use Google Maps JS API or Mapbox GL JS)
   - If no API key, show text summary

3. **`frontend/src/app/Component/route-planner/route-planner.component.html`**
   - Form with inputs and buttons
   - Results display area
   - Saved routes list

4. **`frontend/src/app/Component/route-planner/route-planner.component.css`**
   - Layout styles

#### Files to Modify
5. **`frontend/src/app/app.routes.ts`**
   - Add: `{ path: 'route-planner', component: RoutePlannerComponent, canActivate: [authGuard] }`

6. **`frontend/src/app/Component/navbar/navbar.component.html`**
   - Add menu item in account dropdown:
   ```html
   <button (click)="navigate('/route-planner')">
     <mat-icon>map</mat-icon>
     {{ 'NAV.ROUTE_PLANNER' | translate }}
   </button>
   ```

#### Translation Files
7. **Update `en.json`, `hi.json`, `mr.json`**
   - Verify MAP.* keys exist (investigation shows they do in en.json)
   - Add NAV.ROUTE_PLANNER key

### Security Controls
- Route planner endpoints filter saved routes by userId
- authGuard protects /route-planner route

### Database Indexes
- SavedRoute model has index on userId for efficient queries

### Verification
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/.worktrees/tedbus-complete-upgrade/frontend
npm run build

# Manual verification:
# 1. Start backend without MAP_API_KEY - verify warning logged
# 2. Start frontend
# 3. Sign in
# 4. Navigate to /route-planner
# 5. Enter origin "Mumbai", destination "Pune"
# 6. Click Calculate - verify distance and duration appear (mock values)
# 7. Add waypoint "Lonavala", recalculate
# 8. Save route with name "Mumbai to Pune via Lonavala"
# 9. Verify it appears in saved routes list
# 10. Delete saved route, verify it disappears
```

---

## Feature 5: Persistent Dark Mode (FEAT-005)

**Status**: Frontend complete - add backend sync

### Backend Changes

#### Files to Modify
1. **`frontend/server/models/User.js`**
   - Add field: `theme: { type: String, enum: ['light', 'dark'], default: 'light' }`

2. **`frontend/server/routes/users.js`**
   - Add route: `router.put('/api/users/profile/theme', ctrl.updateTheme);`

3. **`frontend/server/controller/users.js`**
   - Add method:
   ```javascript
   async updateTheme(req, res) {
     const { userId, theme } = req.body;
     if (!['light', 'dark'].includes(theme)) {
       return res.status(400).json({ error: 'Invalid theme' });
     }
     const user = await User.findOneAndUpdate(
       { googleId: userId },
       { theme },
       { new: true }
     );
     res.json({ success: true, user });
   }
   ```

### Frontend Changes

#### Files to Modify
1. **`frontend/src/app/service/theme.service.ts`**
   - Import HttpClient and AuthService
   - Modify setTheme(theme) method to:
   ```typescript
   setTheme(theme: Theme): void {
     localStorage.setItem(STORAGE_KEY, theme);
     this.themeSubject.next(theme);
     this.applyTheme(theme);
     
     // Sync to backend if user is authenticated
     const user = this.authService.currentUser;
     if (user?.googleId) {
       this.http.put(`${url}api/users/profile/theme`, {
         userId: user.googleId,
         theme
       }).subscribe();
     }
   }
   ```

2. **`frontend/src/app/service/auth.service.ts`**
   - Import ThemeService
   - In restoreSession() after setting user:
   ```typescript
   if (user.theme) {
     this.themeService.setTheme(user.theme);
   }
   ```

3. **Global styles** - verify CSS variables exist
   - Check `frontend/src/styles.css` or `frontend/src/app/app.component.css`
   - Ensure .light-theme and .dark-theme classes define all color variables
   - Example variables: --color-navbar-bg, --color-text, --color-background, --color-primary, --color-border, --color-text-muted

4. **Component styles** - audit for hardcoded colors
   - Search for `background:`, `color:`, etc. in all component CSS files
   - Replace with `var(--color-*)`

### Verification
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/.worktrees/tedbus-complete-upgrade/frontend
npm run build

# Manual verification:
# 1. Toggle theme without signing in - verify dark mode works and persists in localStorage
# 2. Sign in
# 3. Toggle to dark theme
# 4. Check network tab for PUT /api/users/profile/theme call
# 5. Sign out, clear localStorage
# 6. Sign in again
# 7. Verify dark theme is applied automatically from profile
# 8. Navigate to all pages in dark mode - verify all elements render correctly
```

---

## Feature 6: Verified Post-Journey Ratings and Reviews (FEAT-006)

**Status**: Does NOT exist - create from scratch

### Backend Changes

#### Files to Create
1. **`frontend/server/models/review.js`**
   ```javascript
   const mongoose = require('mongoose');
   const { Schema } = mongoose;

   const reviewSchema = new Schema({
     userId: { type: String, required: true, index: true },
     userName: { type: String, required: true },
     routeId: { type: Schema.Types.ObjectId, ref: 'Route', required: true, index: true },
     busId: { type: Schema.Types.ObjectId, ref: 'Bus', index: true },
     bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
     rating: { type: Number, required: true, min: 1, max: 5 },
     comment: { type: String, required: true, minlength: 20 },
     helpful: { type: [String], default: [] }, // userIds
     reportedBy: { type: [String], default: [] },
     hidden: { type: Boolean, default: false },
     verified: { type: Boolean, default: false },
     createdAt: { type: Date, default: Date.now },
     updatedAt: { type: Date, default: Date.now }
   });

   reviewSchema.index({ routeId: 1, createdAt: -1 });
   reviewSchema.index({ busId: 1, createdAt: -1 });

   reviewSchema.pre('save', function(next) {
     if (this.reportedBy.length >= 5) this.hidden = true;
     this.updatedAt = new Date();
     next();
   });

   module.exports = mongoose.model('Review', reviewSchema);
   ```

2. **`frontend/server/controller/review.js`**
   - createReview: verify booking exists, booking.customerId === userId, booking.status === 'completed', booking.journeyDate < today, set verified: true if all checks pass
   - updateReview: verify userId === review.userId, review.createdAt > Date.now() - 24*3600*1000 (24h check)
   - deleteReview: verify userId === review.userId
   - getReviews: query by routeId and/or busId, paginate, sort by createdAt desc
   - voteHelpful: add userId to helpful array if not already present
   - reportReview: add userId to reportedBy array
   - getAverageRating: aggregate average of rating field for given routeId/busId
   - moderateReview: admin only, toggle hidden flag

3. **`frontend/server/routes/review.js`**
   ```javascript
   const express = require('express');
   const router = express.Router();
   const ctrl = require('../controller/review');

   router.post('/api/v1/reviews', ctrl.createReview);
   router.put('/api/v1/reviews/:id', ctrl.updateReview);
   router.delete('/api/v1/reviews/:id', ctrl.deleteReview);
   router.get('/api/v1/reviews', ctrl.getReviews);
   router.post('/api/v1/reviews/:id/helpful', ctrl.voteHelpful);
   router.post('/api/v1/reviews/:id/report', ctrl.reportReview);
   router.get('/api/v1/reviews/average', ctrl.getAverageRating);
   router.post('/api/v1/reviews/:id/moderate', ctrl.moderateReview);

   module.exports = router;
   ```

#### Files to Modify
4. **`frontend/server/index.js`**
   - Add: `const reviewRoutes = require('./routes/review'); app.use(reviewRoutes);`

5. **`frontend/server/models/User.js`** (optional)
   - Add `role: { type: String, enum: ['user', 'admin'], default: 'user' }` for moderation feature

### Frontend Changes

#### Files to Create
1. **`frontend/src/app/service/review.service.ts`**
   - HTTP methods for all review endpoints

2. **`frontend/src/app/Component/common/star-rating/star-rating.component.ts`**
   - Displays 1-5 stars
   - Input mode (clickable) and display mode (read-only)
   - Emits ratingChange event
   - Uses mat-icon: star, star_border

3. **`frontend/src/app/Component/reviews/review-form/review-form.component.ts`**
   - Star rating input (uses star-rating component)
   - Comment textarea (min 20 chars validation)
   - Booking ID selector (dropdown of user's completed bookings for this route)
   - Submit button

4. **`frontend/src/app/Component/reviews/review-list/review-list.component.ts`**
   - Displays reviews with:
     - User name
     - Verified badge (if verified === true)
     - Star rating (display mode)
     - Comment text
     - Helpful count and button
     - Report button
     - Edit button (if currentUser === review.userId and within 24h)
     - Delete button (if currentUser === review.userId)
   - Pagination controls

#### Files to Modify
5. **`frontend/src/app/Component/selectbus-page/selectbus-page.component.html`**
   - Add review section below bus details
   - Display average rating with star-rating component
   - Show review-list component
   - Show "Write a Review" button (opens review-form modal) if user is authenticated and has completed bookings

6. **`frontend/src/app/Component/selectbus-page/selectbus-page.component.ts`**
   - Inject ReviewService
   - Load reviews for current routeId and busId
   - Load average rating
   - Handle review form submission

#### Translation Files
7. **Update `en.json`, `hi.json`, `mr.json`**
   - Verify REVIEWS.* keys exist (investigation shows they do in en.json)
   - Add any missing keys: REVIEWS.MIN_CHARS, REVIEWS.SELECT_BOOKING, REVIEWS.VERIFIED_TRAVELER

### Security Controls
- createReview verifies booking ownership and completion status before allowing review
- updateReview and deleteReview verify userId matches review.userId
- 24h edit restriction enforced on backend
- Auto-hide reviews when reportedBy >= 5
- moderate endpoint checks user.role === 'admin'

### Database Indexes
- Review model has compound indexes on (routeId, createdAt) and (busId, createdAt) for efficient queries

### Verification
```bash
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/.worktrees/tedbus-complete-upgrade/frontend
npm run build

# Manual verification:
# 1. Create a completed booking in MongoDB manually or complete booking flow
# 2. Navigate to bus/route details page
# 3. Verify "Write a Review" button appears
# 4. Click button, verify review form opens
# 5. Submit review with 4 stars and 30-char comment
# 6. Verify review appears in list with verified badge
# 7. Click edit, modify review, save - verify changes persist
# 8. Use MongoDB to set createdAt to 2 days ago, reload page
# 9. Verify edit button is disabled with tooltip
# 10. Sign in as different user, verify edit/delete buttons don't appear
# 11. Click helpful, verify count increments
# 12. Test GET /api/v1/reviews/average - verify correct average
```

---

## Implementation Order and Commit Strategy

Each feature will be implemented and verified independently, with a local commit after completion:

1. **FEAT-001 (Community)** → Commit: "feat: complete community platform with edit/delete posts"
2. **FEAT-002 (Notifications)** → Commit: "feat: integrate notification system into navbar"
3. **FEAT-003 (i18n)** → Commit: "feat: add Marathi translations and complete i18n coverage"
4. **FEAT-004 (Route Planner)** → Commit: "feat: implement interactive route planning tool"
5. **FEAT-005 (Dark Mode)** → Commit: "feat: add backend sync for dark mode preference"
6. **FEAT-006 (Reviews)** → Commit: "feat: implement verified post-journey ratings and reviews"

After all features are complete, run full integration tests and create final commit: "feat: complete TedBus feature upgrade (6 features)"

---

## Notes and Constraints

- **Security**: Backend trusts X-User-Id header (known issue from investigation). Do not make this worse. Always validate userId against resource ownership.
- **Build verification**: Run `npm run build` after each feature to catch TypeScript errors early.
- **No hardcoded data**: All data must come from MongoDB. No fake bookings, users, or notifications.
- **Translation coverage**: Every user-facing string must use translate pipe by end of FEAT-003.
- **API key fallbacks**: MAP_API_KEY, SMTP, VAPID keys are optional. System must work (with degraded features) when missing.
- **Existing code**: Community and notification backends exist and are functional. Build on them, don't replace them.
- **Absolute paths**: All file paths in implementation must be absolute, starting with worktree root.

---

## End of Plan
