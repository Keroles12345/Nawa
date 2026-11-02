import { randomUUID } from 'crypto';

import { productRepository } from '../repositories/product.repository';
import { orderRepository } from '../repositories/order.repository';
import { userRepository } from '../repositories/user.repository';
import { Order, OrderInput, OrderStatus } from '../types';
import { publishOrderCreated } from '../events/redis-streams';

export async function createOrder(input: OrderInput): Promise<{ order: Order; accepted: boolean }> {
  if (!input.userId) {
    throw new Error('Order customer is required');
  }
  if (!input.items || input.items.length === 0) {
    throw new Error('Order must contain at least one item');
  }
  const customer = await userRepository.findById(input.userId);
  if (!customer || customer.role !== 'CUSTOMER') {
    throw new Error('A valid customer account is required to place an order');
  }

  const { items, total } = await buildOrderItems(input.items);
  const createdAt = new Date().toISOString();
  const order: Order = {
    id: randomUUID(),
    userId: input.userId,
    status: 'PENDING',
    total,
    items: [],
    createdAt,
  };

  order.items = items.map((item) => ({ ...item, orderId: order.id }));

  await orderRepository.create(order);
  await publishOrderCreated(order);

  return { order, accepted: true };
}

export async function listOrders(): Promise<Order[]> {
  return orderRepository.findAll();
}

export async function listUserOrders(userId: string): Promise<Order[]> {
  const orders = await orderRepository.findAll();
  return orders.filter((order) => order.userId === userId);
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order | undefined> {
  return orderRepository.updateStatus(id, status);
}

export async function updateOrder(id: string, input: { userId?: string; items?: OrderInput['items']; status?: OrderStatus }): Promise<Order | undefined> {
  const existing = await orderRepository.findById(id);
  if (!existing) {
    return undefined;
  }
  if (input.userId) {
    const customer = await userRepository.findById(input.userId);
    if (!customer || customer.role !== 'CUSTOMER') {
      throw new Error('A valid customer account is required to place an order');
    }
  }

  const { items, total } = input.items
    ? await buildOrderItems(input.items)
    : { items: existing.items, total: existing.total };
  return orderRepository.update({
    ...existing,
    userId: input.userId ?? existing.userId,
    status: input.status ?? existing.status,
    items: items.map((item) => ({ ...item, orderId: id })),
    total,
  });
}

export async function deleteOrder(id: string): Promise<boolean> {
  return orderRepository.delete(id);
}

async function buildOrderItems(inputItems: OrderInput['items']): Promise<{ items: Order['items']; total: number }> {
  let total = 0;
  const items: Order['items'] = [];

  for (const item of inputItems) {
    const product = await productRepository.findById(item.productId);
    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }
    if (product.inventory < item.quantity) {
      throw new Error(`Product ${item.productId} does not have enough inventory`);
    }

    total += product.price * item.quantity;
    items.push({
      id: randomUUID(),
      orderId: '',
      productId: product.id,
      quantity: item.quantity,
      unitPrice: product.price,
    });
  }
  return { items, total };
}
