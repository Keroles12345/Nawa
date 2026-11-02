import { logger } from '../utils/logger';
import { redisClient, isRedisAvailable } from '../cache/redisClient';
import { Order } from '../types';

const STREAM_NAME = 'orders:events';
const DLQ_NAME = 'orders:dlq';

export async function publishOrderCreated(order: Order): Promise<void> {
  if (!isRedisAvailable()) {
    logger.warn('Redis unavailable, skipping event publication');
    return;
  }

  const payload = {
    eventType: 'OrderCreated',
    orderId: order.id,
    userId: order.userId,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
  };

  try {
    await (redisClient as any).xAdd(STREAM_NAME, '*', { data: JSON.stringify(payload) });
    logger.info(`Published order event for order ${order.id}`);
  } catch (error) {
    logger.error(`Failed to publish order event: ${String(error)}`);
  }
}

export async function processOrderEvent(eventPayload: string, attempt = 0): Promise<void> {
  try {
    const payload = JSON.parse(eventPayload) as { orderId: string; userId: string; total: number };
    logger.info(`Processing order ${payload.orderId} for user ${payload.userId}`);
    const delayMs = 1000 * 2 ** attempt;
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
    logger.info(`Order ${payload.orderId} processing completed successfully`);
  } catch (error) {
    const retryCount = attempt + 1;
    if (retryCount <= 3) {
      logger.warn(`Retrying order event processing, attempt ${retryCount}`);
      await processOrderEvent(eventPayload, retryCount);
      return;
    }

    if (isRedisAvailable()) {
      try {
        await (redisClient as any).xAdd(DLQ_NAME, '*', { data: JSON.stringify({ originalPayload: eventPayload, error: String(error) }) });
      } catch (dlqError) {
        logger.error(`Failed to write to DLQ: ${String(dlqError)}`);
      }
    }
    logger.error(`Order event failed permanently and moved to DLQ: ${String(error)}`);
  }
}

export class OrderProcessingWorker {
  private running = false;

  public start(): void {
    if (this.running || !isRedisAvailable()) {
      return;
    }

    this.running = true;

    const poll = async (): Promise<void> => {
      if (!isRedisAvailable()) {
        this.running = false;
        return;
      }

      try {
        const entries = await (redisClient as any).xRead({ key: STREAM_NAME, id: '0-0' }, { BLOCK: 1000, COUNT: 10 });
        if (entries && Array.isArray(entries)) {
          for (const stream of entries) {
            const messages = stream.messages ?? [];
            for (const message of messages) {
              const rawPayload = message.data ?? message[1]?.data ?? '{}';
              const payloadValue = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
              if (typeof payloadValue === 'string') {
                await processOrderEvent(payloadValue);
              }
            }
          }
        }
      } catch (error) {
        logger.warn(`Order stream poll failed: ${String(error)}`);
      } finally {
        setTimeout(() => {
          void poll();
        }, 250);
      }
    };

    void poll();
  }
}
