/**
 * Direct unit tests for the extracted path-security module.
 *
 * The allow/deny behavior of isPathAllowedAsync is covered end-to-end through
 * the executors in file-system.test.ts; these tests pin the building blocks —
 * especially realpathNearestExistingAncestor, whose docstring always claimed
 * "exported for unit testing" but only became exported with the extraction.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  realpathNearestExistingAncestor,
  isPathAllowedAsync,
  resolveFilePath,
  getWorkspaceDir,
} from './file-security.js';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-security-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('realpathNearestExistingAncestor', () => {
  it('returns the realpath itself for an existing path', async () => {
    const real = await realpathNearestExistingAncestor(tmpDir);
    expect(real).toBe(await fs.realpath(tmpDir));
  });

  it('re-attaches non-existent trailing segments to the existing ancestor', async () => {
    const target = path.join(tmpDir, 'does-not-exist', 'leaf.txt');
    const real = await realpathNearestExistingAncestor(target);
    expect(real).toBe(path.join(await fs.realpath(tmpDir), 'does-not-exist', 'leaf.txt'));
  });

  it('resolves a symlinked ancestor for a non-existent leaf', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'file-security-outside-'));
    const link = path.join(tmpDir, 'link-dir');
    try {
      await fs.symlink(outside, link, 'junction');
    } catch {
      // Symlink creation can require privileges on Windows — skip silently.
      await fs.rm(outside, { recursive: true, force: true });
      return;
    }
    try {
      const real = await realpathNearestExistingAncestor(path.join(link, 'new-file.txt'));
      // The symlink must be resolved to the OUTSIDE dir — this is exactly the
      // escape isPathAllowedAsync range-checks against.
      expect(real).toBe(path.join(await fs.realpath(outside), 'new-file.txt'));
    } finally {
      await fs.rm(link, { force: true });
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});

describe('isPathAllowedAsync', () => {
  it('allows paths inside the workspace dir', async () => {
    expect(await isPathAllowedAsync(path.join(tmpDir, 'file.txt'), tmpDir)).toBe(true);
  });

  it('blocks paths outside workspace and tmp', async () => {
    // A path that exists but is in neither the workspace nor os.tmpdir().
    // tmpDir IS under os.tmpdir(), so pick a root-level path instead.
    const outside = path.parse(process.cwd()).root; // e.g. C:\ or /
    expect(await isPathAllowedAsync(path.join(outside, 'no-such-dir', 'f.txt'), tmpDir)).toBe(
      false
    );
  });

  it('blocks null bytes', async () => {
    expect(await isPathAllowedAsync(`${tmpDir}\0evil`, tmpDir)).toBe(false);
  });
});

describe('resolveFilePath / getWorkspaceDir', () => {
  it('resolves relative paths against the workspace', () => {
    expect(resolveFilePath('a/b.txt', tmpDir)).toBe(path.resolve(tmpDir, 'a/b.txt'));
  });

  it('keeps absolute paths as-is (resolved)', () => {
    const abs = path.join(tmpDir, 'x.txt');
    expect(resolveFilePath(abs, tmpDir)).toBe(path.resolve(abs));
  });

  it('getWorkspaceDir prefers the explicit override', () => {
    expect(getWorkspaceDir(tmpDir)).toBe(tmpDir);
  });
});
