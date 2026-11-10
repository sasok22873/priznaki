import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Db } from './shared/db.js';
import type { AuthVerifier } from './shared/auth-types.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './shared/http.js';
import { createTasksRouter } from './modules/tasks/tasks.router.js';
import { createCatalogRouter } from './modules/catalog/catalog.router.js';

export type AppDeps = {
  db: Db;
  verifyToken: AuthVerifier;
  corsOrigins?: string[];
};

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: deps.corsOrigins ?? ['http://localhost:5173'],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'pb-api', time: new Date().toISOString() });
  });

  const auth = createAuthMiddleware(deps.verifyToken);

  app.get('/api/me', auth, (req, res) => {
    res.json({ data: req.user });
  });

  app.use('/api/tasks', auth, createTasksRouter(deps.db));
  app.use('/api/catalog', auth, createCatalogRouter(deps.db));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
