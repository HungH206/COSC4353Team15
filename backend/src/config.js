import path from 'node:path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.resolve(backendRoot, '.env') });

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(overrides = {}) {
  const config = {
    port: positiveInteger(process.env.PORT, 3000),
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    tokenTtlSeconds: positiveInteger(process.env.TOKEN_TTL_SECONDS, 3600),

    dataFile: path.resolve(backendRoot, process.env.DATA_FILE ?? 'data/users.json'),
    servicesFile: path.resolve(backendRoot, process.env.SERVICES_FILE ?? 'data/services.json'),
    queuesFile: path.resolve(backendRoot, process.env.QUEUES_FILE ?? 'data/queues.json'),
    historyFile: path.resolve(backendRoot, process.env.HISTORY_FILE ?? 'data/history.json'),
    notificationsFile: path.resolve(backendRoot, process.env.NOTIFICATIONS_FILE ?? 'data/notifications.json'),

    admin: {
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },
    demoUser: {
      name: process.env.DEMO_USER_NAME ?? 'Demo User',
      email: process.env.DEMO_USER_EMAIL ?? 'user1@example.com',
      password: process.env.DEMO_USER_PASSWORD ?? 'password123',
    },
    ...overrides,
  };

  if (!config.jwtSecret || config.jwtSecret.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long.');
  }
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required in .env');
  }

  return config;
}

export default loadConfig();