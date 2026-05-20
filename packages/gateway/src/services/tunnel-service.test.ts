/**
 * Tunnel Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTunnelService } from './tunnel-service.js';

describe('TunnelService', () => {
  let service: ReturnType<typeof getTunnelService>;

  beforeEach(() => {
    service = getTunnelService();
  });

  afterEach(async () => {
    await service.stop();
  });

  describe('getStatus()', () => {
    it('should return stopped status initially', () => {
      const status = service.getStatus();
      expect(status.status).toBe('stopped');
      expect(status.url).toBeNull();
    });
  });

  describe('getUrl()', () => {
    it('should return null when tunnel is not running', () => {
      expect(service.getUrl()).toBeNull();
    });
  });

  describe('configure()', () => {
    it('should accept port configuration', () => {
      service.configure({ port: 3000 });
      const status = service.getStatus();
      expect(status.status).toBe('stopped');
    });

    it('should accept password configuration', () => {
      service.configure({ password: 'secret123' });
      // No status change expected for config-only
      expect(service.getStatus().status).toBe('stopped');
    });

    it('should accept hostname configuration', () => {
      service.configure({ hostname: 'my-tunnel.example.com' });
      expect(service.getStatus().status).toBe('stopped');
    });
  });
});
