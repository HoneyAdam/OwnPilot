/**
 * Failure-log helpers for ClawManager.
 *
 * Tool-result payloads can be enormous (full file contents, MCP responses, ...).
 * These helpers truncate aggressively before stuffing results into the
 * reflection prompt or the session row, preventing token explosion in the
 * next cycle.
 */

// ============================================================================
// Constants
// ============================================================================

/** Maximum characters per tool result in the failure log */
const FAILURE_LOG_MAX_CHARS = 300;

// ============================================================================
// Helpers
// ============================================================================

/** Coerce any tool result to a string for logging */
export function stringifyToolResult(result: unknown): string {
  if (typeof result === 'string') return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

/** Truncate a string to FAILURE_LOG_MAX_CHARS for safe inclusion in logs/prompts */
export function truncateForFailureLog(s: string, max = FAILURE_LOG_MAX_CHARS): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… [truncated]`;
}
