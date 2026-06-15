/**
 * Tests for client-personas.ts
 *
 * Covers:
 *   - CLIENT_PERSONAS shape (every persona carries a User-Agent)
 *   - resolveClientPersonaHeaders (known / unknown / empty, copy semantics)
 */

import { describe, it, expect } from 'vitest';
import {
  CLIENT_PERSONAS,
  resolveClientPersonaHeaders,
  type ClientPersonaId,
} from './client-personas.js';

describe('CLIENT_PERSONAS', () => {
  it('every persona defines a non-empty User-Agent', () => {
    for (const [id, headers] of Object.entries(CLIENT_PERSONAS)) {
      expect(headers['User-Agent'], `persona ${id}`).toBeTruthy();
    }
  });

  it('includes claude-code (the identity used by Kimi For Coding)', () => {
    expect(CLIENT_PERSONAS['claude-code']['User-Agent']).toContain('claude-cli');
  });
});

describe('resolveClientPersonaHeaders', () => {
  it('returns the header bundle for a known persona', () => {
    const headers = resolveClientPersonaHeaders('claude-code');
    expect(headers).toEqual({ 'User-Agent': CLIENT_PERSONAS['claude-code']['User-Agent'] });
  });

  it('returns undefined for an unknown persona id', () => {
    expect(resolveClientPersonaHeaders('not-a-real-agent')).toBeUndefined();
  });

  it('returns undefined for an absent/empty id', () => {
    expect(resolveClientPersonaHeaders(undefined)).toBeUndefined();
    expect(resolveClientPersonaHeaders('')).toBeUndefined();
  });

  it('returns a fresh copy, not the registry object (no accidental mutation)', () => {
    const id: ClientPersonaId = 'kimi-cli';
    const headers = resolveClientPersonaHeaders(id)!;
    headers['User-Agent'] = 'mutated';
    expect(CLIENT_PERSONAS[id]['User-Agent']).not.toBe('mutated');
  });
});
