import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(overrides = {}) {
  const config = {
    port: positiveInteger(process.env.PORT, 3000),
    jwtSecret: process.env.JWT_SECRET,
    tokenTtlSeconds: positiveInteger(process.env.TOKEN_TTL_SECONDS, 3600),
    dataFile: path.resolve(backendRoot, process.env.DATA_FILE ?? 'data/users.json'),
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

  return config;
}
