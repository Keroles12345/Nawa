import { config } from './config';
import { createApp } from './app';
import { connectRedis } from './cache/redisClient';
import { logger } from './utils/logger';
import { OrderProcessingWorker } from './events/redis-streams';
import { createHttpInspectorServer } from './http-inspector/server';
import { ensureBootstrapAdmin } from './services/auth.service';
import { seedDemoData } from './services/demo-data.service';
import { indexMissingProductEmbeddings } from './services/search.service';

async function startServer(): Promise<void> {
  await ensureBootstrapAdmin();
  await seedDemoData();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`API server listening on port ${config.port}`);
  });

  void indexMissingProductEmbeddings().catch((error) => {
    logger.error(`Product embedding backfill failed: ${String(error)}`);
  });

  createHttpInspectorServer(config.port + 1);

  const worker = new OrderProcessingWorker();
  void connectRedis().then(() => worker.start());

  const shutdown = (): void => {
    server.close(() => {
      logger.info('API server stopped');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void startServer();
