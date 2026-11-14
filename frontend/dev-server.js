'use strict';

// Local development server: frontend files and service APIs share localhost:5500.
// No third-party dependencies; not intended for public deployment.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 5500;
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function proxy(req, res, pathname, port, prefix) {
  const targetPath = pathname.slice(prefix.length) || '/';
  const suffix = new URL(req.url, 'http://localhost').search;
  const upstream = http.request({
    hostname: '127.0.0.1',
    port,
    method: req.method,
    path: targetPath + suffix,
    headers: { ...req.headers, host: `127.0.0.1:${port}` },
    timeout: 5000,
  }, (upstreamResponse) => {
    res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy(new Error('Upstream request timed out')));
  upstream.on('error', (error) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: `Service on port ${port} unavailable` }));
    } else {
      res.destroy(error);
    }
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400); res.end('Bad request'); return;
  }
  if (pathname === '/api/pets' || pathname.startsWith('/api/pets/')) {
    return proxy(req, res, pathname, 3001, '/api');
  }
  if (pathname === '/api/enclosures' || pathname.startsWith('/api/enclosures/')) {
    return proxy(req, res, pathname, 3002, '/api');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return;
  }
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const requested = path.resolve(ROOT, relativePath);
  if (!requested.startsWith(ROOT + path.sep) || relativePath.split(/[\\/]/).some(part => part.startsWith('.'))) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(requested, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(requested).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(requested).pipe(res);
  });
});

server.on('error', (error) => {
  console.error(`Could not start development server: ${error.message}`);
  process.exitCode = 1;
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Frontend + API proxy running at http://localhost:${PORT}`);
  console.log('Routes: /api/pets -> :3001/pets; /api/enclosures -> :3002/enclosures');
});
