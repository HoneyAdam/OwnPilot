/**
 * Debug routes - view AI request/response logs and debug info
 */

import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { getDebugInfo } from '@ownpilot/core/utils';
import { debugLog } from '@ownpilot/core/agent';
import { apiResponse, apiError, ERROR_CODES, getIntParam, safeKeyCompare } from './helpers.js';
import { getCircuitBreakerStats, resetAllCircuits } from '../middleware/circuit-breaker.js';

export const debugRoutes = new Hono();

// Debug endpoints are sensitive — always require ADMIN_API_KEY.
// In non-production, localhost may bypass the key check as a dev convenience
// only when ADMIN_API_KEY is not set (i.e., the binary has no key configured).
const requireDebugAccess = createMiddleware(async (c, next) => {
  const adminKey = process.env.ADMIN_API_KEY;
  const isLocalhost =
    c.req.header('origin') === `http://localhost:${process.env.UI_PORT ?? '8199'}` ||
    c.req.header('referer')?.startsWith(`http://localhost:${process.env.UI_PORT ?? '8199'}`) ||
    c.env?.LOCAL_DEV === 'true';

  // If no key is configured at all, only allow localhost in dev/test
  if (!adminKey) {
    if (process.env.NODE_ENV === 'production' || !isLocalhost) {
      return apiError(
        c,
        {
          code: ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'Debug endpoints require ADMIN_API_KEY to be set',
        },
        503
      );
    }
    return next();
  }

  // Key is configured — verify it on every environment
  const providedKey = c.req.header('X-Admin-Key') ?? '';
  if (!safeKeyCompare(providedKey, adminKey)) {
    return apiError(
      c,
      {
        code: ERROR_CODES.ACCESS_DENIED,
        message: 'Valid X-Admin-Key header required for debug endpoints',
      },
      403
    );
  }
  return next();
});

debugRoutes.use('*', requireDebugAccess);

/**
 * Get debug log entries
 */
debugRoutes.get('/', async (c) => {
  const count = getIntParam(c, 'count', 50, 1, 500);
  const debugInfo = getDebugInfo();

  return apiResponse(c, {
    enabled: debugInfo.enabled,
    summary: debugInfo.summary,
    entries: debugInfo.entries.slice(-count),
  });
});

/**
 * Get recent entries only
 */
debugRoutes.get('/recent', async (c) => {
  const count = getIntParam(c, 'count', 10, 1, 500);
  const entries = debugLog.getRecent(count);

  return apiResponse(c, {
    count: entries.length,
    entries,
  });
});

/**
 * Clear debug log
 */
debugRoutes.delete('/', async (c) => {
  debugLog.clear();

  return apiResponse(c, {
    message: 'Debug log cleared',
  });
});

/**
 * Enable/disable debug logging
 */
debugRoutes.post('/toggle', async (c) => {
  const body = await c.req.json<{ enabled?: boolean }>();
  const enabled = body.enabled ?? !debugLog.isEnabled();

  debugLog.setEnabled(enabled);

  return apiResponse(c, {
    enabled: debugLog.isEnabled(),
    message: enabled ? 'Debug logging enabled' : 'Debug logging disabled',
  });
});

/**
 * Get errors only
 */
debugRoutes.get('/errors', async (c) => {
  const count = getIntParam(c, 'count', 20, 1, 500);
  const allEntries = debugLog.getAll();
  const errors = allEntries.filter((e) => e.type === 'error' || e.type === 'retry').slice(-count);

  return apiResponse(c, {
    count: errors.length,
    entries: errors,
  });
});

/**
 * Get requests and responses only
 */
debugRoutes.get('/requests', async (c) => {
  const count = getIntParam(c, 'count', 20, 1, 500);
  const allEntries = debugLog.getAll();
  const requests = allEntries
    .filter((e) => e.type === 'request' || e.type === 'response')
    .slice(-count);

  return apiResponse(c, {
    count: requests.length,
    entries: requests,
  });
});

/**
 * Get tool calls only
 */
debugRoutes.get('/tools', async (c) => {
  const count = getIntParam(c, 'count', 20, 1, 500);
  const allEntries = debugLog.getAll();
  const toolCalls = allEntries
    .filter((e) => e.type === 'tool_call' || e.type === 'tool_result')
    .slice(-count);

  return apiResponse(c, {
    count: toolCalls.length,
    entries: toolCalls,
  });
});

/**
 * Get sandbox executions only (execute_shell, execute_python, execute_javascript)
 */
debugRoutes.get('/sandbox', async (c) => {
  const count = getIntParam(c, 'count', 20, 1, 500);
  const allEntries = debugLog.getAll();
  const sandboxExecutions = allEntries.filter((e) => e.type === 'sandbox_execution').slice(-count);

  // Calculate summary statistics
  const stats = {
    total: sandboxExecutions.length,
    byLanguage: {
      javascript: sandboxExecutions.filter(
        (e) => (e.data as Record<string, unknown>)?.language === 'javascript'
      ).length,
      python: sandboxExecutions.filter(
        (e) => (e.data as Record<string, unknown>)?.language === 'python'
      ).length,
      shell: sandboxExecutions.filter(
        (e) => (e.data as Record<string, unknown>)?.language === 'shell'
      ).length,
    },
    sandboxed: sandboxExecutions.filter(
      (e) => (e.data as Record<string, unknown>)?.sandboxed === true
    ).length,
    unsandboxed: sandboxExecutions.filter(
      (e) => (e.data as Record<string, unknown>)?.sandboxed === false
    ).length,
    successful: sandboxExecutions.filter(
      (e) => (e.data as Record<string, unknown>)?.success === true
    ).length,
    failed: sandboxExecutions.filter((e) => (e.data as Record<string, unknown>)?.success === false)
      .length,
    timedOut: sandboxExecutions.filter(
      (e) => (e.data as Record<string, unknown>)?.timedOut === true
    ).length,
  };

  return apiResponse(c, {
    count: sandboxExecutions.length,
    stats,
    entries: sandboxExecutions,
  });
});

/**
 * Get circuit breaker statistics
 */
debugRoutes.get('/circuit-breakers', async (c) => {
  const stats = getCircuitBreakerStats();

  const summary = {
    total: stats.length,
    closed: stats.filter((s) => s.state === 'CLOSED').length,
    open: stats.filter((s) => s.state === 'OPEN').length,
    halfOpen: stats.filter((s) => s.state === 'HALF_OPEN').length,
  };

  return apiResponse(c, {
    summary,
    circuits: stats,
  });
});

/**
 * Reset all circuit breakers
 */
debugRoutes.post('/circuit-breakers/reset', async (c) => {
  resetAllCircuits();

  return apiResponse(c, {
    message: 'All circuit breakers reset',
  });
});
