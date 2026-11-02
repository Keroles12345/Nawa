import http from 'http';
import os from 'os';

export function createHttpInspectorServer(port = 8080): http.Server {
  const startTime = Date.now();

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url ?? '/', 'http://localhost');
    const responseHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Server-Uptime-Ms': String(Date.now() - startTime),
      'X-Platform': os.platform(),
    };

    const payload = {
      method: req.method,
      url: requestUrl.pathname,
      timestamp: new Date().toISOString(),
      serverUptimeMs: Date.now() - startTime,
      platform: os.platform(),
      hostname: os.hostname(),
      status: 200,
    };

    if (req.method === 'GET' && requestUrl.pathname === '/') {
      res.writeHead(200, responseHeaders);
      res.end(JSON.stringify({ ...payload, message: 'HTTP inspector root endpoint', endpoints: ['/api/users', '/api/health'] }, null, 2));
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/users') {
      res.writeHead(200, responseHeaders);
      res.end(JSON.stringify({ ...payload, users: [{ id: '1', name: 'Jane Doe', email: 'jane@example.com' }] }, null, 2));
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/health') {
      res.writeHead(200, responseHeaders);
      res.end(JSON.stringify({ ...payload, status: 'ok', checks: { uptime: process.uptime(), platform: os.platform() } }, null, 2));
      return;
    }

    res.writeHead(404, responseHeaders);
    res.end(JSON.stringify({ ...payload, status: 404, message: 'Not found' }, null, 2));
  });

  server.listen(port);
  return server;
}
