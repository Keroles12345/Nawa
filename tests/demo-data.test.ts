import { config } from '../src/config';
import { orderRepository } from '../src/repositories/order.repository';
import { userRepository } from '../src/repositories/user.repository';
import { seedDemoData } from '../src/services/demo-data.service';

describe('demo data seeding', () => {
  it('seeds test customers and orders only outside production and remains idempotent', async () => {
    const previousNodeEnv = config.nodeEnv;

    try {
      config.nodeEnv = 'production';
      await seedDemoData();
      expect((await userRepository.findAll()).filter((user) => user.email.endsWith('@example.test'))).toHaveLength(0);

      config.nodeEnv = 'development';
      await seedDemoData();
      await seedDemoData();

      const users = await userRepository.findAll();
      const orders = await orderRepository.findAll();
      expect(users.filter((user) => user.email.endsWith('@example.test'))).toHaveLength(3);
      expect(orders.filter((order) => order.id.startsWith('demo-order-'))).toHaveLength(3);
      expect(orders.every((order) => users.some((user) => user.id === order.userId && user.role === 'CUSTOMER'))).toBe(true);
    } finally {
      config.nodeEnv = previousNodeEnv;
    }
  });
});
