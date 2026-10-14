# TedBus Complete Implementation Plan

**Worktree**: `/Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/.worktrees/tedbus-complete-upgrade`  
**Backend Port**: 5001  
**Frontend Port**: 4200

---

## PART A — FIX EXISTING TEDBUS ERRORS

### PHASE 1: Authentication and Security Fixes

- [ ] **1.1. Implement JWT Authentication System**
      
      **Problem**: Backend trusts `X-User-Id` header without validation, allowing user impersonation.
      
      **Implementation**:
      - Install `jsonwebtoken` package in backend
      - Create JWT utility: `frontend/server/utils/jwt.js` with `generateToken()` and `verifyToken()` functions
      - Update `POST /auth/login` in `frontend/server/controller/auth.js` to generate and return JWT token after Google Sign-In
      - Store JWT in frontend AuthService using `sessionStorage.setItem('auth_token', token)`
      - Update `authInterceptor` in `frontend/src/app/interceptors/auth.interceptor.ts` to inject `Authorization: Bearer <token>` header instead of `X-User-Id`
      - Create auth middleware: `frontend/server/middleware/auth.js` that validates JWT and extracts user from token, attaches to `req.user`
      - Apply auth middleware to all protected routes in `frontend/server/index.js` and individual route files
      
      **Files**:
      - Create: `frontend/server/utils/jwt.js`
      - Create: `frontend/server/middleware/auth.js`
      - Modify: `frontend/server/controller/auth.js` (lines 23-76)
      - Modify: `frontend/src/app/service/auth.service.ts` (add token storage methods)
      - Modify: `frontend/src/app/interceptors/auth.interceptor.ts` (change header injection)
      - Modify: `frontend/server/controller/booking.js` (replace `req.headers['x-user-id']` with `req.user.googleId`)
      - Modify: `frontend/server/controller/users.js` (replace `req.headers['x-user-id']` with `req.user.googleId`)
      - Modify: `frontend/server/middleware/verifiedGuard.js` (use `req.user.id` instead of `req.body.userId`)
      
      **Verification**: 
      - Start backend: `cd frontend/server && npm start`
      - Start frontend: `cd frontend && npm start`
      - Test: Sign in with Google, verify JWT token in sessionStorage
      - Test: Access `/api/users/profile`, verify 401 without token, 200 with valid token
      - Test: Try to access another user's booking with manipulated JWT, verify 403

- [ ] **1.2. Implement Session Restoration**
      
      **Problem**: `GET /auth/me` returns null, users must re-login on page refresh.
      
      **Implementation**:
      - Update `GET /auth/me` in `frontend/server/controller/auth.js` to validate JWT from `Authorization` header
      - Extract user ID from JWT, fetch user from database, return user object
      - Create `AuthService.restoreSession()` method in frontend that calls `/auth/me` on app initialization
      - Call `restoreSession()` from `AppComponent.ngOnInit()`
      - Handle 401 errors by clearing invalid tokens
      
      **Files**:
      - Modify: `frontend/server/controller/auth.js` (implement getCurrentUser method)
      - Modify: `frontend/src/app/service/auth.service.ts` (add restoreSession method)
      - Modify: `frontend/src/app/app.component.ts` (call restoreSession in ngOnInit)
      
      **Verification**:
      - Sign in with Google
      - Refresh page (F5)
      - Verify user remains logged in and profile loads correctly
      - Verify authGuard still protects routes after refresh

- [ ] **1.3. Fix Logout Flow**
      
      **Problem**: Logout doesn't properly clean up state.
      
      **Implementation**:
      - Update `AuthService.logout()` to remove JWT token from sessionStorage
      - Update `NavbarComponent.handleLogout()` to clear all auth state
      - Add logout to `AuthAPIService` if not present
      - Ensure Google Sign-In state is cleared (call `google.accounts.id.disableAutoSelect()`)
      
      **Files**:
      - Modify: `frontend/src/app/service/auth.service.ts` (logout method)
      - Modify: `frontend/src/app/Component/navbar/navbar.component.ts` (handleLogout method, lines 171-189)
      
      **Verification**:
      - Sign in, then sign out
      - Verify sessionStorage is cleared
      - Verify protected routes redirect to home
      - Verify Google Sign-In button reappears

---

### PHASE 2: Navigation and Routing Fixes

- [ ] **2.1. Create Dedicated My Trips / Booking History Route**
      
      **Problem**: No dedicated booking history route; navbar bus icon has no navigation.
      
      **Implementation**:
      - Create new component: `frontend/src/app/Component/booking-history/booking-history-page.component.ts`
      - Reuse existing `MyTripComponent` inside this new page component
      - Add page header with title "My Bookings" and subtitle "View and manage your bus tickets"
      - Add route to `frontend/src/app/app.routes.ts`: `{ path: 'my-trips', component: BookingHistoryPageComponent, canActivate: [authGuard] }`
      - Update navbar bus icon in `frontend/src/app/Component/navbar/navbar.component.html` (line 30): Add `[routerLink]="['/my-trips']"` and `routerLinkActive="active"`
      - Update Account menu "My Trips" button (line 58) to `(click)="navigate('/my-trips')"`
      
      **Files**:
      - Create: `frontend/src/app/Component/booking-history/booking-history-page.component.ts`
      - Create: `frontend/src/app/Component/booking-history/booking-history-page.component.html`
      - Create: `frontend/src/app/Component/booking-history/booking-history-page.component.css`
      - Modify: `frontend/src/app/app.routes.ts` (add new route)
      - Modify: `frontend/src/app/Component/navbar/navbar.component.html` (lines 30-35, line 58)
      
      **Verification**:
      - Click bus icon in navbar → should navigate to `/my-trips`
      - Click "My Trips" in account menu → should navigate to `/my-trips`
      - Verify page shows header "My Bookings"
      - Verify bookings load correctly
      - Verify authGuard protects the route

- [ ] **2.2. Enhance Navbar with Accessible Labels**
      
      **Problem**: Bus icon lacks accessible label and proper semantics.
      
      **Implementation**:
      - Add `aria-label="My Trips"` to bus icon link
      - Add `title="My Trips"` for tooltip
      - Change from `<a>` to Angular router link with proper keyboard navigation
      
      **Files**:
      - Modify: `frontend/src/app/Component/navbar/navbar.component.html` (lines 30-35)
      
      **Verification**:
      - Tab to bus icon with keyboard, verify focus visible
      - Press Enter, verify navigation works
      - Hover over icon, verify tooltip appears

---

### PHASE 3: Booking History Display Improvements

- [ ] **3.1. Implement Current/Upcoming vs Completed Booking Classification**
      
      **Problem**: All bookings displayed in single list without separation.
      
      **Implementation**:
      - Update `MyTripComponent` in `frontend/src/app/Component/profile-page/my-trip/my-trip.component.ts`
      - Add properties: `currentBookings: BookingResponse[]` and `completedBookings: BookingResponse[]`
      - In `loadBookings()` subscription, classify bookings:
        ```typescript
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        this.currentBookings = bookings.filter(b => 
          b.status !== 'completed' && b.status !== 'cancelled' && 
          new Date(b.journeyDate || b.departureDate) >= today
        );
        this.completedBookings = bookings.filter(b => 
          b.status === 'completed' || 
          (b.status === 'cancelled') ||
          new Date(b.journeyDate || b.departureDate) < today
        );
        ```
      - Update template `my-trip.component.html` to add two sections with headers
      - Add section tabs or accordions for Current/Upcoming and Completed
      
      **Files**:
      - Modify: `frontend/src/app/Component/profile-page/my-trip/my-trip.component.ts` (add classification logic)
      - Modify: `frontend/src/app/Component/profile-page/my-trip/my-trip.component.html` (add section headers, split lists)
      - Modify: `frontend/src/app/Component/profile-page/my-trip/my-trip.component.css` (add section styles)
      
      **Verification**:
      - Create test bookings with past and future dates
      - Verify current bookings show under "Current & Upcoming Bookings"
      - Verify completed bookings show under "Completed Rides"
      - Verify cancelled bookings appear in completed section

- [ ] **3.2. Fix Booking Card Alignment and Responsive Layout**
      
      **Problem**: Potential alignment issues in booking cards on different screen sizes.
      
      **Investigation Finding**: CSS looks correct but may have parent container issues.
      
      **Implementation**:
      - Verify ProfilePageComponent CSS doesn't constrain MyTripComponent width
      - Add responsive breakpoints in `my-trip.component.css` for mobile, tablet, desktop
      - Test flexbox layout with different content lengths
      - Add max-width constraints to prevent overly wide cards
      - Ensure consistent spacing between cards with margin-bottom
      - Add page header with proper alignment
      
      **Files**:
      - Modify: `frontend/src/app/Component/profile-page/my-trip/my-trip.component.css` (add/fix responsive styles)
      - Modify: `frontend/src/app/Component/profile-page/profile-page.component.css` (ensure parent doesn't constrain)
      - Create: Header section in booking history page component
      
      **Verification**:
      - Test on desktop (1920px, 1440px, 1024px)
      - Test on tablet (768px)
      - Test on mobile (375px, 320px)
      - Verify no horizontal scrolling
      - Verify cards align consistently
      - Verify text doesn't overflow or clip

- [ ] **3.3. Add Empty State and Loading Improvements**
      
      **Problem**: Basic empty states need enhancement.
      
      **Implementation**:
      - Create better empty state with illustration and CTA
      - Add skeleton loading cards during data fetch
      - Improve error messages with retry button
      - Add empty states for both current and completed sections separately
      
      **Files**:
      - Modify: `frontend/src/app/Component/profile-page/my-trip/my-trip.component.html` (enhance empty/loading states)
      - Modify: `frontend/src/app/Component/profile-page/my-trip/my-trip.component.css` (add skeleton and empty state styles)
      
      **Verification**:
      - Sign in with new account (no bookings) → verify empty state
      - Throttle network → verify loading skeleton
      - Force API error → verify error message with retry button

---

### PHASE 4: Profile Page Enhancements

- [ ] **4.1. Ensure Profile Data Loads Correctly**
      
      **Current Status**: Already implemented correctly in `ProfilePageComponent`.
      
      **Validation Only**:
      - Verify `GET /api/users/profile` returns correct data structure
      - Verify loading state works
      - Verify error handling displays correctly
      
      **Files**:
      - Test: `frontend/src/app/Component/profile-page/profile-page.component.ts`
      
      **Verification**:
      - Navigate to `/profile`
      - Verify name, email display correctly
      - Verify dateOfBirth, gender, phone display (or "Not set")
      - Test with missing profile fields

- [ ] **4.2. Add Profile Edit Functionality**
      
      **Problem**: Profile is read-only.
      
      **Implementation**:
      - Add "Edit Profile" button in profile section
      - Create edit mode with inline form fields
      - Call `PUT /api/users/profile` on save
      - Add form validation (email format, phone format, date validation)
      - Show success/error messages
      
      **Files**:
      - Modify: `frontend/src/app/Component/profile-page/profile-page.component.ts` (add edit mode, save method)
      - Modify: `frontend/src/app/Component/profile-page/profile-page.component.html` (add edit form)
      - Modify: `frontend/src/app/service/customer.service.ts` (add updateProfile method)
      
      **Verification**:
      - Click "Edit Profile"
      - Update name, phone, DOB
      - Click "Save"
      - Verify success message
      - Refresh page, verify changes persisted

---

## PART B — NEW FEATURE IMPLEMENTATIONS

### PHASE 5: Complete Traveler Community Platform

- [ ] **5.1. Verify and Test Existing Community Features**
      
      **Current Status**: Backend and basic frontend implemented.
      
      **Tasks**:
      - Test post creation flow with verifiedGuard
      - Test like, share, report functionality
      - Test comment creation
      - Test forum topics
      - Fix any bugs discovered
      
      **Files**:
      - Test: All community components
      - Test: `POST /api/v1/community/posts` with verified and unverified users
      
      **Verification**:
      - Sign in with user who has completed booking
      - Navigate to `/community`
      - Create a post → should succeed
      - Sign in with new user (no bookings)
      - Try to create post → should show error "Only verified travelers can post"
      - Like, comment, share existing posts → should work

- [ ] **5.2. Add User Profile Integration to Community**
      
      **Problem**: Posts show `authorName` as string, no profile pictures or user links.
      
      **Implementation**:
      - Update Post model to include `authorPicture` field
      - Update `POST /api/v1/community/posts` controller to populate author picture from User model
      - Update `post-card` component to display user avatar
      - Add clickable user name that shows user profile or stats
      
      **Files**:
      - Modify: `frontend/server/models/post.js` (add authorPicture field)
      - Modify: `frontend/server/controller/community.js` (populate authorPicture)
      - Modify: `frontend/src/app/Component/community/post-card/*` (add avatar display)
      
      **Verification**:
      - Create post
      - Verify Google profile picture appears next to post
      - Click username → verify some user info displays

- [ ] **5.3. Add Post Edit/Delete Functionality**
      
      **Problem**: Users can't edit or delete their own posts.
      
      **Implementation**:
      - Add `PUT /api/v1/community/posts/:id` endpoint for editing (author only)
      - Add `DELETE /api/v1/community/posts/:id` endpoint for deletion (author or moderator)
      - Add edit/delete buttons to post-card component (visible only to post author)
      - Add edit time limit (24 hours after creation)
      - Add confirmation dialog for deletion
      
      **Files**:
      - Modify: `frontend/server/routes/community.js` (add PUT and DELETE routes)
      - Modify: `frontend/server/controller/community.js` (add update and delete methods)
      - Modify: `frontend/src/app/service/community.service.ts` (add update/delete methods)
      - Modify: `frontend/src/app/Component/community/post-card/*` (add edit/delete UI)
      
      **Verification**:
      - Create post as user A
      - Verify edit/delete buttons visible
      - Edit post within 24 hours → should succeed
      - Wait 24 hours (or mock time) → edit button should be disabled
      - Delete post → confirm dialog → post removed

- [ ] **5.4. Add Image Upload for Posts**
      
      **Problem**: Posts are text-only.
      
      **Implementation**:
      - Add `multer` middleware for file uploads in backend
      - Add `images: [String]` field to Post model (store URLs or base64)
      - Update `POST /api/v1/community/posts` to handle multipart/form-data
      - Add image upload UI in community-feed component
      - Add image preview and removal before posting
      - Validate image size (max 5MB) and format (jpg, png, gif)
      
      **Files**:
      - Install: `npm install multer` in backend
      - Create: `frontend/server/middleware/upload.js` (multer config)
      - Modify: `frontend/server/models/post.js` (add images field)
      - Modify: `frontend/server/controller/community.js` (handle file uploads)
      - Modify: `frontend/src/app/Component/community/community-feed/*` (add upload UI)
      
      **Verification**:
      - Create post with 1-3 images
      - Verify images display in feed
      - Try to upload 10MB file → verify error message

---

### PHASE 6: Complete Notification System

- [ ] **6.1. Add Notification Drawer to Navbar**
      
      **Problem**: Notification drawer exists but not integrated in navbar.
      
      **Implementation**:
      - Add bell icon button to navbar with unread count badge
      - Integrate `notification-drawer.component.ts` as Material drawer/sidenav
      - Load notifications on drawer open using `NotificationService.load(userId)`
      - Add "Mark all as read" button
      - Style notification list with timestamps and icons
      - Add click handler to mark individual notification as read
      
      **Files**:
      - Modify: `frontend/src/app/Component/navbar/navbar.component.html` (add bell icon with badge)
      - Modify: `frontend/src/app/Component/navbar/navbar.component.ts` (add drawer toggle, notification count)
      - Create: `frontend/src/app/Component/notification-drawer/notification-drawer.component.html` (if missing)
      - Create: `frontend/src/app/Component/notification-drawer/notification-drawer.component.css` (if missing)
      - Modify: `frontend/src/app/service/notification.service.ts` (ensure load method uses correct API)
      
      **Verification**:
      - Sign in
      - Click bell icon → drawer opens
      - Verify notifications load (create test notification via backend if needed)
      - Click "Mark all as read" → badge count goes to 0
      - Refresh page → badge count persists correctly

- [ ] **6.2. Add Automatic Booking Notifications**
      
      **Problem**: No automatic notifications for booking events.
      
      **Implementation**:
      - Update `POST /api/bookings` controller to create notification after booking creation
      - Add notification on booking confirmation
      - Add notification on booking cancellation
      - Add notification 24 hours before journey (requires cron job or worker)
      
      **Files**:
      - Modify: `frontend/server/controller/booking.js` (add notification creation after booking)
      - Modify: `frontend/server/controller/notification.js` (verify createNotification method exists)
      - Optional: Create: `frontend/server/workers/booking-reminders.js` (cron job for reminders)
      
      **Verification**:
      - Create a booking
      - Check notifications drawer → verify "Booking confirmed" notification appears
      - Cancel a booking → verify "Booking cancelled" notification appears

- [ ] **6.3. Configure Email Notifications (Optional)**
      
      **Problem**: Nodemailer installed but not configured.
      
      **Implementation** (if user has SMTP credentials):
      - Add SMTP configuration to `.env` (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
      - Create email service: `frontend/server/services/email.service.js` using nodemailer
      - Add email templates for booking confirmation, cancellation, reminder
      - Update notification creation to trigger email for 'email' channel
      
      **Files**:
      - Create: `frontend/server/services/email.service.js`
      - Create: `frontend/server/templates/email/` (HTML email templates)
      - Modify: `frontend/server/controller/notification.js` (trigger email sending)
      
      **Verification** (requires SMTP credentials):
      - Set SMTP env vars
      - Create booking
      - Check email inbox for confirmation email

---

### PHASE 7: Ratings and Reviews System

- [ ] **7.1. Create Review Model and API**
      
      **Problem**: No review system exists.
      
      **Implementation**:
      - Create model: `frontend/server/models/review.js` with schema:
        ```javascript
        {
          userId: ObjectId (ref: User),
          routeId: ObjectId (ref: Route),
          bookingId: ObjectId (ref: Booking), // For verification
          rating: Number (1-5),
          title: String,
          comment: String (min 20 chars),
          helpful: [String], // User IDs who marked helpful
          verified: Boolean, // true if user completed this route
          editedAt: Date,
          createdAt: Date
        }
        ```
      - Create routes: `frontend/server/routes/review.js`
        - `POST /api/reviews` - Create review (requires completed booking on route)
        - `GET /api/reviews?routeId=xxx` - Get reviews for route
        - `PUT /api/reviews/:id` - Update own review (within 24 hours)
        - `POST /api/reviews/:id/helpful` - Mark review as helpful
        - `POST /api/reviews/:id/report` - Report inappropriate review
      - Create controller: `frontend/server/controller/review.js`
      - Add review submission guard: verify user completed booking on this route
      
      **Files**:
      - Create: `frontend/server/models/review.js`
      - Create: `frontend/server/routes/review.js`
      - Create: `frontend/server/controller/review.js`
      - Modify: `frontend/server/index.js` (register review routes)
      
      **Verification**:
      - `POST /api/reviews` with valid booking → 201 Created
      - `POST /api/reviews` without booking on route → 403 Forbidden
      - `GET /api/reviews?routeId=xxx` → returns review list

- [ ] **7.2. Create Review Component and UI**
      
      **Problem**: No review UI exists.
      
      **Implementation**:
      - Create component: `frontend/src/app/Component/review/review-list/review-list.component.ts`
      - Create component: `frontend/src/app/Component/review/review-form/review-form.component.ts`
      - Create service: `frontend/src/app/service/review.service.ts`
      - Add star rating component (or use Material rating)
      - Add review list to bus/route detail pages
      - Add "Write Review" button (visible only to users who completed this route)
      - Show verified badge for reviews from verified travelers
      - Add helpful vote button
      - Add average rating display
      
      **Files**:
      - Create: `frontend/src/app/Component/review/review-list/*`
      - Create: `frontend/src/app/Component/review/review-form/*`
      - Create: `frontend/src/app/service/review.service.ts`
      - Modify: `frontend/src/app/Component/selectbus-page/*` (add review section)
      
      **Verification**:
      - View bus/route page → see existing reviews
      - Complete a booking on route
      - Click "Write Review"
      - Submit 5-star review with comment
      - Verify review appears with "Verified Traveler" badge
      - Click "Helpful" on another review → count increments

- [ ] **7.3. Add Review Moderation**
      
      **Problem**: No moderation for inappropriate reviews.
      
      **Implementation**:
      - Add `hidden` boolean field to Review model
      - Add `reportCount` field to track reports
      - Auto-hide reviews with 5+ reports
      - Add admin moderation endpoint (future: admin dashboard)
      - Log moderation actions to ModerationLog model
      
      **Files**:
      - Modify: `frontend/server/models/review.js` (add hidden, reportCount)
      - Modify: `frontend/server/controller/review.js` (add auto-hide logic in report handler)
      - Create: `POST /api/reviews/:id/moderate` endpoint (admin only)
      
      **Verification**:
      - Report a review 5 times (from different accounts) → review auto-hides
      - Verify hidden reviews don't appear in `GET /api/reviews` for regular users

---

### PHASE 8: Route Planning Tool (NEW FEATURE)

- [ ] **8.1. Set Up Map Service Integration**
      
      **Problem**: No map integration exists.
      
      **Decision**: Use OpenStreetMap with Leaflet (free) or Google Maps API (requires API key).
      
      **Implementation**:
      - Install Leaflet: `npm install leaflet @types/leaflet` (or `@angular/google-maps` for Google Maps)
      - Create service: `frontend/src/app/service/map.service.ts`
      - Add map config to `environment.ts` (API keys if needed)
      
      **Files**:
      - Install: `npm install leaflet @types/leaflet` in frontend
      - Create: `frontend/src/app/service/map.service.ts`
      - Modify: `frontend/angular.json` (add leaflet CSS to styles array)
      
      **Verification**:
      - Ensure leaflet or google-maps package installed
      - Verify API key set (if using Google Maps)

- [ ] **8.2. Create Route Planner Component**
      
      **Problem**: No route planner UI.
      
      **Implementation**:
      - Create component: `frontend/src/app/Component/route-planner/route-planner-page.component.ts`
      - Add route to `app.routes.ts`: `{ path: 'route-planner', component: RoutePlannerPageComponent }`
      - Add map view with Leaflet or Google Maps
      - Add origin and destination input fields with autocomplete
      - Add "Add Waypoint" button for multi-stop routes
      - Add "Calculate Route" button
      - Display route on map with markers
      - Show distance, duration, and estimated travel time
      - Add "Save Route" button (save to user's saved routes)
      
      **Files**:
      - Create: `frontend/src/app/Component/route-planner/route-planner-page.component.ts`
      - Create: `frontend/src/app/Component/route-planner/route-planner-page.component.html`
      - Create: `frontend/src/app/Component/route-planner/route-planner-page.component.css`
      - Modify: `frontend/src/app/app.routes.ts` (add route)
      
      **Verification**:
      - Navigate to `/route-planner`
      - Enter "Mumbai" as origin, "Pune" as destination
      - Click "Calculate Route"
      - Verify route displays on map with distance and duration

- [ ] **8.3. Create Saved Routes Backend**
      
      **Problem**: No backend for saved routes.
      
      **Implementation**:
      - Create model: `frontend/server/models/savedRoute.js` with schema:
        ```javascript
        {
          userId: ObjectId (ref: User),
          name: String,
          origin: { name, lat, lng },
          destination: { name, lat, lng },
          waypoints: [{ name, lat, lng }],
          distance: Number,
          duration: Number,
          createdAt: Date
        }
        ```
      - Create routes: `frontend/server/routes/savedRoute.js`
        - `POST /api/saved-routes` - Save route
        - `GET /api/saved-routes` - Get user's saved routes
        - `DELETE /api/saved-routes/:id` - Delete saved route
      - Create controller: `frontend/server/controller/savedRoute.js`
      
      **Files**:
      - Create: `frontend/server/models/savedRoute.js`
      - Create: `frontend/server/routes/savedRoute.js`
      - Create: `frontend/server/controller/savedRoute.js`
      - Modify: `frontend/server/index.js` (register routes)
      
      **Verification**:
      - Calculate a route
      - Click "Save Route"
      - Navigate to "My Saved Routes" → verify route appears
      - Delete route → verify removed from list

- [ ] **8.4. Add Traffic and Congestion Data (Optional)**
      
      **Problem**: No real-time traffic data.
      
      **Implementation** (requires Google Maps API):
      - Enable Google Maps Directions API with traffic model
      - Add traffic layer to map
      - Display traffic delay in route calculation
      - Show alternative routes with traffic comparison
      
      **Files**:
      - Modify: `frontend/src/app/service/map.service.ts` (add traffic API calls)
      - Modify: Route planner component (display traffic info)
      
      **Verification** (requires API key):
      - Calculate route
      - Verify traffic layer visible on map
      - Verify duration includes traffic delay

---

### PHASE 9: Additional Enhancements

- [ ] **9.1. Add Booking Cancellation with Refund**
      
      **Current Status**: Cancel button exists in UI but backend endpoint missing.
      
      **Implementation**:
      - Create `POST /api/bookings/:id/cancel` endpoint
      - Calculate refund amount based on cancellation time before journey
      - Update booking status to 'cancelled'
      - Update paymentStatus based on refund
      - Create notification for cancellation
      - Return refund amount to frontend
      
      **Files**:
      - Modify: `frontend/server/routes/booking.js` (add cancel route)
      - Modify: `frontend/server/controller/booking.js` (add cancel method with refund calculation)
      - Verify: `frontend/src/app/service/booking.service.ts` has `cancelBooking()` method
      
      **Verification**:
      - Create booking
      - Click "Cancel Booking" in My Trips
      - Confirm cancellation
      - Verify success message shows refund amount
      - Verify booking status changes to 'cancelled'
      - Verify notification appears

- [ ] **9.2. Add Booking PDF/Ticket Export**
      
      **Problem**: No way to download or print tickets.
      
      **Implementation**:
      - Frontend already has `jspdf` and `qrcode` installed
      - Create `BookingService.downloadTicket(bookingId)` method
      - Generate PDF with booking details, QR code with booking reference
      - Add "Download Ticket" button in My Trips
      - Include bus details, passenger info, departure/arrival times, seat numbers
      
      **Files**:
      - Modify: `frontend/src/app/service/booking.service.ts` (add downloadTicket method)
      - Modify: `frontend/src/app/Component/profile-page/my-trip/my-trip.component.html` (add download button)
      - Modify: `frontend/src/app/Component/profile-page/my-trip/my-trip.component.ts` (add download handler)
      
      **Verification**:
      - Create booking
      - Click "Download Ticket" in My Trips
      - Verify PDF downloads with booking details and QR code
      - Scan QR code → verify contains booking reference

- [ ] **9.3. Add Rate Limiting Middleware**
      
      **Problem**: No rate limiting, vulnerable to API abuse.
      
      **Implementation**:
      - Install `express-rate-limit`: `npm install express-rate-limit`
      - Create rate limit config: 100 requests per 15 minutes per IP
      - Apply to all API routes
      - Add stricter limits for sensitive endpoints (login, signup)
      
      **Files**:
      - Install: `npm install express-rate-limit` in backend
      - Create: `frontend/server/middleware/rateLimiter.js`
      - Modify: `frontend/server/index.js` (apply rate limiter)
      
      **Verification**:
      - Make 101 requests in 15 minutes → verify 429 Too Many Requests

- [ ] **9.4. Add Environment Variable Documentation**
      
      **Problem**: No `.env.example` file for setup guidance.
      
      **Implementation**:
      - Create `.env.example` file with all required variables
      - Document each variable with comment
      - Add setup instructions to README
      
      **Files**:
      - Create: `frontend/server/.env.example`
      - Modify: `README.md` (add environment setup section)
      
      **Content**:
      ```bash
      # MongoDB Connection String (required)
      MONGODB_URI=mongodb://localhost:27017/tedbus
      
      # Server Port (default: 5001)
      PORT=5001
      
      # Environment Mode (development/production)
      NODE_ENV=development
      
      # JWT Secret for Token Signing (required)
      JWT_SECRET=your-secret-key-here-change-in-production
      
      # SMTP Configuration (optional, for email notifications)
      SMTP_HOST=smtp.gmail.com
      SMTP_PORT=587
      SMTP_USER=your-email@gmail.com
      SMTP_PASS=your-app-password
      
      # Google Maps API Key (optional, for route planner)
      GOOGLE_MAPS_API_KEY=your-api-key-here
      ```
      
      **Verification**:
      - Clone project to new directory
      - Follow `.env.example` → verify server starts successfully

---

## VERIFICATION AND TESTING

### Final Verification Steps

1. **Authentication Flow**:
   - [ ] Sign in with Google → JWT token stored
   - [ ] Refresh page → user remains logged in
   - [ ] Access `/profile` without token → redirected to home
   - [ ] Sign out → token cleared, protected routes inaccessible

2. **Navigation**:
   - [ ] Click navbar bus icon → navigates to `/my-trips`
   - [ ] Click "My Trips" in account menu → navigates to `/my-trips`
   - [ ] All navbar links work correctly

3. **Booking History**:
   - [ ] My Trips page shows header "My Bookings"
   - [ ] Bookings separated into Current/Upcoming and Completed sections
   - [ ] Booking cards aligned consistently on desktop, tablet, mobile
   - [ ] Empty state displays when no bookings
   - [ ] Loading state shows skeleton cards
   - [ ] Error state shows retry button

4. **Profile**:
   - [ ] Profile displays user data (name, email, DOB, gender, phone)
   - [ ] Edit profile works
   - [ ] Profile → My Trips navigation works
   - [ ] Wallet section shows "coming soon" placeholder

5. **Community**:
   - [ ] Navigate to `/community`
   - [ ] Verified travelers can create posts
   - [ ] Unverified travelers see error on post creation
   - [ ] Like, comment, share work
   - [ ] Post edit/delete works for own posts
   - [ ] Image upload works

6. **Notifications**:
   - [ ] Bell icon in navbar shows unread count
   - [ ] Click bell → drawer opens with notification list
   - [ ] Mark all as read → badge count goes to 0
   - [ ] Booking creates notification

7. **Reviews**:
   - [ ] Complete booking on route
   - [ ] Navigate to route page → see "Write Review" button
   - [ ] Submit review with rating and comment
   - [ ] Review appears with "Verified Traveler" badge
   - [ ] Helpful vote works

8. **Route Planner**:
   - [ ] Navigate to `/route-planner`
   - [ ] Enter origin and destination
   - [ ] Calculate route → map displays route with distance/duration
   - [ ] Save route → appears in saved routes list

9. **Internationalization**:
   - [ ] Switch language to Spanish → UI updates
   - [ ] Switch language to Hindi → UI updates
   - [ ] Switch back to English → UI updates

10. **Dark Mode**:
    - [ ] Toggle dark mode → theme changes
    - [ ] Refresh page → theme persists

### Test Commands

```bash
# Frontend tests
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/.worktrees/tedbus-complete-upgrade/frontend
npm test

# Backend tests
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/.worktrees/tedbus-complete-upgrade/frontend/server
npm test

# Start backend (port 5001)
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/.worktrees/tedbus-complete-upgrade/frontend/server
npm start

# Start frontend (port 4200)
cd /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/.worktrees/tedbus-complete-upgrade/frontend
npm start
```

---

## PRIORITY ORDERING

**Critical (Must Fix)**:
1. Phase 1.1 - JWT Authentication (SECURITY RISK)
2. Phase 2.1 - Fix navbar bus icon navigation
3. Phase 3.1 - Booking classification (current vs completed)

**High Priority**:
4. Phase 1.2 - Session restoration
5. Phase 3.2 - Booking card alignment fixes
6. Phase 5.1-5.3 - Complete community platform
7. Phase 6.1-6.2 - Complete notification system

**Medium Priority**:
8. Phase 7.1-7.3 - Ratings and reviews
9. Phase 4.2 - Profile editing
10. Phase 9.1 - Booking cancellation
11. Phase 9.2 - PDF ticket export

**Low Priority (Enhancement)**:
12. Phase 8.1-8.4 - Route planning tool
13. Phase 9.3 - Rate limiting
14. Phase 5.4 - Image upload for posts
15. Phase 6.3 - Email notifications
16. Phase 8.4 - Traffic data

---

**END OF IMPLEMENTATION PLAN**
