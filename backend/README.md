# QueueSmart backend

Node/Express API for QueueSmart authentication.

## Structure

`src/app.js` is the integration point. Authentication is self-contained in
`src/modules/auth.js`. Future team modules can follow the same pattern and expose a
router that `app.js` mounts under `/api`.

## Setup

1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Replace `JWT_SECRET` and the optional administrator password.
4. For Supabase/Postgres mode, set `USE_DATABASE=true`, `SUPABASE_URL`, and
   `SUPABASE_SERVICE_ROLE_KEY`.
5. Initialize tables by either running `npm run db:init` with `DATABASE_URL`
   set, or by running `sql/001_core_tables.sql` in the Supabase SQL editor.
6. Run `npm run dev`.

The default base URL is `http://localhost:3000/api`.

## Authentication endpoints

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Create a user account |
| `POST` | `/auth/login` | Public | Receive a bearer token |
| `GET` | `/auth/me` | Authenticated | Read the current user |
| `GET` | `/auth/admin-check` | Administrator | Verify role protection |
| `GET` | `/health` | Public | Service health check |

Wait-time estimates are available to authenticated users through
`GET /time-estimation` and `GET /time-estimation/:serviceId`. The rule is:

```text
estimated wait = (position - 1) × expected service duration
```

Registration accepts `name`, `email`, and `password`. The API deliberately ignores a
client-supplied role: public accounts are always assigned the `user` role.

Send authenticated requests with:

```text
Authorization: Bearer <token>
```

With `USE_DATABASE=true`, the backend stores application data in the Supabase
Postgres tables `usercredentials`, `userprofile`, `service`, `queue`,
`queueentry`, and `history`. Notifications are stored in `history` rows with
`outcome = null`. Passwords are salted `scrypt` hashes. With database mode
disabled, local JSON files under `data/` remain the fallback development
storage.

The Supabase client lives in `src/supabase.js`. `src/app.js` creates it when
`USE_DATABASE=true`, and the backend modules use that client to query Supabase
tables.

Use the Supabase `service_role` key in `backend/.env` so backend inserts and
updates are not blocked by Row Level Security. Never expose that key in frontend
Vite environment variables.

For development, the backend seeds `user1@example.com` with password `password123`
as a regular demonstration user. The `DEMO_USER_*` environment variables can
override it. Do not enable predictable demonstration credentials in production.
