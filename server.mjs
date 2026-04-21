// Passenger entry for bolt.diy on cPanel (CloudLinux Node.js selector).
// Spawns `wrangler pages dev` on an internal loopback port, then exposes
// Passenger's $PORT as an HTTP+WS reverse proxy in front of it.
//
// Used by vibe.capetivate.dev under the `capetivatedev` cPanel account.
// Referenced by /public/.htaccess via `PassengerStartupFile server.mjs`.

import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PASSENGER_PORT = parseInt(process.env.PORT || '3000', 10);
const INTERNAL_PORT = parseInt(process.env.WRANGLER_INTERNAL_PORT || '18787', 10);

console.log(`[bolt.diy] passenger_port=${PASSENGER_PORT} internal_port=${INTERNAL_PORT}`);

// --- spawn wrangler pages dev as a child process ---
const wranglerBin = path.join(__dirname, 'node_modules', '.bin', 'wrangler');
const wrangler = spawn(
  wranglerBin,
  [
    'pages',
    'dev',
    './build/client',
    '--ip',
    '127.0.0.1',
    '--port',
    String(INTERNAL_PORT),
    '--no-show-interactive-dev-session',
  ],
  {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  },
);

wrangler.on('exit', (code, signal) => {
  console.error(`[bolt.diy] wrangler exited code=${code} signal=${signal}`);
  process.exit(code ?? 1);
});

// --- probe wrangler readiness so we can start serving real traffic ---
let wranglerReady = false;

function probe() {
  const req = http.request(
    {
      host: '127.0.0.1',
      port: INTERNAL_PORT,
      path: '/',
      method: 'HEAD',
      timeout: 1500,
    },
    () => {
      wranglerReady = true;
      console.log('[bolt.diy] wrangler is ready');
    },
  );
  req.on('error', () => setTimeout(probe, 1000));
  req.on('timeout', () => {
    req.destroy();
    setTimeout(probe, 1000);
  });
  req.end();
}

setTimeout(probe, 1500);

// --- HTTP reverse proxy ---
const server = http.createServer((req, res) => {
  if (!wranglerReady) {
    res.writeHead(503, { 'Content-Type': 'text/plain', 'Retry-After': '5' });
    res.end('bolt.diy starting, retry in a moment\n');
    return;
  }

  const proxyReq = http.request(
    {
      host: '127.0.0.1',
      port: INTERNAL_PORT,
      method: req.method,
      path: req.url,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
    }

    res.end(`proxy error: ${err.message}\n`);
  });

  req.pipe(proxyReq);
});

// --- WebSocket upgrade proxy ---
server.on('upgrade', (req, socket, head) => {
  const proxyReq = http.request({
    host: '127.0.0.1',
    port: INTERNAL_PORT,
    path: req.url,
    method: 'GET',
    headers: req.headers,
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    const statusLine = `HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}`;
    const headerLines = Object.entries(proxyRes.headers)
      .map(([k, v]) => (Array.isArray(v) ? v.map((vv) => `${k}: ${vv}`).join('\r\n') : `${k}: ${v}`))
      .join('\r\n');
    socket.write(`${statusLine}\r\n${headerLines}\r\n\r\n`);

    if (proxyHead && proxyHead.length) {
      socket.write(proxyHead);
    }

    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on('error', () => socket.destroy());
  proxyReq.end(head);
});

server.listen(PASSENGER_PORT, '0.0.0.0', () => {
  console.log(`[bolt.diy] proxy listening on ${PASSENGER_PORT}`);
});

// --- graceful shutdown ---
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`[bolt.diy] ${sig} received, shutting down`);
    server.close();
    wrangler.kill(sig);
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
