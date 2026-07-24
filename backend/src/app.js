import cors from 'cors';
import express from 'express';
import { createAuthModule } from './modules/auth.js';

export async function createApp(config) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '20kb' }));

  const auth = await createAuthModule(config);

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });
  app.use('/api/auth', auth.router);

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
