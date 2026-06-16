# CommuteNG Backend

Express.js API backend for CommuteNG - Exclusive commuting for Abuja professionals.

## Tech Stack

- **Runtime:** Node.js 22 with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL (via `pg` Pool)
- **Authentication:** JWT (jsonwebtoken) with bcrypt password hashing
- **Validation:** Zod

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Set a strong `JWT_SECRET` in `.env` and configure `SUPABASE_DATABASE_URL`.

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

The PostgreSQL database schema is created automatically on first run.

## Quick Commands

```bash
npm run dev          # tsx watch, port 3001
npm run build        # tsc -> dist/
npm start            # node dist/server.js
npm test             # vitest run (requires PostgreSQL)
npm run test:watch   # vitest watch
```

## Testing

Tests require a PostgreSQL database. Set `TEST_DATABASE_URL` in `.env`:

```bash
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/commute_ng_test
```

## Scripts

- `scripts/admin-verify.ts` - Verify a user by email or UID (admin tool)
- `scripts/init-db.ts` - Initialize database schema
