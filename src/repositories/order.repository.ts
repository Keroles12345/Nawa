import { Order, OrderItem, OrderStatus } from '../types';
import { inMemoryOrders } from './inMemoryStore';

export const orderRepository = {
  findAll: async (): Promise<Order[]> => [...inMemoryOrders],
  findById: async (id: string): Promise<Order | undefined> => inMemoryOrders.find((order) => order.id === id),
  updateStatus: async (id: string, status: OrderStatus): Promise<Order | undefined> => {
    const order = inMemoryOrders.find((entry) => entry.id === id);
    if (!order) {
      return undefined;
    }
    order.status = status;
    return order;
  },
  update: async (order: Order): Promise<Order | undefined> => {
    const index = inMemoryOrders.findIndex((entry) => entry.id === order.id);
    if (index < 0) {
      return undefined;
    }
    inMemoryOrders[index] = order;
    return order;
  },
  delete: async (id: string): Promise<boolean> => {
    const index = inMemoryOrders.findIndex((order) => order.id === id);
    if (index < 0) {
      return false;
    }
    inMemoryOrders.splice(index, 1);
    return true;
  },
  create: async (order: Order): Promise<Order> => {
    inMemoryOrders.push(order);
    return order;
  },
  createItem: async (item: OrderItem): Promise<OrderItem> => {
    const order = inMemoryOrders.find((entry) => entry.id === item.orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    order.items.push(item);
    return item;
  },
};
