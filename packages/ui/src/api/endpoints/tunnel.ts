/**
 * Tunnel API Endpoints
 */

import { apiClient } from '../client';

export interface TunnelStatus {
  status: 'stopped' | 'starting' | 'running' | 'error';
  url?: string | null;
  error?: string | null;
  startedAt?: string | null;
}

export interface TunnelStartResponse {
  url: string;
  status: string;
}

export interface TunnelConfig {
  password?: string;
  port?: number;
  hostname?: string;
}

export const tunnelApi = {
  getStatus: () => apiClient.get<TunnelStatus>('/tunnel'),

  getUrl: () => apiClient.get<{ url: string }>('/tunnel/url'),

  start: (password?: string) => apiClient.post<TunnelStartResponse>('/tunnel/start', { password }),

  stop: () => apiClient.post<{ status: string }>('/tunnel/stop'),

  configure: (config: TunnelConfig) => apiClient.put<{ status: string }>('/tunnel/config', config),
};
