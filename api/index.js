import { createApp } from '../backend/src/app.js';
import { loadConfig } from '../backend/src/config.js';
import { initializeDatabaseSchema, initializePool } from '../backend/src/postgres.js';

const config = loadConfig();

if (config.databaseUrl) {
  initializePool(config.databaseUrl);
  if (config.useDatabase) {
    await initializeDatabaseSchema();
  }
}

const app = await createApp(config);

export default app;
