# CommuteNG Backend

Express.js API backend for CommuteNG - Exclusive commuting for Abuja professionals.

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** Firebase Firestore
- **Authentication:** Firebase Auth (ID tokens)
- **Validation:** Zod

## Project Structure

```
src/
├── config/
│   ├── firebase.ts      # Firebase Admin SDK initialization
│   └── index.ts        # Environment configuration
├── middleware/
│   ├── auth.ts          # Firebase token authentication
│   └── errorHandler.ts  # Global error handling
├── models/
│   └── types.ts         # TypeScript interfaces
├── routes/
│   ├── chat.ts          # Chat messages API
│   ├── commutes.ts       # Commutes (rides offered) API
│   ├── index.ts          # Route exports
│   ├── notifications.ts  # Notifications API
│   ├── rides.ts         # Ride bookings API
│   ├── users.ts         # User profiles API
│   └── verification.ts  # Verification status API
├── services/
│   ├── chatService.ts
│   ├── commuteService.ts
│   ├── notificationService.ts
│   ├── rideService.ts
│   └── userService.ts
└── server.ts           # Express app entry point
```

## API Endpoints

### Users (`/api/users`)
- `GET /users/me` - Get current user profile
- `POST /users` - Create user profile
- `PATCH /users/me` - Update current user
- `PATCH /users/me/vehicle` - Update vehicle info
- `PATCH /users/me/phone` - Update phone number
- `GET /users/drivers/top-rated` - Get top-rated verified drivers
- `GET /users/:uid` - Get user by ID

### Commutes (`/api/commutes`)
- `GET /commutes` - List commutes (with filters)
- `GET /commutes/search?from=X&to=Y` - Search available rides
- `GET /commutes/my` - Get current user's offered commutes
- `GET /commutes/:id` - Get commute by ID
- `POST /commutes` - Create new commute
- `PATCH /commutes/:id` - Update commute
- `PATCH /commutes/:id/cancel` - Cancel commute
- `DELETE /commutes/:id` - Delete commute

### Rides (`/api/rides`)
- `GET /rides/my-bookings` - Get current user's ride bookings
- `GET /rides/my-requests` - Get ride requests for driver's commutes
- `GET /rides/:id` - Get ride by ID
- `POST /rides` - Request a ride (create booking)
- `PATCH /rides/:id/accept` - Accept ride request
- `PATCH /rides/:id/reject` - Reject ride request
- `PATCH /rides/:id/complete` - Mark ride as completed
- `PATCH /rides/:id/cancel` - Cancel ride

### Notifications (`/api/notifications`)
- `GET /notifications` - Get user notifications
- `GET /notifications/unread-count` - Get unread count
- `PATCH /notifications/:id/read` - Mark as read
- `PATCH /notifications/read-all` - Mark all as read
- `DELETE /notifications/:id` - Delete notification

### Chat (`/api/chat`)
- `GET /chat/:rideId` - Get chat messages for a ride
- `POST /chat/:rideId` - Send a message

### Verification (`/api/verification`)
- `GET /verification/status` - Get verification status
- `POST /verification/submit` - Submit verification documents
- `PATCH /verification/admin/:uid` - Admin: update verification status

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configure Firebase:
   - Create a Firebase project
   - Generate a service account JSON and set `FIREBASE_SERVICE_ACCOUNT` in `.env`
   - Copy your Firebase app config values

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## Authentication

All API endpoints (except `/health`) require Firebase ID token authentication.

Include the token in the `Authorization` header:
```
Authorization: Bearer <firebase_id_token>
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
