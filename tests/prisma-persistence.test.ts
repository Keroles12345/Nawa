import { randomUUID } from 'crypto';

import { prisma } from '../src/database/prisma';
import { categoryRepository } from '../src/repositories/category.repository';
import { orderRepository } from '../src/repositories/order.repository';
import { productRepository } from '../src/repositories/product.repository';
import { refreshTokenRepository } from '../src/repositories/refreshToken.repository';
import { userRepository } from '../src/repositories/user.repository';
import { Category, Order, OutboxEvent, Product, RefreshTokenRecord, User } from '../src/types';

const runIntegrationTests = process.env.RUN_PRISMA_INTEGRATION === 'true';
const persistenceDescribe = runIntegrationTests ? describe : describe.skip;

persistenceDescribe('Prisma persistence integration', () => {
  const suffix = randomUUID();
  const categoryId = `category-${suffix}`;
  const productId = `product-${suffix}`;
  const userId = `user-${suffix}`;
  const orderId = `order-${suffix}`;
  const tokenHash = `hash-${suffix}`;
  const category: Category = {
    id: categoryId,
    name: `Integration category ${suffix}`,
    description: 'Persistence test category',
    createdAt: new Date().toISOString(),
  };
  const product: Product = {
    id: productId,
    name: 'Persistent product',
    description: 'Product stored in PostgreSQL',
    price: 19.99,
    categoryId,
    inventory: 3,
    createdAt: new Date().toISOString(),
  };
  const user: User = {
    id: userId,
    name: 'Persistence Test',
    email: `persistence-${suffix}@example.test`,
    passwordHash: 'not-used-by-this-test',
    role: 'CUSTOMER',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  afterAll(async () => {
    await prisma.$transaction(async (transaction) => {
      await transaction.orderItem.deleteMany({ where: { orderId } });
      await transaction.order.deleteMany({ where: { id: orderId } });
      await transaction.outboxEvent.deleteMany({ where: { aggregateId: orderId } });
      await transaction.refreshToken.deleteMany({ where: { tokenHash } });
      await transaction.product.deleteMany({ where: { id: productId } });
      await transaction.category.deleteMany({ where: { id: categoryId } });
      await transaction.user.deleteMany({ where: { id: userId } });
    });
    await prisma.$disconnect();
  });

  it('persists CRUD records, hashed refresh tokens, and order outbox events', async () => {
    await categoryRepository.create(category);
    await productRepository.create(product);
    await userRepository.create(user);

    const order: Order = {
      id: orderId,
      userId,
      status: 'PENDING',
      total: 19.99,
      createdAt: new Date().toISOString(),
      items: [{
        id: `item-${suffix}`,
        orderId,
        productId,
        quantity: 1,
        unitPrice: 19.99,
      }],
    };
    const event: OutboxEvent = {
      id: `event-${suffix}`,
      eventType: 'OrderCreated',
      aggregateId: orderId,
      payload: { eventType: 'OrderCreated', orderId, userId, total: order.total },
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    await orderRepository.create(order, event);
    const refreshToken: RefreshTokenRecord = {
      id: `token-${suffix}`,
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      revoked: false,
    };
    await refreshTokenRepository.create(refreshToken);

    expect(await categoryRepository.findById(categoryId)).toMatchObject({ name: category.name });
    expect(await productRepository.findById(productId)).toMatchObject({ price: 19.99 });
    expect(await userRepository.findById(userId)).toMatchObject({ email: user.email });
    expect(await orderRepository.findById(orderId)).toMatchObject({ items: [{ productId, quantity: 1 }] });
    expect(await orderRepository.findPendingOutboxEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: event.id, aggregateId: orderId }),
    ]));
    expect(await refreshTokenRepository.findByTokenHash(tokenHash)).toMatchObject({ userId, tokenHash });
  });
});
