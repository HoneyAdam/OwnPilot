// Triggers types

export interface TriggerConfig {
  cron?: string;
  eventType?: string;
  condition?: string;
  webhookPath?: string;
  timezone?: string;
  threshold?: number;
  filters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TriggerPreRun {
  code: string;
  timeoutMs?: number;
}

export interface TriggerAction {
  type:
    | 'chat'
    | 'tool'
    | 'notification'
    | 'goal_check'
    | 'memory_summary'
    | 'workflow'
    | 'profile_learn';
  payload: Record<string, unknown>;
  /** Pre-run gating script for zero-token / no-agent mode. */
  preRun?: TriggerPreRun;
  /** When true, deliver pre-run output verbatim and never run the main action. */
  noAgentMode?: boolean;
  /** Chain input: inject the most recent successful result of this trigger id. */
  contextFrom?: string;
}

export interface Trigger {
  id: string;
  type: 'schedule' | 'event' | 'condition' | 'webhook';
  name: string;
  description: string | null;
  config: TriggerConfig;
  action: TriggerAction;
  enabled: boolean;
  priority: number;
  lastFired: string | null;
  nextFire: string | null;
  fireCount: number;
  createdAt: string;
  updatedAt: string;
}

export type TriggerHistoryStatus = 'success' | 'failure' | 'skipped';

export interface TriggerHistoryEntry {
  id: string;
  triggerId: string | null;
  triggerName: string | null;
  firedAt: string;
  status: TriggerHistoryStatus;
  result?: unknown;
  error: string | null;
  durationMs: number | null;
}

export interface TriggerHistoryParams {
  status?: TriggerHistoryStatus;
  triggerId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedHistory {
  history: TriggerHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}
