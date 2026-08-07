# QueueSmart

QueueSmart is a full-stack virtual queue management application developed by
COSC 4353 Team 15. Users can register, sign in, browse available services, join
or leave a queue, view their estimated wait, and receive queue notifications.
Administrators can manage services, inspect queues, and serve the next user.

## Technology

- Frontend: React 19, Vite, and Lucide React
- Backend: Node.js, Express 5, and native Node.js cryptography
- Authentication: signed bearer tokens and salted `scrypt` password hashes
- Development storage: local JSON files under `backend/data`
- Testing: Node.js test runner and HTTP integration tests

## Project structure

```text
COSC4353Team15/
├── backend/
│   ├── data/                    # Local JSON data; generated at runtime
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth.js
│   │   │   ├── services.js
│   │   │   ├── queue.js
│   │   │   ├── time_estimation.js
│   │   │   └── notifs.js
│   │   ├── app.js              # Express application and module wiring
│   │   ├── config.js
│   │   └── server.js
│   └── test/
└── frontend/
    ├── src/
    │   ├── api/                 # Backend API clients
    │   ├── components/
    │   ├── pages/
    │   └── App.jsx
    └── vite.config.js
```

## Implemented modules

### Authentication

- User registration and login
- User and administrator roles
- Basic input validation
- Salted password hashing
- Signed, expiring authentication tokens
- Session restoration and logout in the frontend

### Service management

- Authenticated service listing
- Administrator creation, editing, opening/closing, and deletion
- Service name, description, expected duration, and priority level
- Open services displayed on the user Join Queue page

### Queue management

- Users can join and leave an open service queue
- Queue membership is restored after a page refresh
- Administrators can view queues and serve the next user
- Users are served in first-in, first-out arrival order

Service priority is stored and displayed. It does not currently reorder users
within an individual service queue because queue entries do not have their own
priority value.

### Wait-time estimation

Wait time is calculated by the backend using:

```text
estimated wait = (position - 1) * expected service duration
```

The Join Queue page displays the prospective wait before joining. The Queue
Status page displays the authenticated user's backend-calculated position,
people ahead, and estimated wait.

### Notifications

- Joining a queue creates a notification
- When an administrator serves the current user, the next user is notified
- Users can retrieve and mark their own notifications as read
- The frontend polls periodically for new notifications
- Notifications appear in the header panel and user dashboard

### History

- Leaving a queue records a `left` outcome
- Being served records a `served` outcome
- Records include service name, estimated wait, outcome, and timestamp
- Users can retrieve only their own history
- The Queue History page loads authenticated backend records

## Prerequisites

- Node.js 20.19 or newer
- npm
- Git

## Installation

Clone the repository and install dependencies in both applications:

```powershell
git clone https://github.com/HungH206/COSC4353Team15.git
cd COSC4353Team15

cd backend
npm install

cd ../frontend
npm install
```

## Backend configuration

Create the local environment file:

```powershell
cd backend
Copy-Item .env.example .env
```

Edit `backend/.env`:

```env
PORT=3000
JWT_SECRET=replace-this-with-a-random-secret-at-least-32-characters
TOKEN_TTL_SECONDS=3600
USE_DATABASE=false
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATA_FILE=./data/users.json

ADMIN_NAME=QueueSmart Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=choose-a-password

DEMO_USER_NAME=Demo User
DEMO_USER_EMAIL=user1@example.com
DEMO_USER_PASSWORD=password123
```

The backend also uses these optional paths, which have sensible defaults:

```env
SERVICES_FILE=./data/services.json
QUEUES_FILE=./data/queues.json
HISTORY_FILE=./data/history.json
NOTIFICATIONS_FILE=./data/notifications.json
```

For the Assignment 4 RDBMS implementation, run
`backend/sql/001_core_tables.sql` in the Supabase SQL editor, or set
`DATABASE_URL` and run `npm run db:init` from `backend/`. Then set:

```env
USE_DATABASE=true
SUPABASE_URL=<your-project-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

Database mode stores data in these Supabase/Postgres tables:
`usercredentials`, `userprofile`, `service`, `queue`, `queueentry`, and
`history`. Notifications are stored in `history` rows with `outcome = null`.
Passwords are salted `scrypt` hashes, never plain text.

Use the Supabase `service_role` key only in `backend/.env`. Do not put it in the
frontend `.env` file.

Do not commit `.env`. The administrator and demo user are created on startup
when their email addresses do not already exist. Changing a seeded password in
`.env` does not automatically replace an existing password hash in
the configured storage.

## Running locally

Run the backend and frontend in separate terminals.

Terminal 1:

```powershell
cd backend
npm run dev
```

Terminal 2:

```powershell
cd frontend
npm run dev
```

Open the Vite URL printed in the second terminal, normally
`http://localhost:5173`.

During development, Vite forwards `/api` requests to
`http://localhost:3000`, so both servers must be running.

The default demonstration account is:

```text
Email: user1@example.com
Password: password123
Role: user

```

Administrator credentials come from `backend/.env`.

## First-time usage

1. Start both servers.
2. Sign in with the administrator account.
3. Open Service Management.
4. Create at least one service and leave its queue marked open.
5. Sign out and sign in as a user.
6. Open Join Queue and select the new service.

Services are loaded from `backend/data/services.json`; a new installation starts
without services until an administrator creates one.

## API overview

The default API base URL is `http://localhost:3000/api`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Check API health |
| `POST` | `/auth/register` | Public | Register a user |
| `POST` | `/auth/login` | Public | Log in and receive a token |
| `GET` | `/auth/me` | Authenticated | Restore the current user |
| `GET` | `/auth/admin-check` | Administrator | Verify administrator access |
| `GET` | `/services` | Authenticated | List services |
| `POST` | `/services` | Administrator | Create a service |
| `PUT` | `/services/:id` | Administrator | Update a service |
| `DELETE` | `/services/:id` | Administrator | Delete a service |
| `GET` | `/queue` | Administrator | View every queue |
| `GET` | `/queue/mine` | Authenticated | View personal queue membership |
| `GET` | `/queue/summary` | Authenticated | View queue counts |
| `POST` | `/queue/join` | Authenticated | Join a service queue |
| `POST` | `/queue/leave` | Authenticated | Leave a service queue |
| `POST` | `/queue/:serviceId/serve` | Administrator | Serve the next user |
| `GET` | `/time-estimation` | Authenticated | Get all service estimates |
| `GET` | `/time-estimation/:serviceId` | Authenticated | Get one estimate |
| `GET` | `/notifications` | Authenticated | List personal notifications |
| `PATCH` | `/notifications/:id/read` | Authenticated | Mark a notification read |
| `GET` | `/history` | Authenticated | List personal queue history |

Authenticated requests use:

```text
Authorization: Bearer <token>
```

## Testing and validation

 Unit tests include: auth.test.js; notifications.test.js; queue.test.js; services.test.js, history_test.js; and time_estimation.test.js. Run all backend integration tests:

```powershell
cd backend
npm test
```

Validate the frontend:

```powershell
cd frontend
npm run lint
npm run build
```

## Data and development limitations

- JSON files are suitable for this course project and local development, but
  they are not a replacement for a production database.
- Files under `backend/data/*.json` are ignored by Git, so teammates have
  independent local data.
- There is no real email or SMS delivery; notifications are stored and returned
  through the application.
- Predictable demonstration credentials must not be used in production.
