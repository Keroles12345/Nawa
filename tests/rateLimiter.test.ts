import express from 'express';
import request from 'supertest';

import { redisRateLimiter } from '../src/middlewares/rateLimiter';

describe('API rate limiter', () => {
  it('does not count dashboard page requests and still limits API requests', async () => {
    const app = express();
    app.set('trust proxy', true);
    app.use(redisRateLimiter(60_000, 1));
    app.get('/', (_req, res) => res.status(200).send('Dashboard'));
    app.get('/api/test', (_req, res) => res.status(200).json({ success: true }));
    const clientIp = `10.250.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

    expect((await request(app).get('/').set('X-Forwarded-For', clientIp)).status).toBe(200);
    expect((await request(app).get('/').set('X-Forwarded-For', clientIp)).status).toBe(200);
    expect((await request(app).get('/api/test').set('X-Forwarded-For', clientIp)).status).toBe(200);
    expect((await request(app).get('/api/test').set('X-Forwarded-For', clientIp)).status).toBe(429);
  });
});
