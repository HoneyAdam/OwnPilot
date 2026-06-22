import { describe, it, expect, vi } from 'vitest';
import {
  checkBudgetThreshold,
  checkTaskForceBlock,
  checkTaskStallEscalation,
} from './manager-cycle-ops.js';
import type { ManagedClaw } from './manager-types.js';
import type { CycleOpsCallbacks } from './manager-cycle-ops.js';

vi.mock('../log.js', () => ({ getLog: vi.fn().mockReturnValue({ warn: vi.fn() }) }));
vi.mock('../../db/repositories/claws.js', () => ({
  getClawsRepository: vi
    .fn()
    .mockReturnValue({ appendToInbox: vi.fn().mockResolvedValue(undefined) }),
}));

const BASE_SESSION = {
  id: 'claw-1',
  config: { name: 'TestClaw', autonomyPolicy: {} },
  state: 'running',
  totalCostUsd: 0,
  cyclesCompleted: 0,
  tasks: [] as ManagedClaw['session']['tasks'],
  recentFailures: [] as ManagedClaw['session']['recentFailures'],
  pendingEscalation: undefined,
  planHistory: [] as ManagedClaw['session']['planHistory'],
  inbox: [] as string[],
};

const makeManaged = (over: Partial<ManagedClaw['session']> = {}): ManagedClaw =>
  ({ session: { ...BASE_SESSION, ...over } }) as ManagedClaw;

const makeCb = (): CycleOpsCallbacks => ({
  requestEscalation: vi.fn().mockResolvedValue(undefined),
  recordPlanHistory: vi.fn(),
  markDirty: vi.fn(),
  emitPlanUpdated: vi.fn(),
});

describe('checkBudgetThreshold', () => {
  it('returns false when no budget is set', async () => {
    const managed = makeManaged({ totalCostUsd: 999 });
    const result = await checkBudgetThreshold('claw-1', managed, makeCb());
    expect(result).toBe(false);
  });

  it('returns false when cost is below threshold', async () => {
    const managed = makeManaged({
      totalCostUsd: 0.05,
      config: { name: 'Test', autonomyPolicy: { maxCostUsdBeforePause: 0.1 } },
    });
    const result = await checkBudgetThreshold('claw-1', managed, makeCb());
    expect(result).toBe(false);
  });

  it('returns false when already in escalation_pending state', async () => {
    const managed = makeManaged({
      totalCostUsd: 0.15,
      state: 'escalation_pending',
      config: { name: 'Test', autonomyPolicy: { maxCostUsdBeforePause: 0.1 } },
    });
    const result = await checkBudgetThreshold('claw-1', managed, makeCb());
    expect(result).toBe(false);
  });

  it('returns false when pendingEscalation is already set', async () => {
    const managed = makeManaged({
      totalCostUsd: 0.15,
      pendingEscalation: {
        id: 'esc_1',
        type: 'budget_increase',
        reason: 'test',
        details: {},
        requestedAt: new Date(),
      },
      config: { name: 'Test', autonomyPolicy: { maxCostUsdBeforePause: 0.1 } },
    });
    const result = await checkBudgetThreshold('claw-1', managed, makeCb());
    expect(result).toBe(false);
  });

  it('returns true and requests escalation when threshold exceeded', async () => {
    const cb = makeCb();
    const managed = makeManaged({
      totalCostUsd: 0.15,
      cyclesCompleted: 5,
      config: { name: 'Test', autonomyPolicy: { maxCostUsdBeforePause: 0.1 } },
    });
    const result = await checkBudgetThreshold('claw-1', managed, cb);
    expect(result).toBe(true);
    expect(cb.requestEscalation).toHaveBeenCalledWith(
      'claw-1',
      expect.objectContaining({
        type: 'budget_increase',
        details: expect.objectContaining({ totalCostUsd: 0.15, maxCostUsdBeforePause: 0.1 }),
      })
    );
  });
});

describe('checkTaskForceBlock', () => {
  it('returns false when no tasks are in progress', async () => {
    const managed = makeManaged({ tasks: [] });
    const result = await checkTaskForceBlock('claw-1', managed, makeCb());
    expect(result).toBe(false);
  });

  it('returns false when no task exceeds stall threshold', async () => {
    const managed = makeManaged({
      tasks: [
        { id: 't1', title: 'Task 1', status: 'in_progress', cyclesInProgress: 2, updatedAt: '' },
      ],
    });
    const result = await checkTaskForceBlock('claw-1', managed, makeCb());
    expect(result).toBe(false);
  });

  it('returns true and blocks task when cycles exceed threshold (20+)', async () => {
    const cb = makeCb();
    const managed = makeManaged({
      tasks: [
        {
          id: 't1',
          title: 'Long Task',
          status: 'in_progress',
          cyclesInProgress: 20,
          updatedAt: '',
          notes: '',
        },
      ],
    });
    const result = await checkTaskForceBlock('claw-1', managed, cb);
    expect(result).toBe(true);
    const task = managed.session.tasks[0]!;
    expect(task.status).toBe('blocked');
    expect(task.notes).toContain('AUTO-BLOCKED');
  });

  it('only checks in_progress tasks', async () => {
    const cb = makeCb();
    const managed = makeManaged({
      tasks: [{ id: 't1', title: 'Done', status: 'done', cyclesInProgress: 99, updatedAt: '' }],
    });
    const result = await checkTaskForceBlock('claw-1', managed, cb);
    expect(result).toBe(false);
    expect(cb.requestEscalation).not.toHaveBeenCalled();
  });
});

describe('checkTaskStallEscalation', () => {
  it('returns false when no tasks are stalled', async () => {
    const managed = makeManaged({
      tasks: [
        { id: 't1', title: 'Task', status: 'in_progress', cyclesInProgress: 2, updatedAt: '' },
      ],
    });
    const result = await checkTaskStallEscalation('claw-1', managed, makeCb());
    expect(result).toBe(false);
  });

  it('returns true and requests escalation when task stalled at threshold (10+)', async () => {
    const cb = makeCb();
    const managed = makeManaged({
      tasks: [
        {
          id: 't1',
          title: 'Stalled Task',
          status: 'in_progress',
          cyclesInProgress: 10,
          updatedAt: '',
          notes: '',
        },
      ],
    });
    const result = await checkTaskStallEscalation('claw-1', managed, cb);
    expect(result).toBe(true);
    expect(cb.requestEscalation).toHaveBeenCalledWith(
      'claw-1',
      expect.objectContaining({
        type: 'task_stalled',
        details: expect.objectContaining({ taskId: 't1', cyclesInProgress: 10 }),
      })
    );
  });

  it('does not re-escalate an already auto-escalated task', async () => {
    const cb = makeCb();
    const managed = makeManaged({
      tasks: [
        {
          id: 't1',
          title: 'Task',
          status: 'in_progress',
          cyclesInProgress: 5,
          autoEscalatedAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '',
        },
      ],
    });
    const result = await checkTaskStallEscalation('claw-1', managed, cb);
    expect(result).toBe(false);
    expect(cb.requestEscalation).not.toHaveBeenCalled();
  });
});
