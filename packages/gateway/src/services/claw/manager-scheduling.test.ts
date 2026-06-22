import { describe, it, expect } from 'vitest';
import { isSchedulableState } from './manager-scheduling.js';

describe('isSchedulableState', () => {
  it('returns true for running', () => {
    expect(isSchedulableState('running')).toBe(true);
  });

  it('returns true for waiting', () => {
    expect(isSchedulableState('waiting')).toBe(true);
  });

  it('returns false for paused', () => {
    expect(isSchedulableState('paused')).toBe(false);
  });

  it('returns false for stopped', () => {
    expect(isSchedulableState('stopped')).toBe(false);
  });

  it('returns false for completed', () => {
    expect(isSchedulableState('completed')).toBe(false);
  });

  it('returns false for failed', () => {
    expect(isSchedulableState('failed')).toBe(false);
  });

  it('returns false for escalation_pending', () => {
    expect(isSchedulableState('escalation_pending')).toBe(false);
  });
});
