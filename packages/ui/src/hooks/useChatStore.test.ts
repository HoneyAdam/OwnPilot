// @vitest-environment happy-dom
/**
 * Unit tests for the pure helpers exported from useChatStore.
 *
 * Focuses on `computeAutoCompactPrompt` — the threshold + hysteresis logic
 * that decides whether to surface the auto-compact suggestion banner. The
 * full ChatProvider tree is intentionally NOT mounted here; that's covered
 * by component-level tests of ChatPage / ContextBar / ContextDetailModal.
 */

import { describe, it, expect } from 'vitest';
import {
  AUTO_COMPACT_CLEAR_BELOW,
  AUTO_COMPACT_MIN_MESSAGES,
  AUTO_COMPACT_THRESHOLD,
  computeAutoCompactPrompt,
  type AutoCompactPromptState,
} from './useChatStore';
import type { SessionInfo } from '../types';

function makeSession(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    sessionId: 'sess-1',
    messageCount: 12,
    estimatedTokens: 100_000,
    maxContextTokens: 128_000,
    contextFillPercent: AUTO_COMPACT_THRESHOLD,
    ...overrides,
  };
}

describe('computeAutoCompactPrompt', () => {
  it('returns null when fill is below the threshold', () => {
    const result = computeAutoCompactPrompt({
      next: makeSession({ contextFillPercent: 50 }),
      prev: null,
      declined: false,
      isCompacting: false,
    });
    expect(result).toBeNull();
  });

  it('raises a prompt when fill crosses the threshold', () => {
    const result = computeAutoCompactPrompt({
      next: makeSession({ contextFillPercent: AUTO_COMPACT_THRESHOLD }),
      prev: null,
      declined: false,
      isCompacting: false,
    });
    expect(result).not.toBeNull();
    expect(result?.sessionId).toBe('sess-1');
    expect(result?.fillPercent).toBe(AUTO_COMPACT_THRESHOLD);
  });

  it('does not raise a prompt when the user has declined for this session', () => {
    const result = computeAutoCompactPrompt({
      next: makeSession({ contextFillPercent: 95 }),
      prev: null,
      declined: true,
      isCompacting: false,
    });
    expect(result).toBeNull();
  });

  it('does not raise a prompt while a compaction is already running', () => {
    const result = computeAutoCompactPrompt({
      next: makeSession({ contextFillPercent: 95 }),
      prev: null,
      declined: false,
      isCompacting: true,
    });
    expect(result).toBeNull();
  });

  it('does not raise a prompt when messageCount is below the server compact floor', () => {
    // Server-side compactContext requires `messages.length > keepRecent + 2`
    // (default 6+2 = 8). The UI threshold (AUTO_COMPACT_MIN_MESSAGES = 9)
    // matches so the user can't accept a banner that the server would reject.
    const result = computeAutoCompactPrompt({
      next: makeSession({
        contextFillPercent: 95,
        messageCount: AUTO_COMPACT_MIN_MESSAGES - 1,
      }),
      prev: null,
      declined: false,
      isCompacting: false,
    });
    expect(result).toBeNull();
  });

  it('raises a prompt at exactly the message floor', () => {
    const result = computeAutoCompactPrompt({
      next: makeSession({
        contextFillPercent: 95,
        messageCount: AUTO_COMPACT_MIN_MESSAGES,
      }),
      prev: null,
      declined: false,
      isCompacting: false,
    });
    expect(result).not.toBeNull();
  });

  it('reuses the previous prompt object when fill barely moved (stability)', () => {
    const prev: AutoCompactPromptState = {
      sessionId: 'sess-1',
      fillPercent: 86,
      estimatedTokens: 100_000,
      maxContextTokens: 128_000,
    };
    const result = computeAutoCompactPrompt({
      next: makeSession({ contextFillPercent: 86 }),
      prev,
      declined: false,
      isCompacting: false,
    });
    // Same object identity — avoids spurious re-renders on every stream chunk.
    expect(result).toBe(prev);
  });

  it('emits a new prompt object when fill moves by ≥1 point', () => {
    const prev: AutoCompactPromptState = {
      sessionId: 'sess-1',
      fillPercent: 86,
      estimatedTokens: 100_000,
      maxContextTokens: 128_000,
    };
    const result = computeAutoCompactPrompt({
      next: makeSession({ contextFillPercent: 90, estimatedTokens: 115_000 }),
      prev,
      declined: false,
      isCompacting: false,
    });
    expect(result).not.toBe(prev);
    expect(result?.fillPercent).toBe(90);
    expect(result?.estimatedTokens).toBe(115_000);
  });

  it('clears the prompt when fill drops below the hysteresis band', () => {
    const prev: AutoCompactPromptState = {
      sessionId: 'sess-1',
      fillPercent: 90,
      estimatedTokens: 115_000,
      maxContextTokens: 128_000,
    };
    const result = computeAutoCompactPrompt({
      next: makeSession({ contextFillPercent: AUTO_COMPACT_CLEAR_BELOW - 1 }),
      prev,
      declined: false,
      isCompacting: false,
    });
    expect(result).toBeNull();
  });

  it('keeps an existing prompt inside the hysteresis band (between clear & threshold)', () => {
    const prev: AutoCompactPromptState = {
      sessionId: 'sess-1',
      fillPercent: 86,
      estimatedTokens: 110_000,
      maxContextTokens: 128_000,
    };
    // Fill dipped just below the threshold but is still inside the band — we
    // should NOT re-raise (overThreshold is false) and NOT clear (above
    // CLEAR_BELOW). Behavior: keep showing whatever was there.
    const result = computeAutoCompactPrompt({
      next: makeSession({ contextFillPercent: AUTO_COMPACT_THRESHOLD - 1 }),
      prev,
      declined: false,
      isCompacting: false,
    });
    expect(result).toBe(prev);
  });

  it('replaces the prompt when the sessionId changes (new conversation)', () => {
    const prev: AutoCompactPromptState = {
      sessionId: 'sess-1',
      fillPercent: 90,
      estimatedTokens: 115_000,
      maxContextTokens: 128_000,
    };
    const result = computeAutoCompactPrompt({
      next: makeSession({ sessionId: 'sess-2', contextFillPercent: 90 }),
      prev,
      declined: false,
      isCompacting: false,
    });
    expect(result).not.toBe(prev);
    expect(result?.sessionId).toBe('sess-2');
  });
});
