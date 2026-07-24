import { createApp } from './app.js';
import { loadConfig } from './config.js';

try {
  const config = loadConfig();
  const app = await createApp(config);
  app.listen(config.port, () => {
    console.log(`QueueSmart API listening on http://localhost:${config.port}`);
  });
} catch (error) {
  console.error(`Unable to start API: ${error.message}`);
  process.exit(1);
}
