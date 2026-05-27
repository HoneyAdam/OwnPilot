import { describe, it, expect } from 'vitest';
import { evaluateExtensionGate, describeGateFailure } from './gate.js';

const deps = (over: Partial<Parameters<typeof evaluateExtensionGate>[1]> = {}) => ({
  platform: 'linux' as NodeJS.Platform,
  env: {} as NodeJS.ProcessEnv,
  hasBinary: () => true,
  ...over,
});

describe('evaluateExtensionGate', () => {
  it('passes when there are no requirements', () => {
    expect(evaluateExtensionGate(undefined, deps()).ok).toBe(true);
    expect(evaluateExtensionGate({}, deps()).ok).toBe(true);
  });

  it('passes when OS matches', () => {
    const r = evaluateExtensionGate({ os: ['linux', 'darwin'] }, deps({ platform: 'linux' }));
    expect(r.ok).toBe(true);
  });

  it('fails when OS does not match', () => {
    const r = evaluateExtensionGate({ os: ['darwin'] }, deps({ platform: 'win32' }));
    expect(r.ok).toBe(false);
    expect(r.missing.os).toBe('win32');
  });

  it('fails when a required env var is missing or empty', () => {
    const r = evaluateExtensionGate(
      { env: ['OPENAI_API_KEY', 'PRESENT'] },
      deps({ env: { PRESENT: 'x', OPENAI_API_KEY: '' } })
    );
    expect(r.ok).toBe(false);
    expect(r.missing.env).toEqual(['OPENAI_API_KEY']);
  });

  it('fails when a required binary is absent', () => {
    const r = evaluateExtensionGate(
      { binaries: ['ffmpeg', 'git'] },
      deps({ hasBinary: (b) => b === 'git' })
    );
    expect(r.ok).toBe(false);
    expect(r.missing.binaries).toEqual(['ffmpeg']);
  });

  it('passes when all requirements are satisfied', () => {
    const r = evaluateExtensionGate(
      { os: ['linux'], binaries: ['git'], env: ['HOME'] },
      deps({ platform: 'linux', hasBinary: () => true, env: { HOME: '/home/x' } })
    );
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual({});
  });

  it('reports multiple missing pieces at once', () => {
    const r = evaluateExtensionGate(
      { os: ['darwin'], binaries: ['ffmpeg'], env: ['TOKEN'] },
      deps({ platform: 'linux', hasBinary: () => false })
    );
    expect(r.ok).toBe(false);
    expect(r.missing.os).toBe('linux');
    expect(r.missing.binaries).toEqual(['ffmpeg']);
    expect(r.missing.env).toEqual(['TOKEN']);
  });
});

describe('describeGateFailure', () => {
  it('summarizes all missing pieces', () => {
    const msg = describeGateFailure({
      ok: false,
      missing: { os: 'linux', binaries: ['ffmpeg'], env: ['TOKEN'] },
    });
    expect(msg).toContain('linux');
    expect(msg).toContain('ffmpeg');
    expect(msg).toContain('TOKEN');
  });
});
