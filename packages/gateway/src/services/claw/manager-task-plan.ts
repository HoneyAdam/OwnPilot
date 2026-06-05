/**
 * Task-plan persistence helpers for ClawManager.
 *
 * These helpers manage the serialization of typed session state (tasks, plan
 * history) into the session's persistentContext, allowing Claw sessions to
 * survive server restarts without a DB schema migration.
 */

import type { ClawTask, ClawPlanHistoryEntry } from '@ownpilot/core';

// ============================================================================
// Reserved context keys
// ============================================================================

/** Reserved key inside persistentContext for serialized task list */
const SAVED_TASKS_KEY = '__claw_tasks';
/** Reserved key inside persistentContext for serialized plan history */
const SAVED_PLAN_HISTORY_KEY = '__claw_plan_history';

// ============================================================================
// Priority delay multipliers
// ============================================================================

/**
 * Priority multipliers applied to adaptive delays in continuous mode.
 * Priority 1 (highest): multiply by 0.5  → 250ms / 5000ms / 2500ms
 * Priority 3 (normal):  multiply by 1.0  → 500ms / 10000ms / 5000ms
 * Priority 5 (lowest):  multiply by 2.0  → 1000ms / 20000ms / 10000ms
 */
export const PRIORITY_DELAY_MULTIPLIER: Record<number, number> = {
  1: 0.5,
  2: 0.75,
  3: 1.0,
  4: 1.5,
  5: 2.0,
};

// ============================================================================
// Extract
// ============================================================================

/**
 * Extract typed ClawTask[] from a raw persistentContext.
 * Loose runtime validation — malformed rows are dropped silently so a bad
 * row can't prevent the claw from resuming on boot.
 */
export function extractSavedTasks(ctx: Record<string, unknown> | undefined): ClawTask[] {
  const raw = ctx?.[SAVED_TASKS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is ClawTask =>
      typeof t === 'object' &&
      t !== null &&
      typeof (t as ClawTask).id === 'string' &&
      typeof (t as ClawTask).title === 'string' &&
      typeof (t as ClawTask).status === 'string'
  );
}

/**
 * Extract typed ClawPlanHistoryEntry[] from a raw persistentContext.
 */
export function extractSavedPlanHistory(
  ctx: Record<string, unknown> | undefined
): ClawPlanHistoryEntry[] {
  const raw = ctx?.[SAVED_PLAN_HISTORY_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is ClawPlanHistoryEntry =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as ClawPlanHistoryEntry).at === 'string' &&
      typeof (e as ClawPlanHistoryEntry).actor === 'string' &&
      typeof (e as ClawPlanHistoryEntry).kind === 'string'
  );
}

// ============================================================================
// Strip
// ============================================================================

/**
 * Remove saved-tasks and saved-plan-history entries from persistentContext.
 * Used before passing context to the agent so internal keys don't leak into
 * the prompt.
 */
export function stripSavedTasks(ctx: Record<string, unknown>): Record<string, unknown> {
  if (!(SAVED_TASKS_KEY in ctx) && !(SAVED_PLAN_HISTORY_KEY in ctx)) return ctx;
  const next: Record<string, unknown> = { ...ctx };
  delete next[SAVED_TASKS_KEY];
  delete next[SAVED_PLAN_HISTORY_KEY];
  return next;
}
