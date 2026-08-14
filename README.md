# QueueSmart

QueueSmart is a full-stack virtual queue management system developed by COSC
4353 Team 15. It allows users to join service queues, track their position,
receive notifications, review queue history, and ask an AI assistant about their
queue status. Administrators can manage services, serve users in queue order,
monitor queue activity, and export reports.

The project focuses on practical system integration: authentication, queue
operations, database-backed persistence, reporting, smart wait-time estimation,
and API-based AI assistance.

## Main Functionality

### User Features

- Register and sign in with a secure account.
- View available services and their estimated waits.
- Join one open service queue at a time.
- Leave a queue before being served.
- Track current queue position, people ahead, and smart estimated wait.
- Receive notifications when joining, being served, or becoming next.
- Review personal queue history with paginated history rows.
- Use the AI Queue Assistant to ask natural-language questions about queue
  status.

### Administrator Features

- Create, edit, open/close, and delete services.
- Manage service details such as name, description, priority, and expected
  duration.
- View active queues by service.
- Serve the next user in first-in, first-out order.
- View dashboard metrics for open services, queued users, and estimated load.
- Generate and export reports for users, services, queues, and activity.

## Smart Features

### Smart Wait-Time Estimation

QueueSmart includes dynamic wait-time estimation. The original fallback rule is:

```text
estimated wait = people ahead * expected service duration
```

The smart version improves this by using actual historical served wait times
stored in the database. When enough historical records exist for a service, the
backend estimates future waits from recent real queue performance instead of
only using the static service duration.

The smart wait feature is visible in:

- Join Queue service dropdowns
- Queue Status page
- User Dashboard service cards
- Service and Queue Activity reports
- AI Queue Assistant responses

When a user is served, QueueSmart logs the actual elapsed wait time. This lets
future estimates become more accurate as the system collects more history.

### AI Queue Assistant

QueueSmart includes a read-only AI assistant for queue questions. It is available
from the user `AI Assistant` tab.

Users can ask questions such as:

```text
How long is my wait?
Am I next?
Should I stay in this queue?
Which service is faster?
What are you?
```

The assistant is grounded in live QueueSmart data. It receives queue position,
people ahead, service status, queue length, and smart wait estimates from the
backend. It does not directly join, leave, serve, delete, or modify queues.

If an AI API key and model are configured, the backend calls the AI API. If not,
QueueSmart falls back to a local deterministic response so the project remains
testable without external AI access.

Required AI environment variables:

```env
AI_API_KEY=your_api_key
AI_CHAT_MODEL=gpt-5-mini
```

The backend response includes a source label:

- `ai-api`: response came from the configured AI model
- `queuesmart-fallback`: response came from the local fallback logic

## Reporting

Administrators can access the `Reports` page and export CSV files.

### User History Report

Shows user/customer queue participation history:

- Name
- Email
- Service requested
- Join time
- Outcome: served or left
- Outcome timestamp

The table is paginated at 10 rows per page for readability. CSV export includes
the full report.

### Service and Queue Activity Report

Shows one row per service and combines service details with queue activity:

- Service name
- Description
- Priority
- Open/closed status
- Created at
- Expected duration
- Current queue length
- Smart estimated wait
- Users currently waiting
- Users served
- Users left/cancelled
- Total queue interactions
- Last queue activity

In this project, "queue activity" means activity inside each service queue:
users joining, waiting, leaving, and being served. It is not a full audit log of
every administrative open/close/delete action.

### Queue Statistics Report

Shows queue usage statistics:

- Total joined
- Users served
- Percentage left
- Average wait
- Estimation error compared with expected duration

## Technology Stack

- Frontend: React 19, Vite, Lucide React
- Backend: Node.js, Express 5
- Authentication: signed bearer tokens and salted `scrypt` password hashes
- Database: Supabase/Postgres for deployed/database mode
- Local development storage: JSON files under `backend/data`
- Testing: Node.js test runner and HTTP integration tests
- Deployment target: Vercel serverless API plus Vite static frontend

## Project Structure

```text
COSC4353Team15/
├── api/
│   └── index.js                  # Vercel serverless Express entrypoint
├── backend/
│   ├── data/                     # Local JSON data for file mode
│   ├── sql/
│   │   └── 001_core_tables.sql   # Supabase/Postgres schema
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth.js
│   │   │   ├── chatbot.js
│   │   │   ├── history.js
│   │   │   ├── notifs.js
│   │   │   ├── queue.js
│   │   │   ├── reports.js
│   │   │   ├── services.js
│   │   │   └── time_estimation.js
│   │   ├── app.js
│   │   ├── config.js
│   │   └── server.js
│   └── test/
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── App.css
│   └── vite.config.js
├── package.json
└── vercel.json
```

## Backend Modules

### Authentication

- User registration and login
- User and administrator roles
- Input validation
- Salted password hashing with Node.js crypto
- Signed expiring bearer tokens
- Session restoration through `/api/auth/me`

### Services

- Authenticated service listing
- Admin-only create, edit, open/close, and delete
- Service fields: name, description, expected duration, priority, open status

### Queues

- Users join and leave service queues
- Admins serve the next user
- FIFO queue behavior per service
- Queue membership restoration after refresh
- Notifications and history side effects when queue events occur

### Time Estimation

- Fallback static estimates from expected service duration
- Smart estimates from recent actual served wait times
- API endpoints for all estimates or one service estimate

### Notifications

- Join confirmation notifications
- Served-user notification
- Next-user notification
- Mark notification as read
- Frontend polling for updates

### History

- Records served and left outcomes
- Stores service name, outcome, timestamp, and wait minutes
- Users can only view their own history

### Reports

- Admin-only report endpoints
- User history report
- Service and queue activity report
- Queue statistics report
- CSV export from the frontend

### Chatbot

- Authenticated read-only chatbot endpoint
- Uses live queue/service data and smart wait estimates
- Optional AI API integration
- Local fallback response for test/demo reliability

## Prerequisites

- Node.js 22.x recommended
- npm
- Git
- Supabase project for database/deployment mode
- Optional OpenAI-compatible API key for the AI assistant

## Installation

```bash
git clone https://github.com/HungH206/COSC4353Team15.git
cd COSC4353Team15

cd backend
npm install

cd ../frontend
npm install
```

## Backend Configuration

Create a backend environment file:

```bash
cd backend
cp .env.example .env
```

Example local configuration:

```env
PORT=3000
JWT_SECRET=replace-this-with-a-random-secret-at-least-32-characters
TOKEN_TTL_SECONDS=3600

USE_DATABASE=false
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

DATA_FILE=./data/users.json
SERVICES_FILE=./data/services.json
QUEUES_FILE=./data/queues.json
HISTORY_FILE=./data/history.json
NOTIFICATIONS_FILE=./data/notifications.json

ADMIN_NAME=QueueSmart Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123

DEMO_USER_NAME=Demo User
DEMO_USER_EMAIL=user1@example.com
DEMO_USER_PASSWORD=password123

AI_API_KEY=
AI_CHAT_MODEL=
```

For Supabase/Postgres mode:

```env
USE_DATABASE=true
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=your_postgres_connection_string
```

Run the schema in Supabase SQL editor or initialize through the backend:

```bash
cd backend
npm run db:init
```

The schema creates:

- `usercredentials`
- `userprofile`
- `service`
- `queue`
- `queueentry`
- `history`

The `history` table includes `wait_minutes`, which is required for smart
wait-time estimation.

Do not commit `.env` files. Use the Supabase service-role key only in the
backend environment.

## Running Locally

Terminal 1:

```bash
cd backend
npm start
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

During development, Vite proxies `/api` requests to:

```text
http://localhost:3000
```

Default demo user:

```text
Email: user1@example.com
Password: password123
Role: user
```

Admin credentials come from `backend/.env`.

Changing a seeded password in `.env` does not automatically update an existing
password hash in local files or Supabase. If the account already exists, use the
stored password or reset/recreate the account in the configured storage.

## First-Time Usage

1. Start the backend and frontend.
2. Log in as an administrator.
3. Open `Services`.
4. Create at least one open service.
5. Log out and sign in as a user.
6. Open `Join Queue`.
7. Join a queue and track it from `Queue Status`.
8. Ask queue questions from `AI Assistant`.
9. Return as admin to serve users and view reports.

## API Overview

The default local API base URL is:

```text
http://localhost:3000/api
```

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Check API health |
| `POST` | `/auth/register` | Public | Register a user |
| `POST` | `/auth/login` | Public | Log in and receive a token |
| `GET` | `/auth/me` | Authenticated | Restore current user |
| `GET` | `/auth/admin-check` | Administrator | Verify admin access |
| `GET` | `/services` | Authenticated | List services |
| `POST` | `/services` | Administrator | Create service |
| `PUT` | `/services/:id` | Administrator | Update service |
| `DELETE` | `/services/:id` | Administrator | Delete service |
| `GET` | `/queue` | Administrator | View all queues |
| `GET` | `/queue/mine` | Authenticated | View current user's queue |
| `GET` | `/queue/summary` | Authenticated | View queue counts |
| `POST` | `/queue/join` | Authenticated | Join queue |
| `POST` | `/queue/leave` | Authenticated | Leave queue |
| `POST` | `/queue/:serviceId/serve` | Administrator | Serve next user |
| `GET` | `/time-estimation` | Authenticated | Get all smart wait estimates |
| `GET` | `/time-estimation/:serviceId` | Authenticated | Get one smart wait estimate |
| `GET` | `/notifications` | Authenticated | List notifications |
| `PATCH` | `/notifications/:id/read` | Authenticated | Mark notification read |
| `GET` | `/history` | Authenticated | List personal history |
| `GET` | `/reports/user-stats` | Administrator | User history report |
| `GET` | `/reports/queue-stats` | Administrator | Queue and service activity stats |
| `POST` | `/chatbot` | Authenticated | Ask the AI Queue Assistant |

Authenticated requests use:

```text
Authorization: Bearer <token>
```

Example chatbot request:

```bash
curl -X POST http://localhost:3000/api/chatbot \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d '{"message":"How long is my wait?"}'
```

## Deployment On Vercel

The repository is configured for Vercel:

- `vercel.json` builds `frontend`
- `api/index.js` exposes the Express backend as a serverless API
- `/api/*` requests are rewritten to the backend
- all other requests serve the React app

Set these environment variables in Vercel:

```env
JWT_SECRET=long_random_secret_at_least_32_chars
TOKEN_TTL_SECONDS=3600

USE_DATABASE=true
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=your_postgres_connection_string

ADMIN_NAME=QueueSmart Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_admin_password

DEMO_USER_NAME=Demo User
DEMO_USER_EMAIL=user1@example.com
DEMO_USER_PASSWORD=password123

AI_API_KEY=your_ai_api_key
AI_CHAT_MODEL=gpt-5-mini
```

Do not use file-mode storage for deployed Vercel data. Serverless file storage
is not reliable for persistent application state. Use Supabase/Postgres for
deployment.

## Testing

Backend tests:

```bash
cd backend
npm test
```

Frontend validation:

```bash
cd frontend
npm run lint
npm run build
```

The backend test suite includes integration coverage for:

- Authentication
- Services
- Queue operations
- Notifications
- History
- Time estimation
- Smart wait-time calculation
- AI assistant fallback behavior
- Database integration with mocked Supabase-style clients

## Known Limitations

- The AI assistant is read-only and does not perform queue actions.
- File-mode JSON storage is for local development only.
- Service priority is stored and displayed, but it does not reorder users inside
  a queue.
- Notifications are in-app only; there is no email or SMS delivery.
- Queue activity reports measure activity inside queues, not full audit logs for
  every admin action such as service deletion.
- Historical smart wait estimates improve as more served records are collected.
  New services with no history fall back to expected duration.

## Security Notes

- Passwords are stored as salted `scrypt` hashes.
- Authentication uses signed bearer tokens.
- Supabase service-role keys must only be stored in backend or Vercel server
  environment variables.
- Do not commit `.env` files or API keys.
- Demo credentials are for development and presentation only.
