import { randomUUID } from 'crypto';

import { hashPassword } from '../auth/password';
import { config } from '../config';
import { orderRepository } from '../repositories/order.repository';
import { productRepository } from '../repositories/product.repository';
import { userRepository } from '../repositories/user.repository';
import { Order, User } from '../types';

const demoCustomers = [
  { name: 'Sarah Johnson', email: 'sarah@example.test' },
  { name: 'Omar Hassan', email: 'omar@example.test' },
  { name: 'Mia Chen', email: 'mia@example.test' },
];

export async function seedDemoData(): Promise<void> {
  if (config.nodeEnv === 'production') {
    return;
  }

  const now = new Date().toISOString();
  const customerIds = new Map<string, string>();

  for (const customer of demoCustomers) {
    const existing = await userRepository.findByEmail(customer.email);
    if (existing) {
      customerIds.set(customer.email, existing.id);
      continue;
    }

    const user: User = {
      id: randomUUID(),
      ...customer,
      passwordHash: await hashPassword('DemoPass123'),
      role: 'CUSTOMER',
      createdAt: now,
      updatedAt: now,
    };
    await userRepository.create(user);
    customerIds.set(customer.email, user.id);
  }

  const products = await productRepository.findAll();
  const laptop = products.find((product) => product.id === 'product-laptop');
  const book = products.find((product) => product.id === 'product-book');
  if (!laptop || !book) {
    throw new Error('Cannot seed demo orders: expected demo products are missing');
  }

  const existingOrders = await orderRepository.findAll();
  if (existingOrders.some((order) => order.id.startsWith('demo-order-'))) {
    return;
  }

  const orders: Array<{ email: string; status: Order['status']; daysAgo: number; items: Array<{ productId: string; quantity: number; price: number }> }> = [
    { email: 'sarah@example.test', status: 'PROCESSING', daysAgo: 1, items: [{ productId: laptop.id, quantity: 1, price: laptop.price }] },
    { email: 'omar@example.test', status: 'SHIPPED', daysAgo: 3, items: [{ productId: book.id, quantity: 2, price: book.price }] },
    { email: 'mia@example.test', status: 'PENDING', daysAgo: 0, items: [{ productId: laptop.id, quantity: 1, price: laptop.price }, { productId: book.id, quantity: 1, price: book.price }] },
  ];

  for (const [index, orderData] of orders.entries()) {
    const createdAt = new Date(Date.now() - orderData.daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const orderId = `demo-order-${index + 1}`;
    const userId = customerIds.get(orderData.email);
    if (!userId) {
      throw new Error(`Cannot seed demo order: customer ${orderData.email} is missing`);
    }
    const items = orderData.items.map((item) => ({
      id: randomUUID(),
      orderId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.price,
    }));
    const order: Order = {
      id: orderId,
      userId,
      status: orderData.status,
      total: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      items,
      createdAt,
    };
    await orderRepository.create(order);
  }
}
