/**
 * Agent Session Info — shared utility for computing session metadata.
 *
 * Extracted from service.ts so that both the main agent service and the
 * context management module (agent-context.ts) can import it without
 * creating a circular dependency.
 *
 * Depends only on @ownpilot/core (getLLMRouter) and the SessionInfo type —
 * no gateway-internal imports, so it has no circular dependency risk.
 */

import type { Agent } from '@ownpilot/core/agent';
import { getLLMRouter } from '@ownpilot/core/services';
import type { SessionInfo } from '../../types/index.js';

/**
 * Get session info for a chat agent — message count, token estimates,
 * context fill percentage.
 *
 * @param actualPromptTokens Optional real token count from the provider
 *   (e.g. Anthropic's usage.input). When provided, it replaces the
 *   estimated system+message token sum for more accurate fill tracking.
 */
export function getSessionInfo(
  agent: Agent,
  provider: string,
  model: string,
  contextWindowOverride?: number,
  actualPromptTokens?: number
): SessionInfo {
  const conversation = agent.getConversation();
  const memory = agent.getMemory();
  const stats = memory.getStats(conversation.id);
  const maxCtx = getLLMRouter().getContextWindow(provider, model, contextWindowOverride);

  const systemPromptTokens = conversation.systemPrompt
    ? Math.ceil(conversation.systemPrompt.length / 4)
    : 0;
  const messageTokens = stats?.estimatedTokens ?? 0;
  // Prefer real provider usage when available; otherwise sum estimate + system.
  const estimated =
    actualPromptTokens != null && actualPromptTokens > 0
      ? actualPromptTokens
      : systemPromptTokens + messageTokens;

  return {
    sessionId: conversation.id,
    messageCount: stats?.messageCount ?? 0,
    estimatedTokens: estimated,
    maxContextTokens: maxCtx,
    contextFillPercent: maxCtx > 0 ? Math.min(100, Math.round((estimated / maxCtx) * 100)) : 0,
  };
}
