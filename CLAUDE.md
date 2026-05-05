# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Express.js + TypeScript backend API for CommuteNG - an exclusive commuting platform for Abuja professionals. Uses Supabase (PostgreSQL + Supabase Auth) for data and authentication. Zod for request validation. Firebase Storage retained for verification documents (pending migration to Supabase Storage).

## Commands

```bash
npm run dev        # Start development server with hot reload (tsx watch)
npm run build      # Compile TypeScript to ./dist
npm start          # Run production server from ./dist
npm run lint       # Run ESLint on src/
npm run migrate    # Run Firebase → Supabase data migration script
```

No test framework is currently configured.

## Architecture

### Request Flow
```
Client → Express Router → authenticateToken middleware → Route Handler → Service → Supabase (PostgreSQL)
```

### Key Patterns

**Authentication**: `authenticateToken` middleware verifies Bearer token against Supabase Auth (`supabase.auth.getUser(token)`). All `/api/*` routes require authentication except `/health`.

**Feature Flags**: Two flags control provider selection:
- `AUTH_PROVIDER` (`firebase` | `supabase`) — defaults to `firebase`
- `DATABASE_PROVIDER` (`firestore` | `postgres`) — defaults to `firestore`

Set both to `supabase`/`postgres` after migration is complete.

**Route Organization**: Routes in `src/routes/*.ts` handle HTTP concerns (parsing, validation, responses). Business logic lives in `src/services/*.ts`. Routes inject `req.user.uid` to services.

**Data Validation**: Uses Zod for request body/params validation in route handlers.

**Service Layer**: Each service (`userService`, `commuteService`, etc.) has two implementations:
- `*.firestore.ts` — Firestore (current, default)
- `*.postgres.ts` — Supabase/PostgreSQL (new)

Main service file is a factory that selects the implementation based on `DATABASE_PROVIDER` flag.

### Directory Structure

```
src/
├── config/          # supabase.ts, firebase.ts, featureFlags.ts, index.ts (env config)
├── middleware/      # auth.ts (routes to firebase or supabase), auth.firebase.ts, auth.supabase.ts
├── routes/          # Express routers (users, commutes, rides, notifications, chat, verification)
├── services/        # Factory + dual implementations (*.firestore.ts, *.postgres.ts)
├── models/          # TypeScript interfaces (types.ts)
├── db/migrations/   # SQL migrations (001_initial_schema.sql)
├── scripts/         # migrate-firebase-to-supabase.ts
└── server.ts        # Express app entry point
```

## Environment Variables

**Supabase (required after migration):**
- `SUPABASE_URL` — e.g. `https://your-project.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — service role key for server-side operations
- `SUPABASE_ANON_KEY` — anon key for client-side (if needed)

**Feature Flags:**
- `AUTH_PROVIDER` — `firebase` (default) or `supabase`
- `DATABASE_PROVIDER` — `firestore` (default) or `postgres`

**Firebase (deprecated, retained for migration):**
- `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`

**Server:**
- `PORT` (optional, defaults to 3001)
- `NODE_ENV` (optional, defaults to development)

## Database Schema

PostgreSQL tables: `users`, `commutes`, `rides`, `ride_messages`, `notifications`. Schema defined in `src/db/migrations/001_initial_schema.sql`. All tables have Row Level Security (RLS) policies enabled.

## Migration

See `src/db/migrations/001_initial_schema.sql` for the target schema. To migrate existing Firebase data:
1. Set Supabase env vars in `.env`
2. Run `npm run migrate`
3. Set `AUTH_PROVIDER=supabase` and `DATABASE_PROVIDER=postgres`
4. Test all endpoints
5. When stable, remove Firebase dependencies and cleanup files
