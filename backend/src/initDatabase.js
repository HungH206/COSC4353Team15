import { closePool, initializeDatabaseSchema, initializePool } from './postgres.js';
import { loadConfig } from './config.js';

try {
  const config = loadConfig();
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to initialize the Postgres schema.');
  }

  initializePool(config.databaseUrl);
  await initializeDatabaseSchema();
  await closePool();
  console.log('QueueSmart database schema is ready.');
} catch (error) {
  console.error(`Unable to initialize database: ${error.message}`);
  process.exit(1);
}
