# Plan: Redesign App Entry for Guest Exploration + Auth-at-Commit

## TL;DR
Move from "login first, then explore" to "explore first, login when committing." Users can browse rides, search, and view driver profiles without authentication. Only when they attempt to book, offer a ride, or message do they enter a unified sign-in → identity-verification → commit flow. Session recovery ensures users return to their ride selection after auth. Existing authenticated users are unaffected; only new visitors see the new flow.

---

## Architecture

### Core Principle
**Guest Mode**: State representing unauthenticated user with limited app access.
- Can see: Home, Find Ride, My Bookings (empty), My Requests (empty), Support
- Cannot see/do: Chat, Account settings, Driver Profile, actual booking/offer
- Bottom nav shows all tabs; tapping a restricted feature triggers auth flow

### Authentication States (Enhanced)
```
1. UNAUTHENTICATED (NEW)
   - No token in localStorage
   - Can view browse pages and listings
   - Cannot perform mutations (book, offer, message)

2. AUTHENTICATING (EXISTING)
   - Token exists, currently in sign-in or sign-up flow
   - Can only see LoginView, SetupIdentityView, VerificationView
   - Cannot access main app

3. IDENTITY_INCOMPLETE (EXISTING)
   - Token exists, identity not set up
   - Can see main app but forced to complete SetupIdentityView
   - Cannot book/offer until identity is set

4. IDENTITY_PENDING (EXISTING)
   - Token exists, identity submitted for NIMC verification
   - Can see main app and browse
   - Can book rides (or gated until verified—backend policy)

5. FULLY_AUTHENTICATED (EXISTING)
   - Token exists, identity complete & verified
   - Full app access
```

### Key Flows

**Flow 1: Browse Without Auth**
```
Splash → HomeView (guest) → FindRideView (guest) → RideResultsView (guest)
  ↓
User taps "Book Now" → AuthGate → SignIn/SignUp → SetupIdentity → Verification
  ↓
Redirect back to ride booking action
```

**Flow 2: New User Full Journey**
```
Splash → HomeView (guest) → FindRideView (search) → RideResultsView (select ride)
  ↓
Tap "Book" → AuthGate triggered → LoginView
  ↓
Sign up → SetupIdentityView → VerificationView → Auto-complete booking
  ↓
MyBookingsView (new booking visible)
```

**Flow 3: Message a Driver (Guest)**
```
RideResultsView (guest) → Tap "Contact" → AuthGate → LoginView → SetupIdentity → Verification
  ↓
Redirect to ChatView with same ride
```

**Flow 4: Offer a Ride (Guest)**
```
HomeView (guest) → Tap "Offer a Ride" → AuthGate → LoginView → SetupIdentity → Verification
  ↓
OfferRideView (newly authenticated)
```

---

## Implementation Steps

### Phase 1: State & Auth Architecture

1. **Enhance authService** (`src/services/authService.ts`):
   - Add new method `getAuthState()` → returns one of: `'unauthenticated' | 'authenticating' | 'identity_incomplete' | 'identity_pending' | 'fully_authenticated'`
   - Keep existing methods unchanged (backward compatible)
   - Add method `isGuest()` → returns true if `getAuthState() === 'unauthenticated'`

2. **Create AuthGate composable** (`src/composables/useAuthGate.ts` — NEW):
   - Function: `openAuthFlow(redirectTo?: string)` — triggers auth modal/redirect with optional return URL
   - Stores intended action + location to sessionStorage (e.g., `authGate_returnTo`)
   - Saves any pending data (e.g., selected ride ID for re-booking)

3. **Add Guest State Store** (consider Vue 3 reactivity, e.g., ref or pinia if scaling):
   - Track: `isGuestMode`, `pendingRideSelection` (ride ID + search params), `authIntentAction` (book/offer/message)
   - Minimal; only used during guest exploration phase

### Phase 2: Routing & Route Guards

4. **Update Router** (`src/router/index.ts`):
   - Define public guest routes: `/splash`, `/login`, `/home` (guest variant), `/find-ride` (guest variant), `/ride-results` (guest variant), `/support`
   - Define guest-redirecting routes: `/chat`, `/account/*`, `/my-requests`, `/offer-ride` (if auth required), `/driver-profile/:uid` (if auth required — clarify with backend)
   - Modify global `beforeEach` guard:
     - Route to guest routes: allow (no token needed)
     - Route to protected routes without token: redirect to specific route with auth gate (not `/login`)
     - Route to protected routes with token: validate and allow or redirect to onboarding

5. **Create Route-Level Auth Guards**:
   - On `/chat`, `/offer-ride`, `/my-requests`: intercept entry, check auth, if guest call `useAuthGate().openAuthFlow(returnUrl)`
   - Persist return URL in sessionStorage so auth flow knows where to redirect post-onboarding

### Phase 3: API Access for Guest

6. **Extend API Client** (`src/lib/api.ts`):
   - Modify header logic: Don't fail if no token; only include `Authorization` header if token exists
   - Keep 401 handling unchanged (if guest somehow hits protected endpoint, handle gracefully)
   - Ensure guest routes are actually available on backend (e.g., `GET /api/commutes/search` without auth, `GET /api/users/:uid` for public driver profile)
   - **Note**: Backend must explicitly support guest access to search/browse endpoints

### Phase 4: Component Variants for Guest

7. **Update HomeView** (`src/views/HomeView.vue`):
   - Check `isGuest()` / `getAuthState()`
   - If guest: Show reduced content (hide My Bookings if empty, hide Account shortcuts, add "Sign in to unlock" badges on restricted features)
   - If authenticated: Show full content (existing behavior)

8. **Update FindRideView & RideResultsView** (`src/views/FindRideView.vue`, `src/views/RideResultsView.vue`):
   - Support guest-mode rendering (no "Book Now" button unless authenticated; show "Sign in to book" or intercept tap)
   - On "Book" button tap: If guest, call `useAuthGate().openAuthFlow()` with `redirectTo: 'complete-booking'` + `pendingRideId`
   - Store ride selection (origin, destination, time, selected ride ID) in sessionStorage or local store

9. **Update OfferRideView** (`src/views/OfferRideView.vue`):
   - On entry: Check auth, if guest trigger gate
   - Redirect after auth completion

10. **Update ChatView** (`src/views/ChatView.vue`):
    - On entry: Check auth, if guest trigger gate

11. **Update Bottom Navigation** (`src/components/AppBottomNav.vue`):
    - Show all tabs (no hiding based on guest status)
    - On tap of restricted tab (Account, My Requests, Chat):
      - If authenticated: Navigate normally
      - If guest: Trigger `useAuthGate().openAuthFlow()` instead of navigation
    - Provide visual hint (icon badge, tooltip, or disabled appearance) for guest users

### Phase 5: Auth Flow with Session Recovery

12. **Enhance Session Recovery**:
    - Modify `sessionManager.ts` or auth flow to check sessionStorage for `authGate_returnTo` after successful login + identity setup
    - If present, redirect there instead of default routing
    - If `pendingRideId` exists in session, pre-populate the booking form or show "Complete booking" CTA

13. **Modify LoginView** (`src/views/LoginView.vue`):
    - Post-signin/signup, detect if redirected from auth gate
    - Show optional "Continue to booking" button in addition to default "Go to app" button
    - Auto-redirect if `authGate_returnTo` is set to a bookable flow

14. **Modify SetupIdentityView** (`src/views/SetupIdentityView.vue`):
    - Post-identity-setup, check for pending auth gate return
    - Redirect to `/verification` → `/ride-results` (if booking flow) or destination

15. **Modify VerificationView** (`src/views/VerificationView.vue`):
    - On verification complete, check `authGate_returnTo`
    - If "complete-booking": Redirect to `/ride-results` with ride ID pre-selected, show immediate booking action
    - Otherwise, go to `/home`

### Phase 6: Data Persistence Through Auth

16. **Persist Ride Selection** (in sessionStorage during guest → auth flow):
    - Before auth gate opens: Save `{ rideId, origin, destination, time, departure_time, driver_details }`
    - After auth+onboarding completes: Retrieve and pre-populate ride details for quick booking
    - Clear after booking or session end

17. **Prevent Auth Loop**:
    - Guard against accidental re-entry into auth gate during auth flow
    - Set flag `isAuthFlowInProgress` to prevent double-triggers

### Phase 7: Splash & Entry Logic

18. **Update SplashView** (`src/views/SplashView.vue`):
    - Check `authService.isAuthenticated()`
    - If no token: Redirect to guest `/home` (not `/login`) — *Change from current behavior*
    - If token: Do existing onboarding/profile resolution
    - Min 900ms display unchanged

19. **Create Guest Homepage Variant**:
    - If guest: Show "Welcome to CommuteNG" + "Browse Rides" CTA + "Sign in" button
    - If authenticated: Show existing content

### Phase 8: Testing & Edge Cases

20. **Handle Edge Cases**:
    - **Deep links while guest**: User opens app with deep link (e.g., `/ride-results?rideId=123`). If guest, allow, but book button triggers auth gate
    - **Browser refresh during booking attempt**: Re-fetch ride details from API; sessionStorage preserves ride ID
    - **Session expiry during booking**: Existing session recovery logic applies; user returns to incomplete booking
    - **Guest attempting to access unauthorized endpoint**: 401 from backend should gracefully show "Unauthorized; sign in" error

---

## Verification

### Manual Testing
1. **Guest Browsing**: Load app → should land on guest `/home` (not `/login`)
2. **Guest Search**: Click "Find a Ride" → search and view results → "Book" button disabled or shows "Sign in"
3. **Book as Guest**: Click "Book" → redirected to login → sign in → fill identity → verify → redirected to ride results → immediately book the same ride
4. **Offer as Guest**: From guest home, try to offer ride → auth gate → sign in → taken to offer form
5. **Message Driver (Guest)**: From guest ride results, click "Contact" → auth gate → sign in → chat opens
6. **Session Recovery**: During booking, if session expires, user re-logs in → should return to ride pre-selection
7. **Existing Users**: Current authenticated users should NOT be logged out; existing flow unchanged

### Automated Testing
1. Route guards: Verify guest users can access `/home`, `/find-ride`, `/ride-results`, `/support`
2. Route guards: Verify guest users are redirected from `/chat`, `/offer-ride`, `/my-requests`
3. Auth state: `authService.isGuest()` returns true/false correctly
4. Session storage: `authGate_returnTo` and `pendingRideId` are persisted and cleared appropriately
5. API calls: Guest requests don't include `Authorization` header; authenticated requests do

### Backend Coordination
1. Confirm `GET /api/commutes/search` is accessible without auth
2. Confirm `GET /api/users/:uid` (driver profile) is accessible without auth
3. Confirm all mutation endpoints (POST rides, POST commutes, POST chat) return 401 if no token
4. Ensure backend can handle repeated login attempts with same email

---

## Relevant Files

- [src/router/index.ts](src/router/index.ts) — Update route guards and guest route definitions
- [src/services/authService.ts](src/services/authService.ts) — Add `getAuthState()`, `isGuest()` methods
- [src/services/sessionManager.ts](src/services/sessionManager.ts) — Enhance session recovery for auth gate redirect
- [src/lib/api.ts](src/lib/api.ts) — Support optional auth headers for guest requests
- [src/views/SplashView.vue](src/views/SplashView.vue) — Redirect to guest home instead of login
- [src/views/HomeView.vue](src/views/HomeView.vue) — Guest variant UI
- [src/views/FindRideView.vue](src/views/FindRideView.vue) — Support guest browsing
- [src/views/RideResultsView.vue](src/views/RideResultsView.vue) — Auth gate on booking
- [src/views/OfferRideView.vue](src/views/OfferRideView.vue) — Auth gate on entry
- [src/views/ChatView.vue](src/views/ChatView.vue) — Auth gate on entry
- [src/views/LoginView.vue](src/views/LoginView.vue) — Enhanced for auth gate recovery flow
- [src/views/SetupIdentityView.vue](src/views/SetupIdentityView.vue) — Detect return-to destination
- [src/views/VerificationView.vue](src/views/VerificationView.vue) — Detect return-to destination
- [src/components/AppBottomNav.vue](src/components/AppBottomNav.vue) — Guest mode interception on restricted tabs
- [src/composables/useAuthGate.ts](src/composables/useAuthGate.ts) — NEW: Manage auth gate flow and redirects

---

## Decisions

- **Guest access scope**: Browse, search, view details only. No mutations without auth.
- **Auth timing**: Required before first booking/offer/message (not before exploration).
- **Identity verification**: Remains sequential (sign in → setup identity → verify) and before first booking. Verified async; user can browse while pending.
- **Return path**: Session storage preserves ride selection through auth flow; user returns to same ride for booking.
- **Bottom nav**: All tabs visible; restricted actions trigger auth gate on tap.
- **Backward compatibility**: Only new unauthenticated visitors see new flow; existing logged-in users unaffected.

---

## Implementation Order & Dependencies

**Phase 1 (Auth Service)**: Blocking — no frontend changes work without this
1. Enhance authService: `getAuthState()`, `isGuest()` methods

**Phase 2 (Routing)**: Blocking — must happen before component changes
2. Update router guards
3. Create auth gate composable
4. Update SplashView redirect logic

**Phase 3 (API)**: Can happen in parallel with Phase 2
5. Extend API client for optional auth

**Phase 4 (Components)**: Depends on Phase 2
6. Update all views for guest rendering
7. Update bottom nav

**Phase 5 (Session Recovery)**: Depends on Phase 2 and 4
8. Enhance session recovery for auth gate flow

**Phase 6-7 (Polish & Edge Cases)**: Can happen in parallel after Phase 5

---

## Non-Blocking Considerations

1. **Analytics**: Track guest → authenticated conversion; which rides are most browsed by guests
2. **Onboarding UX**: Should SetupIdentityView show a progress indicator (e.g., "Step 2 of 2: Complete profile")?
3. **Search Persistence**: Should guest search filters be saved across sessions (localStorage)?
4. **Notification Permissions**: Should guest users see push notification prompts?
5. **Bookmarking**: Should we allow guests to save/favorite rides? (Requires authenticated-only state)

---

## Rollout Strategy

1. **Phase**: Implement as a new feature branch `feature/guest-exploration`
2. **Testing**: Full QA in staging, including existing user regression tests
3. **Deployment**: Feature flag to enable/disable guest mode (safest rollout)
4. **Monitoring**: Track guest → conversion rate, drop-off points, error logs
5. **Feedback**: Gather user session data; iterate if conversion rate is low
