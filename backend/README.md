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
4. Run `npm run dev`.

The default base URL is `http://localhost:3000/api`.

## Authentication endpoints

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Create a user account |
| `POST` | `/auth/login` | Public | Receive a bearer token |
| `GET` | `/auth/me` | Authenticated | Read the current user |
| `GET` | `/auth/admin-check` | Administrator | Verify role protection |
| `GET` | `/health` | Public | Service health check |

Registration accepts `name`, `email`, and `password`. The API deliberately ignores a
client-supplied role: public accounts are always assigned the `user` role.

Send authenticated requests with:

```text
Authorization: Bearer <token>
```

User data is stored in `data/users.json` for the initial project phase. The file is
excluded from Git. A database-backed repository can replace it without changing the
routes or authentication service.

For development, the backend seeds `user1@example.com` with password `password123`
as a regular demonstration user. The `DEMO_USER_*` environment variables can
override it. Do not enable predictable demonstration credentials in production.
