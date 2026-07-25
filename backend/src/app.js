import cors from 'cors';
import express from 'express';
import { createAuthModule } from './modules/auth.js';
import { createServiceModule } from './modules/services.js';
import { createQueueModule } from './modules/queue.js';
import { createNotificationModule } from './modules/notifs.js';

export async function createApp(config) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '20kb' }));

  const auth = await createAuthModule(config);
  const services = await createServiceModule(config, auth);
  const notifications = await createNotificationModule(config, auth);
  
  // i write this to pass the queue test. Replace these with actual notification and history modules later
  const dummyHistoryLogger = async (userId, serviceName, waitMinutes, outcome) => {

  };

  const queue = await createQueueModule(
    config,
    auth,
    services.store,
    dummyHistoryLogger,   // replace with actual history logger
    notifications.notify  // real notifier now, was dummyNotifier
  );

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use('/api/auth', auth.router);
  app.use('/api/services', services.router);
  app.use('/api/queue', queue.router);
  app.use('/api/notifications', notifications.router);

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