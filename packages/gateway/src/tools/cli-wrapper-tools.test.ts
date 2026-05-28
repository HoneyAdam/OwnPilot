import { describe, it, expect, vi, beforeEach } from 'vitest';

const executeTool = vi.fn();

vi.mock('../services/cli/tool-service.js', () => ({
  getCliToolService: () => ({ executeTool }),
}));

import { CLI_WRAPPER_TOOLS, executeCliWrapperTool } from './cli-wrapper-tools.js';

beforeEach(() => {
  executeTool.mockReset();
  executeTool.mockResolvedValue({
    toolName: 'gh',
    exitCode: 0,
    stdout: '',
    stderr: '',
    durationMs: 5,
    success: true,
    truncated: false,
  });
});

describe('CLI_WRAPPER_TOOLS catalog', () => {
  it('exposes wrappers for gh, docker, npm (git is owned by core/git-tools)', () => {
    const names = CLI_WRAPPER_TOOLS.map((t) => t.name).sort();
    expect(names).toContain('gh_pr_list');
    expect(names).toContain('gh_pr_create');
    expect(names).toContain('gh_issue_create');
    expect(names).toContain('gh_run_list');
    expect(names).toContain('docker_ps');
    expect(names).toContain('docker_logs');
    expect(names).toContain('docker_inspect');
    expect(names).toContain('npm_install');
    expect(names).toContain('npm_run');
    expect(names).toContain('npm_outdated');
    // Git wrappers intentionally excluded — core already exposes git_status / git_log / git_diff etc.
    expect(names).not.toContain('git_status');
    expect(names).not.toContain('git_log');
    expect(names).not.toContain('git_diff');
  });

  it('every wrapper requires cwd', () => {
    for (const tool of CLI_WRAPPER_TOOLS) {
      const required = (tool.parameters as { required?: string[] }).required ?? [];
      expect(required, `${tool.name} should require cwd`).toContain('cwd');
    }
  });
});

describe('executeCliWrapperTool', () => {
  it('rejects unknown tool names', async () => {
    const res = await executeCliWrapperTool('unknown_tool', { cwd: '/x' }, 'user');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Unknown CLI wrapper/);
  });

  it('rejects missing cwd via the early guard', async () => {
    const res = await executeCliWrapperTool('gh_pr_list', {}, 'user');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/cwd is required/);
    expect(executeTool).not.toHaveBeenCalled();
  });

  it('gh_pr_create builds title + body args', async () => {
    await executeCliWrapperTool('gh_pr_create', { cwd: '/r', title: 'Fix', body: 'desc' }, 'user');
    expect(executeTool.mock.calls[0]![1]).toEqual([
      'pr',
      'create',
      '--title',
      'Fix',
      '--body',
      'desc',
    ]);
  });

  it('gh_pr_create honors draft + base', async () => {
    await executeCliWrapperTool(
      'gh_pr_create',
      { cwd: '/r', title: 'T', body: 'B', base: 'develop', draft: true },
      'user'
    );
    expect(executeTool.mock.calls[0]![1]).toEqual([
      'pr',
      'create',
      '--title',
      'T',
      '--body',
      'B',
      '--base',
      'develop',
      '--draft',
    ]);
  });

  it('gh_pr_list always passes --json with structured fields', async () => {
    await executeCliWrapperTool('gh_pr_list', { cwd: '/r' }, 'user');
    const args = executeTool.mock.calls[0]![1] as string[];
    expect(args[0]).toBe('pr');
    expect(args[1]).toBe('list');
    expect(args).toContain('--json');
  });

  it('gh_pr_list applies state + author filters', async () => {
    await executeCliWrapperTool(
      'gh_pr_list',
      { cwd: '/r', state: 'merged', author: 'octocat', limit: 5 },
      'user'
    );
    const args = executeTool.mock.calls[0]![1] as string[];
    expect(args).toContain('--state');
    expect(args).toContain('merged');
    expect(args).toContain('--author');
    expect(args).toContain('octocat');
    expect(args).toContain('--limit');
    expect(args).toContain('5');
  });

  it('gh_issue_create joins labels with comma', async () => {
    await executeCliWrapperTool(
      'gh_issue_create',
      { cwd: '/r', title: 'T', body: 'B', labels: ['bug', 'p1'] },
      'user'
    );
    const args = executeTool.mock.calls[0]![1] as string[];
    expect(args).toContain('--label');
    expect(args).toContain('bug,p1');
  });

  it('gh_run_view supports --log-failed', async () => {
    await executeCliWrapperTool(
      'gh_run_view',
      { cwd: '/r', run_id: '123', log_failed: true },
      'user'
    );
    expect(executeTool.mock.calls[0]![1]).toEqual(['run', 'view', '123', '--log-failed']);
  });

  it('docker_ps with all=true adds --all', async () => {
    await executeCliWrapperTool('docker_ps', { cwd: '/r', all: true }, 'user');
    expect(executeTool.mock.calls[0]![1]).toEqual(['ps', '--format', 'json', '--all']);
  });

  it('docker_logs uses default tail=200', async () => {
    await executeCliWrapperTool('docker_logs', { cwd: '/r', container: 'web' }, 'user');
    expect(executeTool.mock.calls[0]![1]).toEqual(['logs', '--tail', '200', 'web']);
  });

  it('docker_logs honors tail + timestamps', async () => {
    await executeCliWrapperTool(
      'docker_logs',
      { cwd: '/r', container: 'web', tail: 50, timestamps: true },
      'user'
    );
    expect(executeTool.mock.calls[0]![1]).toEqual(['logs', '--tail', '50', '--timestamps', 'web']);
  });

  it('npm_install with packages adds them after install', async () => {
    await executeCliWrapperTool(
      'npm_install',
      { cwd: '/r', packages: ['lodash', 'zod'], dev: true },
      'user'
    );
    expect(executeTool.mock.calls[0]![1]).toEqual(['install', '--save-dev', 'lodash', 'zod']);
  });

  it('npm_run forwards args after --', async () => {
    await executeCliWrapperTool(
      'npm_run',
      { cwd: '/r', script: 'test', args: ['--watch'] },
      'user'
    );
    expect(executeTool.mock.calls[0]![1]).toEqual(['run', 'test', '--', '--watch']);
  });

  it('returns metadata from the underlying service', async () => {
    executeTool.mockResolvedValueOnce({
      toolName: 'gh',
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
      durationMs: 12,
      success: true,
      truncated: false,
    });
    const res = await executeCliWrapperTool('gh_pr_list', { cwd: '/r' }, 'user');
    expect(res.success).toBe(true);
    expect((res.result as { binary: string }).binary).toBe('gh');
    expect((res.result as { exitCode: number }).exitCode).toBe(0);
  });

  it('surfaces errors thrown by the underlying service', async () => {
    executeTool.mockRejectedValueOnce(new Error('boom'));
    const res = await executeCliWrapperTool('gh_pr_list', { cwd: '/r' }, 'user');
    expect(res.success).toBe(false);
    expect(res.error).toBe('boom');
  });
});
