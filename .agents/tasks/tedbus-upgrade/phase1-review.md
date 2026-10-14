# Phase 1 Authentication and Booking History Fixes

Phase 1 addressed authentication state management, booking history layout, navbar navigation, and My Trips data fetching. The implementation restores session on app init, wraps router navigation in Angular zones, adds token injection via HTTP interceptor, implements 401 error handling with automatic logout and redirect, separates current from completed bookings by journey date, and links the navbar bus icon to `/my-trips`. The backend already enforces user isolation by validating `X-User-Id` headers against database records. A production build completed successfully at 13:35 on 2024-10-13.

**Watch for:** Booking date classification uses client-side timezone and may misclassify trips near midnight when client and server are in different zones (likely); guard still performs synchronous sessionStorage check allowing brief window where stale session passes guard before first API 401 (likely); no backend validation that journey date exists before classifying bookings (possible).

**Verdict**: APPROVED

## High-level view

Authentication now includes a `restoreSession()` call on app init that loads user data from sessionStorage, a `getGoogleIdForHeaderInjection()` method that the interceptor uses to attach `X-User-Id` headers, and a 401 response handler in the interceptor that clears session and redirects to home. The logout flow no longer wipes all sessionStorage — it removes only `USER_DATA_KEY` and `GOOGLE_ID_KEY`, preserving theme and language preferences. The guard validates that `currentUser.googleId` and `currentUser.email` exist before allowing route activation, preventing partial session data from passing the guard.

Booking history displays two separate sections: Current & Upcoming Bookings, and Completed Rides. The `classifyBookings()` method compares `journeyDate` parsed as `new Date()` against `today.setHours(0,0,0,0)` in the browser's timezone. Bookings with `status === 'completed'` or `status === 'cancelled'` always land in Completed Rides regardless of date. The template duplicates the booking card structure for both sections.

The navbar bus icon now uses `[routerLink]="['/my-trips']"` when `isloggedIn` is true, with `aria-label="My Trips"` for accessibility. The route `/my-trips` was added to `app.routes.ts` pointing to `MyTripComponent` with `authGuard`. The account dropdown menu's "My Trips" button calls `navigate('/my-trips')` wrapped in `ngZone.run()`.

The production build at 13:35 produced `dist/frontend/browser/` output with no TypeScript errors. Angular bundle size limits were raised to `maximumError: "2mb"` for initial bundles and `maximumError: "10kb"` for component styles to accommodate the expanded CSS in `my-trip.component.css`.

<details>
<summary>Issues (2)</summary>

1. **Booking classification timezone mismatch** — `classifyBookings()` parses journey dates in the browser's local timezone. A booking with `journeyDate: "2024-10-13"` will be parsed as `2024-10-13T00:00:00` in the client's timezone, but the server may have stored it in UTC or a different zone. If client is UTC-5 and server is UTC, a booking scheduled for "today" server-time may appear as "yesterday" client-time near midnight, causing it to land in Completed Rides when it should be in Current & Upcoming. Prefer server-side classification (add a `journeyStatus` field computed on the backend) or store dates as UTC timestamps with explicit timezone handling on the frontend.

2. **Guard synchronous check creates brief vulnerability window** — The guard calls `auth.getCurrentUser()` which reads `sessionStorage` directly. If the backend session expired but `sessionStorage` still holds user data (e.g., server restarted, token expired on backend), the guard will pass, then the first API call will fail with 401. The interceptor will catch it and redirect, but the user sees a brief flash of the protected page. This is mitigated by the interceptor's 401 handler, but an async guard that validates session with the backend (or checks a "session valid" flag set by the interceptor) would prevent the flash.

</details>

<details>
<summary>Details</summary>



## Booking classification compares dates in client timezone

`classifyBookings()` creates `const today = new Date(); today.setHours(0,0,0,0);` then for each booking parses `new Date(b.journeyDate || b.departureDate || '')` and sets hours to `0,0,0,0`. Current bookings require `b.status !== 'completed' && b.status !== 'cancelled' && !isNaN(journeyDate.getTime()) && journeyDate >= today`. Completed bookings match `b.status === 'completed' || b.status === 'cancelled' || (isNaN(journeyDate.getTime()) || journeyDate < today)`.

The classification handles missing dates (defaults to completed if status is terminal) and invalid date strings (isNaN check). The comment acknowledges the timezone issue: "This classification uses the browser's local timezone. If the server stores dates in a different timezone, there may be a one-day discrepancy for bookings near midnight."

## Template duplicates booking card structure

The `my-trip.component.html` template has two sections: one looping over `currentBookings`, one looping over `completedBookings`. Each section contains ~100 lines of identical HTML (image, badges, bus details, passenger details, action buttons). The only differences are the array variable and the action buttons (current bookings show a cancel button, completed bookings show "This booking cannot be cancelled" text). A shared `<ng-template>` with input parameters would eliminate ~90 lines of duplication.

## Navbar bus icon conditionally links to My Trips

When `isloggedIn` is true, the icon renders as `<a [routerLink]="['/my-trips']" ... aria-label="My Trips" title="My Trips">`. When false, it renders as `<a ... style="color: var(--color-text)">` with no `routerLink`. Both blocks duplicate the 15-line SVG and label markup. A single block with `[routerLink]="isloggedIn ? ['/my-trips'] : null"` would eliminate the duplication.

The route was added to `app.routes.ts`:

```typescript
{ path: 'my-trips', component: MyTripComponent, canActivate: [authGuard] },
```

</details>

<details>
<summary>File map</summary>

**Frontend — Authentication**
- `frontend/src/app/service/auth.service.ts` — Added `getGoogleIdForHeaderInjection()`, `restoreSession()`, `logout()`; removed `sessionStorage.clear()` call
- `frontend/src/app/interceptors/auth.interceptor.ts` — Added 401 error handler that calls `authService.logout()` and redirects to `/`
- `frontend/src/app/guards/auth.guard.ts` — Validates `currentUser.googleId` and `currentUser.email` exist (not just truthiness of `isLoggedIn`)
- `frontend/src/app/app.component.ts` — Calls `authService.restoreSession()` in `ngOnInit()`
- `frontend/src/app/Component/navbar/navbar.component.ts` — Wraps all router navigation in `ngZone.run()`; changed `clearUser()` to `logout()`

**Frontend — Booking History**
- `frontend/src/app/Component/profile-page/my-trip/my-trip.component.ts` — Added `classifyBookings()`, `currentBookings`, `completedBookings` arrays
- `frontend/src/app/Component/profile-page/my-trip/my-trip.component.html` — Added page header, separate sections for current and completed bookings (template duplication)
- `frontend/src/app/Component/profile-page/my-trip/my-trip.component.css` — Added header, section title, badge, responsive styles

**Frontend — Navigation**
- `frontend/src/app/Component/navbar/navbar.component.html` — Bus icon conditionally links to `/my-trips` when logged in; aria-label added
- `frontend/src/app/app.routes.ts` — Added `/my-trips` route with `MyTripComponent` and `authGuard`

**Frontend — Build Config**
- `frontend/angular.json` — Raised `maximumError` to 2mb for initial bundles, 10kb for component styles

**Backend**
- No changes in Phase 1 (authorization logic already enforces user isolation via `X-User-Id` header validation)

[Full diff](command:git.diff?main)

</details>
