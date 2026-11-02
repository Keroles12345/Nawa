import { logger } from '../utils/logger';
import { redisClient, isRedisAvailable } from '../cache/redisClient';
import { orderRepository } from '../repositories/order.repository';

const STREAM_NAME = 'orders:events';
const DLQ_NAME = 'orders:dlq';
const CONSUMER_GROUP = 'order-processors';
const CONSUMER_NAME = `${process.env.HOSTNAME ?? 'worker'}-${process.pid}`;
const MAX_ATTEMPTS = 3;

type StreamMessage = { id: string; fields: string[] };

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function parseMessages(value: unknown): StreamMessage[] {
  if (!isArray(value)) {
    return [];
  }
  return value.flatMap((message) => {
    if (!isArray(message) || typeof message[0] !== 'string' || !isArray(message[1])) {
      return [];
    }
    return [{ id: message[0], fields: message[1].map(String) }];
  });
}

function getField(fields: string[], name: string): string | undefined {
  const index = fields.indexOf(name);
  return index >= 0 ? fields[index + 1] : undefined;
}

export async function dispatchPendingOrderEvents(): Promise<void> {
  if (!isRedisAvailable()) {
    return;
  }

  let events: Awaited<ReturnType<typeof orderRepository.findPendingOutboxEvents>>;
  try {
    events = await orderRepository.findPendingOutboxEvents();
  } catch (error) {
    logger.error(`Could not read the order outbox: ${String(error)}`);
    return;
  }
  for (const event of events) {
    try {
      await redisClient.sendCommand([
        'XADD',
        STREAM_NAME,
        '*',
        'eventId',
        event.id,
        'data',
        JSON.stringify(event.payload),
      ]);
      await orderRepository.markOutboxEventPublished(event.id);
      logger.info(`Published order event ${event.id} for order ${event.aggregateId}`);
    } catch (error) {
      try {
        await orderRepository.recordOutboxAttempt(event.id);
      } catch (recordError) {
        logger.error(`Could not record the failed publish attempt for ${event.id}: ${String(recordError)}`);
      }
      logger.error(`Order event ${event.id} remains in the outbox after publish failure: ${String(error)}`);
    }
  }
}

async function ensureConsumerGroup(): Promise<void> {
  try {
    await redisClient.sendCommand(['XGROUP', 'CREATE', STREAM_NAME, CONSUMER_GROUP, '0-0', 'MKSTREAM']);
  } catch (error) {
    if (!String(error).includes('BUSYGROUP')) {
      throw error;
    }
  }
}

export async function processOrderEvent(eventId: string, eventPayload: string): Promise<void> {
  if (await orderRepository.isEventProcessed(eventId)) {
    logger.info(`Skipping duplicate order event ${eventId}`);
    return;
  }

  const payload: unknown = JSON.parse(eventPayload);
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    !('eventType' in payload) ||
    !('orderId' in payload) ||
    !('userId' in payload) ||
    payload.eventType !== 'OrderCreated' ||
    typeof payload.orderId !== 'string' ||
    typeof payload.userId !== 'string'
  ) {
    throw new Error('Invalid OrderCreated event payload');
  }

  logger.info(`Processing order ${payload.orderId} for user ${payload.userId}`);
  await orderRepository.markEventProcessed(eventId);
  logger.info(`Order ${payload.orderId} processing completed successfully`);
}

async function handleMessage(message: StreamMessage): Promise<void> {
  const eventId = getField(message.fields, 'eventId');
  const payload = getField(message.fields, 'data');
  try {
    if (!eventId || !payload) {
      throw new Error(`Stream message ${message.id} is missing event fields`);
    }
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        await processOrderEvent(eventId, payload);
        await redisClient.sendCommand(['XACK', STREAM_NAME, CONSUMER_GROUP, message.id]);
        return;
      } catch (error) {
        if (attempt === MAX_ATTEMPTS - 1) {
          throw error;
        }
        const delayMs = 250 * 2 ** attempt;
        logger.warn(`Retrying order event ${eventId} in ${delayMs}ms: ${String(error)}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  } catch (error) {
    await redisClient.sendCommand([
      'XADD',
      DLQ_NAME,
      '*',
      'eventId',
      eventId ?? `unknown-${message.id}`,
      'data',
      payload ?? '',
      'error',
      String(error),
      'sourceMessageId',
      message.id,
    ]);
    await redisClient.sendCommand(['XACK', STREAM_NAME, CONSUMER_GROUP, message.id]);
    logger.error(`Order event ${eventId} moved to the dead-letter stream: ${String(error)}`);
  }
}

async function recoverPendingMessages(): Promise<void> {
  const result = await redisClient.sendCommand([
    'XAUTOCLAIM',
    STREAM_NAME,
    CONSUMER_GROUP,
    CONSUMER_NAME,
    '30000',
    '0-0',
    'COUNT',
    '10',
  ]);
  if (!isArray(result) || !isArray(result[1])) {
    return;
  }
  for (const message of parseMessages(result[1])) {
    await handleMessage(message);
  }
}

export class OrderProcessingWorker {
  private running = false;

  public start(): void {
    if (this.running) {
      return;
    }
    this.running = true;

    const poll = async (): Promise<void> => {
      try {
        if (!isRedisAvailable()) {
          return;
        }
        await ensureConsumerGroup();
        await dispatchPendingOrderEvents();
        await recoverPendingMessages();
        const result = await redisClient.sendCommand([
          'XREADGROUP',
          'GROUP',
          CONSUMER_GROUP,
          CONSUMER_NAME,
          'COUNT',
          '10',
          'BLOCK',
          '1000',
          'STREAMS',
          STREAM_NAME,
          '>',
        ]);
        if (isArray(result) && isArray(result[0]) && isArray(result[0][1])) {
          for (const message of parseMessages(result[0][1])) {
            try {
              await handleMessage(message);
            } catch (error) {
              logger.error(`Order stream message ${message.id} was left pending for recovery: ${String(error)}`);
            }
          }
        }
      } catch (error) {
        logger.warn(`Order stream poll failed: ${String(error)}`);
      } finally {
        if (this.running) {
          setTimeout(() => {
            void poll();
          }, isRedisAvailable() ? 250 : 3000);
        }
      }
    };

    void poll();
  }
}
