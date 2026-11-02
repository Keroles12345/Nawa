import request from 'supertest';

import { generateAccessToken } from '../src/auth/jwt';
import { createApp } from '../src/app';
import { config } from '../src/config';
import { ensureBootstrapAdmin } from '../src/services/auth.service';

describe('E-commerce API', () => {
  it('should return health status', async () => {
    const app = createApp();
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
  });

  it('should return a list of products', async () => {
    const app = createApp();
    const response = await request(app).get('/api/products');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('should serve the dashboard and protect administrative order data', async () => {
    const app = createApp();
    const dashboardResponse = await request(app).get('/');
    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.text).toContain('Nawa');

    const unauthorizedResponse = await request(app).get('/api/orders');
    expect(unauthorizedResponse.status).toBe(401);

    const adminToken = generateAccessToken({
      id: 'dashboard-admin',
      email: 'dashboard-admin@example.com',
      role: 'ADMIN',
    });
    const authorizedResponse = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(authorizedResponse.status).toBe(200);
    expect(Array.isArray(authorizedResponse.body.data)).toBe(true);
  });

  it('should allow staff to manage orders and users but not products or categories', async () => {
    const app = createApp();
    const staffToken = generateAccessToken({
      id: 'dashboard-staff',
      email: 'dashboard-staff@example.test',
      role: 'STAFF',
    });
    const auth = { Authorization: `Bearer ${staffToken}` };

    expect((await request(app).get('/api/orders').set(auth)).status).toBe(200);
    expect((await request(app).get('/api/users').set(auth)).status).toBe(200);
    expect((await request(app).post('/api/products').set(auth).send({})).status).toBe(403);
    expect((await request(app).post('/api/categories').set(auth).send({})).status).toBe(403);

    const customer = await request(app)
      .post('/api/users')
      .set(auth)
      .send({ name: 'Staff Created Customer', email: 'staff.customer@example.test', password: 'CustomerPass123' });
    expect(customer.status).toBe(201);
    expect(customer.body.data.role).toBe('CUSTOMER');
    expect(customer.body.data.passwordHash).toBeUndefined();

    const staffCreatedOrder = await request(app)
      .post('/api/orders')
      .set(auth)
      .send({ userId: customer.body.data.id, items: [{ productId: 'product-book', quantity: 1 }] });
    expect(staffCreatedOrder.status).toBe(202);
    expect(staffCreatedOrder.body.data.order.userId).toBe(customer.body.data.id);

    const teamAdmin = await request(app)
      .post('/api/users/staff')
      .set(auth)
      .send({ name: 'Staff Created Admin', email: 'staff.admin@example.test', password: 'AdminPass123', role: 'ADMIN' });
    expect(teamAdmin.status).toBe(201);
    expect(teamAdmin.body.data.role).toBe('ADMIN');
    expect(teamAdmin.body.data.passwordHash).toBeUndefined();

    const invalidTeamRole = await request(app)
      .post('/api/users/staff')
      .set(auth)
      .send({ name: 'Invalid Role', email: 'invalid.role@example.test', password: 'AdminPass123', role: 'CUSTOMER' });
    expect(invalidTeamRole.status).toBe(400);

    const customerToken = generateAccessToken({
      id: 'limited-customer',
      email: 'limited-customer@example.test',
      role: 'CUSTOMER',
    });
    const forbiddenTeamAccount = await request(app)
      .post('/api/users/staff')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Customer Admin', email: 'customer.admin@example.test', password: 'AdminPass123', role: 'ADMIN' });
    expect(forbiddenTeamAccount.status).toBe(403);
  });

  it('should create the configured bootstrap admin account', async () => {
    const previousEmail = config.bootstrapAdminEmail;
    const previousPassword = config.bootstrapAdminPassword;
    config.bootstrapAdminEmail = 'bootstrap-admin@example.test';
    config.bootstrapAdminPassword = 'BootstrapPass123';

    try {
      await ensureBootstrapAdmin();
      const response = await request(createApp())
        .post('/api/auth/login')
        .send({ email: config.bootstrapAdminEmail, password: config.bootstrapAdminPassword });

      expect(response.status).toBe(200);
      expect(response.body.data.user.role).toBe('ADMIN');

      const adminToken = response.body.data.accessToken as string;
      const createdCustomer = await request(createApp())
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Created Customer', email: 'admin.created@example.test', password: 'CustomerPass123' });
      expect(createdCustomer.status).toBe(201);
      expect(createdCustomer.body.data.role).toBe('CUSTOMER');
      expect(createdCustomer.body.data.passwordHash).toBeUndefined();

      const duplicateCustomer = await request(createApp())
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Duplicate Customer', email: 'ADMIN.CREATED@example.test', password: 'CustomerPass123' });
      expect(duplicateCustomer.status).toBe(409);

      const invalidCustomer = await request(createApp())
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'X', email: 'invalid-email', password: 'short' });
      expect(invalidCustomer.status).toBe(400);

      const customerCannotCreateAccounts = await request(createApp())
        .post('/api/users')
        .set('Authorization', `Bearer ${generateAccessToken({
          id: 'regular-customer',
          email: 'regular.customer@example.test',
          role: 'CUSTOMER',
        })}`)
        .send({ name: 'Unauthorized Customer', email: 'unauthorized@example.test', password: 'CustomerPass123' });
      expect(customerCannotCreateAccounts.status).toBe(403);

      const adminCannotPlaceOrderAsCustomer = await request(createApp())
        .post('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: response.body.data.user.id, items: [{ productId: 'product-book', quantity: 1 }] });
      expect(adminCannotPlaceOrderAsCustomer.status).toBe(400);

      const orderResponse = await request(createApp())
        .post('/api/orders')
        .set('Authorization', `Bearer ${response.body.data.accessToken}`)
        .send({ userId: createdCustomer.body.data.id, items: [{ productId: 'product-book', quantity: 1 }] });
      expect(orderResponse.status).toBe(202);

      const updateResponse = await request(createApp())
        .patch(`/api/orders/${orderResponse.body.data.order.id}/status`)
        .set('Authorization', `Bearer ${response.body.data.accessToken}`)
        .send({ status: 'PROCESSING' });
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.status).toBe('PROCESSING');

      const invalidUpdateResponse = await request(createApp())
        .patch(`/api/orders/${orderResponse.body.data.order.id}/status`)
        .set('Authorization', `Bearer ${response.body.data.accessToken}`)
        .send({ status: 'UNKNOWN' });
      expect(invalidUpdateResponse.status).toBe(400);

      const missingCustomerOrder = await request(createApp())
        .post('/api/orders')
        .set('Authorization', `Bearer ${response.body.data.accessToken}`)
        .send({ items: [{ productId: 'product-book', quantity: 1 }] });
      expect(missingCustomerOrder.status).toBe(400);

      const customerResponse = await request(createApp())
        .post('/api/auth/register')
        .send({ name: 'Order Customer', email: 'order.customer@example.test', password: 'CustomerPass123' });
      expect(customerResponse.status).toBe(201);
      const customerToken = customerResponse.body.data.accessToken as string;
      const customerOrderResponse = await request(createApp())
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          userId: response.body.data.user.id,
          items: [{ productId: 'product-book', quantity: 2 }],
        });
      expect(customerOrderResponse.status).toBe(202);
      expect(customerOrderResponse.body.data.order.userId).toBe(customerResponse.body.data.user.id);

      const forbiddenEdit = await request(createApp())
        .put(`/api/orders/${orderResponse.body.data.order.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'SHIPPED' });
      const forbiddenDelete = await request(createApp())
        .delete(`/api/orders/${orderResponse.body.data.order.id}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(forbiddenEdit.status).toBe(403);
      expect(forbiddenDelete.status).toBe(403);

      const emptyUpdate = await request(createApp())
        .put(`/api/orders/${orderResponse.body.data.order.id}`)
        .set('Authorization', `Bearer ${response.body.data.accessToken}`)
        .send({});
      expect(emptyUpdate.status).toBe(400);

      const fullUpdate = await request(createApp())
        .put(`/api/orders/${orderResponse.body.data.order.id}`)
        .set('Authorization', `Bearer ${response.body.data.accessToken}`)
        .send({
          userId: customerResponse.body.data.user.id,
          items: [{ productId: 'product-laptop', quantity: 2 }],
          status: 'SHIPPED',
        });
      expect(fullUpdate.status).toBe(200);
      expect(fullUpdate.body.data.userId).toBe(customerResponse.body.data.user.id);
      expect(fullUpdate.body.data.status).toBe('SHIPPED');
      expect(fullUpdate.body.data.total).toBeCloseTo(2599.98);

      const deleted = await request(createApp())
        .delete(`/api/orders/${orderResponse.body.data.order.id}`)
        .set('Authorization', `Bearer ${response.body.data.accessToken}`);
      expect(deleted.status).toBe(200);
      const missingOrder = await request(createApp())
        .put(`/api/orders/${orderResponse.body.data.order.id}`)
        .set('Authorization', `Bearer ${response.body.data.accessToken}`)
        .send({ status: 'COMPLETED' });
      expect(missingOrder.status).toBe(404);
    } finally {
      config.bootstrapAdminEmail = previousEmail;
      config.bootstrapAdminPassword = previousPassword;
    }
  });

  it('should allow registration and login', async () => {
    const app = createApp();

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Demo User',
        email: 'demo.user@example.com',
        password: 'StrongPass123',
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.success).toBe(true);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'demo.user@example.com',
        password: 'StrongPass123',
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.data.accessToken).toBeDefined();
  });
});
