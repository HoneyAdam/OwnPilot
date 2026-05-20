/**
 * Tunnel Routes
 *
 * REST API for managing the Cloudflare tunnel.
 * All endpoints are protected by API key authentication.
 */

import { Hono } from 'hono';
import { getTunnelService } from '../services/tunnel-service.js';

const app = new Hono();

/**
 * GET /api/v1/tunnel
 * Returns current tunnel status.
 */
app.get('/', (c) => {
  const service = getTunnelService();
  const status = service.getStatus();
  return c.json({ ...status });
});

/**
 * GET /api/v1/tunnel/url
 * Returns the tunnel URL if running.
 */
app.get('/url', (c) => {
  const service = getTunnelService();
  const url = service.getUrl();
  if (!url) {
    return c.json({ error: 'Tunnel not running', code: 'TUNNEL_NOT_RUNNING' }, 404);
  }
  return c.json({ url });
});

/**
 * POST /api/v1/tunnel/start
 * Starts the tunnel with optional password override.
 */
app.post('/start', async (c) => {
  const service = getTunnelService();
  const body = (await c.req.json().catch(() => ({}))) as { password?: string };

  try {
    const status = await service.start(body.password);
    return c.json({ url: status.url, status: status.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message, code: 'TUNNEL_START_FAILED' }, 500);
  }
});

/**
 * POST /api/v1/tunnel/stop
 * Stops the tunnel.
 */
app.post('/stop', async (c) => {
  const service = getTunnelService();
  await service.stop();
  return c.json({ status: 'stopped' });
});

/**
 * PUT /api/v1/tunnel/config
 * Updates tunnel configuration for the next start.
 */
app.put('/config', async (c) => {
  const service = getTunnelService();
  const body = (await c.req.json().catch(() => ({}))) as {
    password?: string;
    port?: number;
    hostname?: string;
  };

  service.configure({
    password: body.password,
    port: body.port,
    hostname: body.hostname,
  });

  return c.json({ status: 'configured' });
});

export { app as tunnelRoutes };
