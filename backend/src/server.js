import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { initializeDatabaseSchema, initializePool } from './postgres.js';

try {
  const config = loadConfig();
  if (config.databaseUrl) {
    initializePool(config.databaseUrl);
    if (config.useDatabase) {
      await initializeDatabaseSchema();
    }
  }
  const app = await createApp(config);
  const server = app.listen(config.port, () => {
    console.log(`QueueSmart API listening on http://localhost:${config.port}`);
  });
  server.on('error', (error) => {
    console.error(`Unable to keep API server running: ${error.message}`);
    process.exit(1);
  });
} catch (error) {
  if (error.message?.includes('schema cache')) {
    console.error('Unable to start API: Supabase tables are missing. Run `npm run db:init` with DATABASE_URL set, or run backend/sql/001_core_tables.sql in the Supabase SQL editor.');
    process.exit(1);
  }
  console.error(`Unable to start API: ${error.message}`);
  process.exit(1);
}
