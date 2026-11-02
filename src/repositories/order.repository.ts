import { Order, OrderItem, OrderStatus, OutboxEvent } from '../types';
import { Prisma } from '@prisma/client';
import { prisma, usePrisma } from '../database/prisma';
import { inMemoryOrders, inMemoryOutboxEvents, inMemoryProcessedEvents } from './inMemoryStore';

type PrismaOrder = Prisma.OrderGetPayload<{ include: { items: true } }>;

function mapOrder(order: PrismaOrder): Order {
  return {
    id: order.id,
    userId: order.userId,
    status: order.status,
    total: order.total.toNumber(),
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toNumber(),
    })),
  };
}

function mapOutboxEvent(event: {
  id: string;
  eventType: string;
  aggregateId: string;
  payload: unknown;
  createdAt: Date;
  publishedAt: Date | null;
  attempts: number;
}): OutboxEvent {
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
    throw new Error(`Outbox event ${event.id} contains an invalid payload`);
  }
  const payload: OutboxEvent['payload'] = {};
  for (const [key, value] of Object.entries(event.payload)) {
    if (value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new Error(`Outbox event ${event.id} contains a non-scalar payload value`);
    }
    payload[key] = value;
  }
  return {
    ...event,
    payload,
    createdAt: event.createdAt.toISOString(),
    publishedAt: event.publishedAt?.toISOString(),
  };
}

export const orderRepository = {
  findAll: async (): Promise<Order[]> => {
    if (usePrisma) {
      const orders = await prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } });
      return orders.map(mapOrder);
    }
    return [...inMemoryOrders];
  },
  findById: async (id: string): Promise<Order | undefined> => {
    if (usePrisma) {
      const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
      return order ? mapOrder(order) : undefined;
    }
    return inMemoryOrders.find((order) => order.id === id);
  },
  updateStatus: async (id: string, status: OrderStatus): Promise<Order | undefined> => {
    if (usePrisma) {
      const existing = await prisma.order.findUnique({ where: { id } });
      if (!existing) {
        return undefined;
      }
      return mapOrder(await prisma.order.update({
        where: { id },
        data: { status },
        include: { items: true },
      }));
    }
    const order = inMemoryOrders.find((entry) => entry.id === id);
    if (!order) {
      return undefined;
    }
    order.status = status;
    return order;
  },
  update: async (order: Order): Promise<Order | undefined> => {
    if (usePrisma) {
      const exists = await prisma.order.findUnique({ where: { id: order.id }, select: { id: true } });
      if (!exists) {
        return undefined;
      }
      return prisma.$transaction(async (transaction) => {
        await transaction.orderItem.deleteMany({ where: { orderId: order.id } });
        const updated = await transaction.order.update({
          where: { id: order.id },
          data: {
            userId: order.userId,
            status: order.status,
            total: order.total,
            items: {
              create: order.items.map(({ productId, quantity, unitPrice }) => ({ productId, quantity, unitPrice })),
            },
          },
          include: { items: true },
        });
        return mapOrder(updated);
      });
    }
    const index = inMemoryOrders.findIndex((entry) => entry.id === order.id);
    if (index < 0) {
      return undefined;
    }
    inMemoryOrders[index] = order;
    return order;
  },
  delete: async (id: string): Promise<boolean> => {
    if (usePrisma) {
      return prisma.$transaction(async (transaction) => {
        await transaction.orderItem.deleteMany({ where: { orderId: id } });
        const removed = await transaction.order.deleteMany({ where: { id } });
        return removed.count > 0;
      });
    }
    const index = inMemoryOrders.findIndex((order) => order.id === id);
    if (index < 0) {
      return false;
    }
    inMemoryOrders.splice(index, 1);
    return true;
  },
  create: async (order: Order, event?: OutboxEvent): Promise<Order> => {
    if (usePrisma) {
      return prisma.$transaction(async (transaction) => {
        const created = await transaction.order.create({
          data: {
            id: order.id,
            userId: order.userId,
            status: order.status,
            total: order.total,
            createdAt: new Date(order.createdAt),
            items: {
              create: order.items.map(({ id, productId, quantity, unitPrice }) => ({
                id,
                productId,
                quantity,
                unitPrice,
              })),
            },
          },
          include: { items: true },
        });
        if (event) {
          await transaction.outboxEvent.create({
            data: {
              id: event.id,
              eventType: event.eventType,
              aggregateId: event.aggregateId,
              payload: event.payload,
              createdAt: new Date(event.createdAt),
            },
          });
        }
        return mapOrder(created);
      });
    }
    inMemoryOrders.push(order);
    if (event) {
      inMemoryOutboxEvents.push(event);
    }
    return order;
  },
  createItem: async (item: OrderItem): Promise<OrderItem> => {
    if (usePrisma) {
      const created = await prisma.orderItem.create({
        data: {
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        },
      });
      return {
        ...created,
        unitPrice: created.unitPrice.toNumber(),
      };
    }
    const order = inMemoryOrders.find((entry) => entry.id === item.orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    order.items.push(item);
    return item;
  },
  findPendingOutboxEvents: async (limit = 50): Promise<OutboxEvent[]> => {
    if (usePrisma) {
      const events = await prisma.outboxEvent.findMany({
        where: { publishedAt: null },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      return events.map(mapOutboxEvent);
    }
    return inMemoryOutboxEvents.filter((event) => !event.publishedAt).slice(0, limit);
  },
  markOutboxEventPublished: async (id: string): Promise<void> => {
    if (usePrisma) {
      await prisma.outboxEvent.update({ where: { id }, data: { publishedAt: new Date() } });
      return;
    }
    const event = inMemoryOutboxEvents.find((entry) => entry.id === id);
    if (event) {
      event.publishedAt = new Date().toISOString();
    }
  },
  recordOutboxAttempt: async (id: string): Promise<void> => {
    if (usePrisma) {
      await prisma.outboxEvent.update({ where: { id }, data: { attempts: { increment: 1 } } });
      return;
    }
    const event = inMemoryOutboxEvents.find((entry) => entry.id === id);
    if (event) {
      event.attempts += 1;
    }
  },
  isEventProcessed: async (eventId: string): Promise<boolean> => {
    if (usePrisma) {
      return Boolean(await prisma.processedEvent.findUnique({ where: { eventId }, select: { eventId: true } }));
    }
    return inMemoryProcessedEvents.has(eventId);
  },
  markEventProcessed: async (eventId: string): Promise<void> => {
    if (usePrisma) {
      await prisma.processedEvent.create({ data: { eventId } });
      return;
    }
    inMemoryProcessedEvents.add(eventId);
  },
};
