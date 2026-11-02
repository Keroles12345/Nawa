import http from 'http';
import os from 'os';

function readRequestBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();

      if (!raw) {
        resolve({});
        return;
      }

      const contentType = req.headers['content-type'] ?? '';
      if (!contentType.includes('application/json')) {
        resolve(raw);
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Malformed JSON body'));
      }
    });

    req.on('error', (error) => reject(error));
  });
}

export function createHttpInspectorServer(port = 8080): http.Server {
  const startTime = Date.now();

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', 'http://localhost');
    const responseHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Server-Uptime-Ms': String(Date.now() - startTime),
      'X-Platform': os.platform(),
    };

    const payload: Record<string, unknown> = {
      method: req.method,
      url: requestUrl.pathname,
      timestamp: new Date().toISOString(),
      serverUptimeMs: Date.now() - startTime,
      platform: os.platform(),
      hostname: os.hostname(),
      headers: req.headers,
    };

    try {
      if (['POST', 'PUT', 'PATCH'].includes(req.method ?? '') && req.headers['content-length'] !== '0') {
        const body = await readRequestBody(req);
        payload['body'] = body;
      }
    } catch (error) {
      res.writeHead(400, responseHeaders);
      res.end(JSON.stringify({ ...payload, success: false, message: 'Malformed JSON body' }, null, 2));
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/') {
      res.writeHead(200, responseHeaders);
      res.end(JSON.stringify({ ...payload, success: true, message: 'HTTP inspector root endpoint', endpoints: ['/api/users', '/api/health'] }, null, 2));
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/users') {
      res.writeHead(200, responseHeaders);
      res.end(JSON.stringify({ ...payload, success: true, users: [{ id: '1', name: 'Jane Doe', email: 'jane@example.com' }] }, null, 2));
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/health') {
      res.writeHead(200, responseHeaders);
      res.end(JSON.stringify({ ...payload, success: true, status: 'ok', checks: { uptime: process.uptime(), platform: os.platform() } }, null, 2));
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/uptime') {
      res.writeHead(200, responseHeaders);
      res.end(JSON.stringify({ ...payload, success: true, uptime: process.uptime(), startedAt: new Date(startTime).toISOString() }, null, 2));
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/health') {
      res.writeHead(200, responseHeaders);
      res.end(JSON.stringify({ ...payload, success: true, status: 'ok', uptime: process.uptime() }, null, 2));
      return;
    }

    res.writeHead(404, responseHeaders);
    res.end(JSON.stringify({ ...payload, success: false, status: 404, message: 'Not found' }, null, 2));
  });

  server.listen(port);
  return server;
}
