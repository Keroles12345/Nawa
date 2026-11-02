import request from 'supertest';

import { createHttpInspectorServer } from '../src/http-inspector/server';

describe('HTTP inspector server', () => {
  it('should serve the expected endpoints with JSON responses', async () => {
    const server = createHttpInspectorServer(0);

    try {
      const rootResponse = await request(server).get('/');
      const healthResponse = await request(server).get('/api/health');
      const usersResponse = await request(server).get('/api/users');

      expect(rootResponse.status).toBe(200);
      expect(healthResponse.status).toBe(200);
      expect(usersResponse.status).toBe(200);
      expect(rootResponse.headers['content-type']).toContain('application/json');
    } finally {
      server.close();
    }
  });
});
