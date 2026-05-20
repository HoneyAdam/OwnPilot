/**
 * Tunnel Routes Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { tunnelRoutes } from './tunnel.js';

describe('TunnelRoutes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/v1/tunnel', tunnelRoutes);
  });

  describe('GET /api/v1/tunnel', () => {
    it('should return tunnel status', async () => {
      const res = await app.request('/api/v1/tunnel');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('status');
      expect(['stopped', 'starting', 'running', 'error']).toContain(json.status);
    });
  });

  describe('GET /api/v1/tunnel/url', () => {
    it('should return 404 when tunnel not running', async () => {
      const res = await app.request('/api/v1/tunnel/url');
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.code).toBe('TUNNEL_NOT_RUNNING');
    });
  });

  describe('POST /api/v1/tunnel/stop', () => {
    it('should stop tunnel and return stopped status', async () => {
      const res = await app.request('/api/v1/tunnel/stop', { method: 'POST' });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('stopped');
    });
  });

  describe('PUT /api/v1/tunnel/config', () => {
    it('should accept configuration update', async () => {
      const res = await app.request('/api/v1/tunnel/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: 9000, password: 'test123' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('configured');
    });
  });
});
