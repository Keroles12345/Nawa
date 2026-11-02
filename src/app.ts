import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import path from 'path';

import { config } from './config';
import { OrderProcessingWorker } from './events/redis-streams';
import { createHttpInspectorServer } from './http-inspector/server';
import { observabilityMiddleware } from './middlewares/observability';
import { redisRateLimiter } from './middlewares/rateLimiter';
import { authRouter } from './routes/auth.routes';
import { categoriesRouter } from './routes/categories.routes';
import { healthRouter } from './routes/health.routes';
import { ordersRouter } from './routes/orders.routes';
import { productsRouter } from './routes/products.routes';
import { usersRouter } from './routes/users.routes';
import { connectRedis } from './cache/redisClient';
import { logger } from './utils/logger';
import { requireAPIKey } from './middlewares/auth';
import { ensureBootstrapAdmin } from './services/auth.service';
import { seedDemoData } from './services/demo-data.service';
import { indexMissingProductEmbeddings } from './services/search.service';

export function createApp(): Application {
  const app = express();
  const allowedOrigins = config.corsOrigin.split(',').map((origin) => origin.trim());

  app.use(helmet());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());
  app.use(observabilityMiddleware);
  app.use(redisRateLimiter(config.rateLimitWindowMinutes * 60 * 1000, config.rateLimitMaxRequests));

  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/orders', ordersRouter);
  app.get('/api/internal/metrics', requireAPIKey, (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        uptime: process.uptime(),
        platform: process.platform,
        memory: process.memoryUsage(),
      },
    });
  });

  app.use(express.static(path.resolve(process.cwd(), 'public')));

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction): void => {
    logger.error(error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  });

  return app;
}

export async function bootApplication(): Promise<{ app: Application; httpServer: ReturnType<typeof createHttpInspectorServer> }> {
  const app = createApp();
  await ensureBootstrapAdmin();
  await seedDemoData();
  void indexMissingProductEmbeddings().catch((error) => {
    logger.error(`Product embedding backfill failed: ${String(error)}`);
  });
  const worker = new OrderProcessingWorker();
  void connectRedis().then(() => worker.start());

  const httpServer = createHttpInspectorServer(config.port + 1);

  return { app, httpServer };
}
