/**
 * Safe Value Utilities
 *
 * Guards against NaN, Infinity, negative values in cost/duration calculations.
 * Centralizes the safeCost pattern originally from ClawManager and FleetManager.
 */

// ============================================================================
// Safe Numeric Guards
// ============================================================================

/**
 * Returns safe finite non-negative number, or fallback.
 * Guards against NaN / Infinity / negative values propagating into budgets/costs.
 */
export function safeNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return value;
}

/**
 * Returns safe cost (USD), always non-negative finite.
 * Use for any cost field that feeds budget checks.
 */
export function safeCost(cost: unknown): number {
  return safeNumber(cost, 0);
}

/**
 * Returns safe duration (ms), always non-negative whole number.
 */
export function safeDuration(durationMs: unknown): number {
  return Math.floor(safeNumber(durationMs, 0));
}

/**
 * Returns safe positive integer within bounds.
 */
export function safePositiveInt(value: unknown, fallback = 0, max = Infinity): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    return fallback;
  }
  return n;
}

// ============================================================================
// Exponential Backoff with Jitter
// ============================================================================

export interface BackoffOptions {
  /** Base delay in ms (default: 1000) */
  baseDelayMs?: number;
  /** Multiplier applied each attempt (default: 2.0) */
  multiplier?: number;
  /** Maximum delay cap in ms (default: 120000) */
  maxDelayMs?: number;
  /** Jitter factor 0-1 (default: 0.1 = ±10%) */
  jitterFactor?: number;
}

const DEFAULT_BACKOFF: Required<BackoffOptions> = {
  baseDelayMs: 1_000,
  multiplier: 2.0,
  maxDelayMs: 120_000,
  jitterFactor: 0.1,
};

/**
 * Calculate delay for a given retry attempt using exponential backoff + jitter.
 *
 * @param attempt - 0-based retry attempt number (0 = first retry after initial failure)
 * @param opts - Backoff configuration
 * @returns Delay in ms to wait before next retry
 *
 * Example: attempt=0, baseDelayMs=5000, multiplier=2, maxDelayMs=60000, jitterFactor=0.1
 *   raw = 5000 * 2^0 = 5000; jitter = ±500; result ≈ 4750-5250
 * Example: attempt=2 (3rd retry), baseDelayMs=5000, multiplier=2
 *   raw = 5000 * 2^2 = 20000; jitter ±2000; result ≈ 18000-22000
 */
export function calculateBackoffDelay(attempt: number, opts: BackoffOptions = {}): number {
  const cfg = { ...DEFAULT_BACKOFF, ...opts };
  const attemptIdx = Math.max(0, Math.floor(attempt));

  const exponentialDelay = cfg.baseDelayMs * Math.pow(cfg.multiplier, attemptIdx);
  const cappedDelay = Math.min(exponentialDelay, cfg.maxDelayMs);

  const jitterRange = cappedDelay * cfg.jitterFactor;
  const jitter = (Math.random() * 2 - 1) * jitterRange;

  return Math.round(Math.max(0, cappedDelay + jitter));
}

// ============================================================================
// Priority Delay
// ============================================================================

/**
 * Delay multiplier map for priority-based adaptive delays.
 * Mirrors PRIORITY_DELAY_MULTIPLIER from ClawManager.
 *
 * Priority 1 (highest): multiply by 0.5  → fastest response
 * Priority 5 (lowest):  multiply by 2.0  → slowest response
 */
export const PRIORITY_DELAY_MULTIPLIER: Record<number, number> = {
  1: 0.5,
  2: 0.75,
  3: 1.0,
  4: 1.5,
  5: 2.0,
};

/**
 * Apply priority multiplier to a base delay.
 * Higher priority (lower number) = shorter delay.
 */
export function applyPriorityMultiplier(baseDelayMs: number, priority: number): number {
  const multiplier = PRIORITY_DELAY_MULTIPLIER[priority] ?? 1.0;
  return Math.round(baseDelayMs * multiplier);
}
