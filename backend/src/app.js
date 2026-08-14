import cors from 'cors';
import express from 'express';

import { getSupabaseClient } from './supabase.js';

import { createAuthModule } from './modules/auth.js';
import { createServiceModule } from './modules/services.js';
import { createQueueModule } from './modules/queue.js';
import { createNotificationModule } from './modules/notifs.js';
import { createHistoryModule } from './modules/history.js';
import { createTimeEstimationModule } from './modules/time_estimation.js';
import { createChatbotModule } from './modules/chatbot.js';


export async function createApp(config) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '20kb' }));

  if (config.useDatabase && !config.db) {
    config.db = await getSupabaseClient(config);
  }

  const auth = await createAuthModule(config);
  const services = await createServiceModule(config, auth);
  const notifications = await createNotificationModule(config, auth);
  const history = await createHistoryModule(config, auth);

  const queue = await createQueueModule(
    config,
    auth,
    services.store,
    history.log,          // real history logger now
    notifications.notify  // real notifier now, was dummyNotifier
  );
  const timeEstimation = createTimeEstimationModule(auth, services.store, queue.store);
  const chatbot = createChatbotModule(config, auth, services.store, queue.store);

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use('/api/auth', auth.router);
  app.use('/api/services', services.router);
  app.use('/api/queue', queue.router);
  app.use('/api/time-estimation', timeEstimation.router);
  app.use('/api/chatbot', chatbot.router);
  app.use('/api/notifications', notifications.router);
  app.use('/api/history', history.router);

  app.use((_request, response) => {
    response.status(404).json({ error: 'Route not found.' });
  });
  app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError && error.status === 400) {
      return response.status(400).json({ error: 'Request body must contain valid JSON.' });
    }
    console.error(error);
    response.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
