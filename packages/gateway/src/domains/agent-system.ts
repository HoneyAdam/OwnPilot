/**
 * Agent System Domain
 *
 * Bounded context for all agent lifecycle management:
 * regular agents, coding agents, soul agents, crews, claws,
 * and inter-agent messaging.
 *
 * Tables: agents, agent_souls, agent_crews, agent_crew_members,
 *         agent_messages, heartbeat_log, orchestration_runs,
 *         claws, claw_sessions, claw_history, claw_audit_log
 *
 * Routes: /agents, /souls, /crews, /claws, /agent-messages,
 *         /heartbeat-logs, /agent-command
 *
 * Public API: AgentRegistry (unified agent management)
 */

export const agentSystemDomain = {
  name: 'agent-system' as const,

  /** Route groups owned by this domain */
  routes: [
    '/api/v1/agents',
    '/api/v1/chat',
    '/api/v1/souls',
    '/api/v1/crews',
    '/api/v1/claws',
    '/api/v1/agent-messages',
    '/api/v1/heartbeat-logs',
    '/api/v1/agent-command',
    '/api/v1/audit',
    '/api/v1/debug',
    '/api/v1/heartbeats',
  ],

  /** Database tables owned by this domain */
  tables: [
    'agents',
    'agent_souls',
    'agent_crews',
    'agent_crew_members',
    'agent_messages',
    'heartbeat_log',
    'orchestration_runs',
    'claws',
    'claw_sessions',
    'claw_history',
    'claw_audit_log',
  ],

  /** Services that form the public API of this domain */
  publicServices: ['agent-registry', 'soul-heartbeat-service', 'coding-agent-orchestrator'],
} as const;
