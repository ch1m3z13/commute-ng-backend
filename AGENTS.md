# CommuteNG Backend

Express.js API backend for CommuteNG.

## Stack
- **Runtime:** Node.js 22 (TypeScript, `tsx watch` for dev)
- **Framework:** Express.js
- **Database:** PostgreSQL via Supabase (Pool from `pg`)
- **Validation:** Zod
- **Auth:** JWT + bcrypt

## Build & Run
- **Development:** `npm run dev` (uses `tsx watch`, port 3001)
- **Build:** `npm run build` (runs `tsc` → `dist/`)
- **Production:** `npm start` (runs `node dist/server.js`)
- **Linting:** `npm run lint` (⚠️ Broken; missing `eslint.config.js`)

## Architecture
- `src/server.ts` — Entry point, mounts all routes under `/api/`.
- `src/routes/` — Express handlers by domain: `auth.ts`, `users.ts`, `commutes.ts`, `rides.ts`, `notifications.ts`, `chat.ts`, `verification.ts`.
- `src/services/` — Business logic and DB access. Routes delegate here.
- `src/middleware/auth.ts` — `authenticateToken` (JWT Bearer), `optionalAuth`.
- `src/middleware/errorHandler.ts` — Global error formatting.
- `src/config/database.ts` — PostgreSQL pool init, schema creation, migrations.
- `src/config/index.ts` — Env var loading (`SUPABASE_DATABASE_URL`, `JWT_SECRET`, OAuth creds).
- `src/config/auth.ts` — JWT sign/verify helpers.

## Patterns
- **Validation:** Zod schemas for all incoming request bodies/query params.
- **Error Handling:** Throw errors in services; `errorHandler.ts` formats JSON responses.
- **DB Access:** `getDb().prepare(sql).run/get/all(params)` — async wrapper around `pg` Pool.
- **Parameterized queries:** Use `?` or `@named` params (auto-converted to `$1`, `$2`…).

## Environment
Copy `.env.example` to `.env`. Required:
- `SUPABASE_DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — token signing key
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET`
- `FRONTEND_BASE_URL` — for OAuth callback redirects

## Common Pitfalls
- **ESLint:** Do not fix linting until Flat Config migration is done.
- **Database:** This is PostgreSQL, not SQLite. The `pg` Pool is async — all DB calls are `await`.
- **Schema migrations:** Inline `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `database.ts` — additive only.
