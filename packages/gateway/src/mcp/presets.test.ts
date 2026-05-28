import { describe, it, expect } from 'vitest';
import {
  MCP_SERVER_PRESETS,
  getMcpPreset,
  resolvePresetInstall,
  type McpServerPreset,
} from './presets.js';

describe('MCP_SERVER_PRESETS catalog', () => {
  it('has unique preset ids and default names', () => {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const p of MCP_SERVER_PRESETS) {
      expect(ids.has(p.id), `duplicate id ${p.id}`).toBe(false);
      expect(names.has(p.defaultName), `duplicate defaultName ${p.defaultName}`).toBe(false);
      ids.add(p.id);
      names.add(p.defaultName);
    }
  });

  it('every preset declares a stdio transport with a command + args[]', () => {
    for (const p of MCP_SERVER_PRESETS) {
      expect(p.transport).toBe('stdio');
      expect(p.command).toBeTruthy();
      expect(Array.isArray(p.args)).toBe(true);
    }
  });

  it('getMcpPreset returns the matching entry or undefined', () => {
    expect(getMcpPreset('browser-use')).toBeDefined();
    expect(getMcpPreset('does-not-exist')).toBeUndefined();
  });
});

describe('resolvePresetInstall', () => {
  const fakePreset: McpServerPreset = {
    id: 'fake',
    defaultName: 'fake-default',
    displayName: 'Fake',
    description: 'unit test',
    category: 'devtools',
    homepage: 'https://example.com',
    installHint: 'n/a',
    transport: 'stdio',
    command: 'node',
    args: ['base.js'],
    env: [
      { name: 'REQUIRED_KEY', description: 'must-have', kind: 'secret', required: true },
      { name: 'OPTIONAL_KEY', description: 'opt', kind: 'plain', required: false },
    ],
  };

  it('throws when a required env var is missing', () => {
    expect(() => resolvePresetInstall(fakePreset, {})).toThrow(/REQUIRED_KEY/);
  });

  it('uses preset defaults when overrides are empty', () => {
    const resolved = resolvePresetInstall(fakePreset, {
      env: { REQUIRED_KEY: 'value' },
    });
    expect(resolved.name).toBe('fake-default');
    expect(resolved.displayName).toBe('Fake');
    expect(resolved.command).toBe('node');
    expect(resolved.args).toEqual(['base.js']);
    expect(resolved.env).toEqual({ REQUIRED_KEY: 'value' });
    expect(resolved.enabled).toBe(true);
    expect(resolved.autoConnect).toBe(true);
  });

  it('appends extraArgs after the preset baseline', () => {
    const resolved = resolvePresetInstall(fakePreset, {
      env: { REQUIRED_KEY: 'v' },
      extraArgs: ['--flag', '/path'],
    });
    expect(resolved.args).toEqual(['base.js', '--flag', '/path']);
  });

  it('drops env keys not declared by the preset', () => {
    const resolved = resolvePresetInstall(fakePreset, {
      env: { REQUIRED_KEY: 'ok', LEAKING_SECRET: 'should-be-dropped' },
    });
    expect(resolved.env).toEqual({ REQUIRED_KEY: 'ok' });
  });

  it('drops declared env entries with empty values', () => {
    const resolved = resolvePresetInstall(fakePreset, {
      env: { REQUIRED_KEY: 'ok', OPTIONAL_KEY: '' },
    });
    expect(resolved.env).toEqual({ REQUIRED_KEY: 'ok' });
  });

  it('respects explicit overrides for name / displayName / flags', () => {
    const resolved = resolvePresetInstall(fakePreset, {
      env: { REQUIRED_KEY: 'ok' },
      name: ' custom-name ',
      displayName: 'Custom',
      enabled: false,
      autoConnect: false,
    });
    expect(resolved.name).toBe('custom-name');
    expect(resolved.displayName).toBe('Custom');
    expect(resolved.enabled).toBe(false);
    expect(resolved.autoConnect).toBe(false);
  });
});
