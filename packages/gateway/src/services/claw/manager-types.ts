/**
 * Type definitions for ClawManager.
 */

import type { ClawSession, EventHandler } from '@ownpilot/core';
import type { ClawRunner } from './runner.js';

// ============================================================================
// ManagedClaw
// ============================================================================

/**
 * Internal runtime state for a single managed Claw session.
 * Stored in the ClawManager's `this.claws` Map.
 */
export interface ManagedClaw {
  session: ClawSession;
  runner: ClawRunner;
  timer: ReturnType<typeof setTimeout> | null;
  eventSubscriptions: Array<{ eventType: string; handler: EventHandler }>;
  consecutiveErrors: number;
  cyclesThisHour: number;
  hourWindow: number;
  persistTimer: ReturnType<typeof setInterval> | null;
  lastCycleToolCalls: number;
  cycleInProgress: boolean;
  currentCycleNumber: number;
  idleCycles: number;
  /**
   * AbortController for the current cycle. Allows pause/stop/escalation to
   * cancel an in-flight agent call instead of waiting for the cycle timeout.
   */
  abortController: AbortController | null;
  /**
   * Set by steerClaw when it aborts an in-flight cycle: signals the
   * aborted-cycle path to start a fresh cycle immediately (with the steer
   * message now in the inbox) instead of leaving the claw idle until the next
   * scheduled tick.
   */
  steerPending: boolean;
  /**
   * Tracks whether the session has changes that have not been written to the
   * database yet. The periodic persist timer uses this to skip no-op writes
   * (e.g. event-mode claws idling between rare events). Mutating call paths
   * set this true; persistSession clears it on successful write.
   */
  dirty: boolean;
  /**
   * Scheduling priority (1=highest, 3=normal, 5=lowest). Higher-priority claws
   * get shorter adaptive delays, allowing them to complete more cycles per
   * hour and respond faster to steer requests.
   */
  priority: number;
}
