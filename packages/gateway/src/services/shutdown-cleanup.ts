/**
 * Server Shutdown Cleanup
 *
 * Centralizes all service reset calls that previously lived as 13 individual
 * try/catch blocks in server.ts. Adding a new service now requires only one
 * entry in the RESETTERS array — no copy/paste boilerplate.
 *
 * Each entry is lazily imported so modules that aren't loaded yet don't trigger
 * their initialization side-effects during shutdown.
 *
 * Usage in server.ts gracefulShutdown():
 *   const { shutdownAllServices } = await import('./shutdown-cleanup.js');
 *   await shutdownAllServices(log);
 */

import type { getLog } from './log.js';

type Logger = ReturnType<typeof getLog>;

/** Shape of a single service resetter */
type Resetter = () => void | Promise<void>;

/** A single service entry: label for logging + factory that returns the resetter */
type ServiceEntry = {
  label: string;
  getResetter: () => Resetter | Promise<Resetter>;
};

/**
 * All registered service reset functions.
 * Key = human-readable label used in log messages.
 * Value = factory returning the reset function (lazy import pattern).
 *
 * Shutdown order mirrors boot order: dependencies first, leaf services last.
 */
const RESETTERS: ServiceEntry[] = [
  // ── Network / async cleanup first ────────────────────────────────────────
  {
    label: 'MCP client',
    getResetter: async () => {
      const { mcpClientService } = await import('./mcp/client.js');
      return () => mcpClientService.disconnectAll();
    },
  },
  {
    label: 'Tunnel service',
    getResetter: async () => {
      const { getTunnelService } = await import('./tunnel-service.js');
      return () => getTunnelService().stop();
    },
  },
  {
    label: 'Webhook handler',
    getResetter: async () => {
      const { getWebhookHandler, unregisterWebhookHandler } =
        await import('../channels/plugins/telegram/webhook.js');
      return () => {
        if (getWebhookHandler()) unregisterWebhookHandler();
      };
    },
  },

  // ── Background timers / schedulers ─────────────────────────────────────────
  {
    label: 'Trigger engine',
    getResetter: async () => {
      const { stopTriggerEngine } = await import('../triggers/index.js');
      return stopTriggerEngine;
    },
  },
  {
    label: 'Rate limiters',
    getResetter: async () => {
      const { stopAllRateLimiters } = await import('../middleware/rate-limit.js');
      return stopAllRateLimiters;
    },
  },
  {
    label: 'UI session cleanup',
    getResetter: async () => {
      const { stopCleanup } = await import('./ui-session.js');
      return stopCleanup;
    },
  },
  {
    label: 'ApprovalManager',
    getResetter: async () => {
      const { getApprovalManager } = await import('../autonomy/approvals.js');
      return () => getApprovalManager().stop();
    },
  },
  {
    label: 'Autonomy engine',
    getResetter: async () => {
      const { stopAutonomyEngine } = await import('../autonomy/engine.js');
      return stopAutonomyEngine;
    },
  },
  {
    label: 'Scheduler',
    getResetter: async () => {
      const { stopScheduler } = await import('../scheduler/index.js');
      return stopScheduler;
    },
  },
  {
    label: 'Workflow Node Job Worker',
    getResetter: async () => {
      const { stopWorkflowNodeWorker } = await import('./workflow/workflow-node-job-handler.js');
      return stopWorkflowNodeWorker;
    },
  },
  {
    label: 'Embedding queue',
    getResetter: async () => {
      const { resetEmbeddingQueue } = await import('./embedding/queue.js');
      return resetEmbeddingQueue;
    },
  },
  {
    label: 'Heartbeat runner',
    getResetter: async () => {
      const { resetHeartbeatRunner } = await import('./heartbeat/soul-service.js');
      return resetHeartbeatRunner;
    },
  },
  {
    label: 'Pulse metrics',
    getResetter: async () => {
      const { resetPulseMetricsService } = await import('./metric/pulse.js');
      return resetPulseMetricsService;
    },
  },
  {
    label: 'Circuit breakers',
    getResetter: async () => {
      const { stopAllCircuitBreakers } = await import('../middleware/circuit-breaker.js');
      return stopAllCircuitBreakers;
    },
  },

  // ── Service singletons ─────────────────────────────────────────────────────
  {
    label: 'Coding agent sessions',
    getResetter: async () => {
      const { getCodingAgentSessionManager } = await import('./coding-agent/sessions.js');
      return () => getCodingAgentSessionManager().stop();
    },
  },
  {
    label: 'Coding agent session manager',
    getResetter: async () => {
      const { resetCodingAgentSessionManager } = await import('./coding-agent/sessions.js');
      return resetCodingAgentSessionManager;
    },
  },
  {
    label: 'Heartbeat service',
    getResetter: async () => {
      const { resetHeartbeatService } = await import('./heartbeat/service.js');
      return resetHeartbeatService;
    },
  },
  {
    label: 'Memory service',
    getResetter: async () => {
      const { resetMemoryService } = await import('./memory-service.js');
      return resetMemoryService;
    },
  },
  {
    label: 'Goal service',
    getResetter: async () => {
      const { resetGoalService } = await import('./goal-service.js');
      return resetGoalService;
    },
  },
  {
    label: 'Plan service',
    getResetter: async () => {
      const { resetPlanService } = await import('./plan-service.js');
      return resetPlanService;
    },
  },
  {
    label: 'Extension service',
    getResetter: async () => {
      const { resetExtensionService } = await import('./extension/service.js');
      return resetExtensionService;
    },
  },
  {
    label: 'CLI tool service',
    getResetter: async () => {
      const { resetCliToolService } = await import('./cli/tool-service.js');
      return resetCliToolService;
    },
  },
  {
    label: 'Coding agent service',
    getResetter: async () => {
      const { resetCodingAgentService } = await import('./coding-agent/service.js');
      return resetCodingAgentService;
    },
  },
  {
    label: 'Metrics service',
    getResetter: async () => {
      const { stopMetricsService } = await import('./metric/service.js');
      return stopMetricsService;
    },
  },
  {
    label: 'Claw manager',
    getResetter: async () => {
      const { resetClawManager } = await import('./claw/manager.js');
      return resetClawManager;
    },
  },
  {
    label: 'Browser service',
    getResetter: async () => {
      const { resetBrowserService } = await import('./browser-service.js');
      return resetBrowserService;
    },
  },
  {
    label: 'Extension sandbox',
    getResetter: async () => {
      const { resetExtensionSandbox } = await import('./extension/sandbox.js');
      return resetExtensionSandbox;
    },
  },
  {
    label: 'Edge MQTT client',
    getResetter: async () => {
      const { resetEdgeMqttClient } = await import('./edge/mqtt-client.js');
      return resetEdgeMqttClient;
    },
  },
  {
    label: 'Embedding service',
    getResetter: async () => {
      const { resetEmbeddingService } = await import('./embedding/service.js');
      return resetEmbeddingService;
    },
  },
  {
    label: 'Voice service',
    getResetter: async () => {
      const { resetVoiceService } = await import('./voice-service.js');
      return resetVoiceService;
    },
  },
  {
    label: 'NPM installer',
    getResetter: async () => {
      const { resetNpmInstaller } = await import('./skill/npm-installer.js');
      return resetNpmInstaller;
    },
  },
  {
    label: 'LLM semaphore',
    getResetter: async () => {
      const { resetLlmSemaphore } = await import('./llm/semaphore.js');
      return resetLlmSemaphore;
    },
  },
  {
    label: 'Custom data service',
    getResetter: async () => {
      const { resetCustomDataService } = await import('./custom/data-service.js');
      return resetCustomDataService;
    },
  },
  {
    label: 'Trigger service',
    getResetter: async () => {
      const { resetTriggerService } = await import('./trigger-service.js');
      return resetTriggerService;
    },
  },
  {
    label: 'Resource registry',
    getResetter: async () => {
      const { resetResourceRegistry } = await import('./resource/registry.js');
      return resetResourceRegistry;
    },
  },
  {
    label: 'MCP server',
    getResetter: async () => {
      const { invalidateMcpServer } = await import('./mcp/server.js');
      return invalidateMcpServer;
    },
  },
];

/**
 * Invoke all registered service reset functions, logging any errors.
 * Called at the end of server.ts gracefulShutdown().
 *
 * Errors are non-fatal — we continue resetting the remaining services even if
 * one throws. Only the DB close failure at the very end is fatal.
 */
export async function shutdownAllServices(log: Logger): Promise<void> {
  for (const entry of RESETTERS) {
    try {
      const resetter = await entry.getResetter();
      await resetter();
    } catch (e) {
      log.warn(`${entry.label} shutdown error`, { error: String(e) });
    }
  }
}
