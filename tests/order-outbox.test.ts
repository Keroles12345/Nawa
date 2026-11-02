import { randomUUID } from 'crypto';

import { inMemoryOrders, inMemoryOutboxEvents, inMemoryUsers } from '../src/repositories/inMemoryStore';
import * as redisState from '../src/cache/redisClient';
import { createOrder } from '../src/services/order.service';
import { User } from '../src/types';

describe('Order outbox', () => {
  it('keeps the OrderCreated event durable when Redis is unavailable', async () => {
    const redisAvailability = jest.spyOn(redisState, 'isRedisAvailable').mockReturnValue(false);
    const userId = randomUUID();
    const user: User = {
      id: userId,
      name: 'Outbox Test',
      email: `outbox-${userId}@example.test`,
      passwordHash: 'not-used-by-this-test',
      role: 'CUSTOMER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemoryUsers.push(user);

    try {
      const { order } = await createOrder({
        userId,
        items: [{ productId: 'product-book', quantity: 1 }],
      });
      const event = inMemoryOutboxEvents.find((entry) => entry.aggregateId === order.id);

      expect(inMemoryOrders.some((entry) => entry.id === order.id)).toBe(true);
      expect(event?.eventType).toBe('OrderCreated');
      expect(event?.publishedAt).toBeUndefined();
      expect(event?.payload).toMatchObject({ orderId: order.id, userId });
    } finally {
      redisAvailability.mockRestore();
      const createdOrder = inMemoryOrders.find((entry) => entry.userId === userId);
      if (createdOrder) {
        inMemoryOrders.splice(inMemoryOrders.indexOf(createdOrder), 1);
        const outboxIndex = inMemoryOutboxEvents.findIndex((entry) => entry.aggregateId === createdOrder.id);
        if (outboxIndex >= 0) {
          inMemoryOutboxEvents.splice(outboxIndex, 1);
        }
      }
      inMemoryUsers.splice(inMemoryUsers.indexOf(user), 1);
    }
  });
});
