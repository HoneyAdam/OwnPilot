/**
 * CrewTasksRepository Tests
 *
 * Unit tests for the crew task queue — create, getById, claim (conditional
 * on pending status), claimHighestPriority (priority-ordered SKIP LOCKED
 * pull), complete/fail (conditional on claimed_by), listPending,
 * listByAgent (with/without status), listByCrew (paginated), and the
 * module-level singleton.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockAdapter } from '../../../test-helpers.js';

const mockAdapter = createMockAdapter();

vi.mock('../../adapters/index.js', () => ({
  getAdapter: async () => mockAdapter,
  getAdapterSync: () => mockAdapter,
}));

const { CrewTasksRepository, getCrewTasksRepository } = await import('./tasks.js');

const NOW = '2026-01-01T00:00:00Z';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    crew_id: 'crew-1',
    created_by: 'agent-creator',
    claimed_by: null,
    task_name: 'Analyze logs',
    description: 'Review errors in the last 24 hours',
    context: 'production incident',
    expected_output: 'root cause summary',
    priority: 'normal',
    status: 'pending',
    result: null,
    deadline: null,
    created_at: NOW,
    claimed_at: null,
    completed_at: null,
    ...overrides,
  };
}

describe('CrewTasksRepository', () => {
  let repo: InstanceType<typeof CrewTasksRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new CrewTasksRepository();
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('inserts with all fields and returns the mapped task', async () => {
      const deadline = new Date('2026-02-01T00:00:00Z');
      mockAdapter.query.mockResolvedValueOnce([
        makeRow({ priority: 'high', deadline: deadline.toISOString() }),
      ]);

      const task = await repo.create({
        crewId: 'crew-1',
        createdBy: 'agent-creator',
        taskName: 'Analyze logs',
        description: 'Review errors in the last 24 hours',
        context: 'production incident',
        expectedOutput: 'root cause summary',
        priority: 'high',
        deadline,
      });

      expect(task.id).toBe('task-1');
      expect(task.priority).toBe('high');
      expect(task.status).toBe('pending');
      expect(task.deadline).toBeInstanceOf(Date);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.claimedAt).toBeNull();
      expect(task.completedAt).toBeNull();

      const [sql, params] = mockAdapter.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO crew_task_queue');
      expect(sql).toContain('RETURNING *');
      expect(params).toEqual([
        'crew-1',
        'agent-creator',
        'Analyze logs',
        'Review errors in the last 24 hours',
        'production incident',
        'root cause summary',
        'high',
        deadline,
      ]);
    });

    it('defaults priority to normal and nullable fields to null', async () => {
      mockAdapter.query.mockResolvedValueOnce([makeRow()]);

      await repo.create({
        crewId: 'crew-1',
        createdBy: 'agent-creator',
        taskName: 'Analyze logs',
        description: 'desc',
      });

      const [, params] = mockAdapter.query.mock.calls[0] as [string, unknown[]];
      expect(params[4]).toBeNull(); // context
      expect(params[5]).toBeNull(); // expectedOutput
      expect(params[6]).toBe('normal'); // priority default
      expect(params[7]).toBeNull(); // deadline
    });
  });

  // ---------------------------------------------------------------------------
  // getById
  // ---------------------------------------------------------------------------

  describe('getById', () => {
    it('returns the mapped task when row exists', async () => {
      mockAdapter.queryOne.mockResolvedValueOnce(
        makeRow({ deadline: NOW, claimed_at: NOW, completed_at: NOW })
      );

      const task = await repo.getById('task-1');

      expect(task?.id).toBe('task-1');
      expect(task?.deadline).toBeInstanceOf(Date);
      expect(task?.claimedAt).toBeInstanceOf(Date);
      expect(task?.completedAt).toBeInstanceOf(Date);

      const [sql, params] = mockAdapter.queryOne.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('SELECT * FROM crew_task_queue WHERE id = $1');
      expect(params).toEqual(['task-1']);
    });

    it('returns null when no row is found', async () => {
      mockAdapter.queryOne.mockResolvedValueOnce(null);
      expect(await repo.getById('missing')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // claim
  // ---------------------------------------------------------------------------

  describe('claim', () => {
    it('claims a pending task and returns the updated row', async () => {
      mockAdapter.query.mockResolvedValueOnce([
        makeRow({ claimed_by: 'agent-1', status: 'in_progress', claimed_at: NOW }),
      ]);

      const task = await repo.claim('task-1', 'agent-1');

      expect(task?.claimedBy).toBe('agent-1');
      expect(task?.status).toBe('in_progress');

      const [sql, params] = mockAdapter.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("status = 'in_progress'");
      expect(sql).toContain("WHERE id = $2 AND status = 'pending'");
      expect(params).toEqual(['agent-1', 'task-1']);
    });

    it('returns null when no row matched (already claimed or missing)', async () => {
      mockAdapter.query.mockResolvedValueOnce([]);
      expect(await repo.claim('task-1', 'agent-1')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // claimHighestPriority
  // ---------------------------------------------------------------------------

  describe('claimHighestPriority', () => {
    it('orders by priority CASE and uses FOR UPDATE SKIP LOCKED', async () => {
      mockAdapter.query.mockResolvedValueOnce([
        makeRow({ priority: 'urgent', claimed_by: 'agent-1', status: 'in_progress' }),
      ]);

      const task = await repo.claimHighestPriority('crew-1', 'agent-1');

      expect(task?.priority).toBe('urgent');

      const [sql, params] = mockAdapter.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("WHEN 'urgent' THEN 0");
      expect(sql).toContain("WHEN 'high' THEN 1");
      expect(sql).toContain("WHEN 'normal' THEN 2");
      expect(sql).toContain("WHEN 'low' THEN 3");
      expect(sql).toContain('FOR UPDATE SKIP LOCKED');
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('created_at ASC');
      expect(params).toEqual(['crew-1', 'agent-1']);
    });

    it('returns null when no pending task exists for the crew', async () => {
      mockAdapter.query.mockResolvedValueOnce([]);
      expect(await repo.claimHighestPriority('crew-1', 'agent-1')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // complete
  // ---------------------------------------------------------------------------

  describe('complete', () => {
    it('marks task completed when claimed_by matches', async () => {
      mockAdapter.query.mockResolvedValueOnce([
        makeRow({ status: 'completed', result: 'ok', completed_at: NOW }),
      ]);

      const task = await repo.complete('task-1', 'agent-1', 'ok');

      expect(task?.status).toBe('completed');
      expect(task?.result).toBe('ok');

      const [sql, params] = mockAdapter.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("status = 'completed'");
      expect(sql).toContain('WHERE id = $2 AND claimed_by = $3');
      expect(params).toEqual(['ok', 'task-1', 'agent-1']);
    });

    it('returns null when claimer does not match', async () => {
      mockAdapter.query.mockResolvedValueOnce([]);
      expect(await repo.complete('task-1', 'wrong-agent', 'ok')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // fail
  // ---------------------------------------------------------------------------

  describe('fail', () => {
    it('marks task failed and stores the error as result', async () => {
      mockAdapter.query.mockResolvedValueOnce([
        makeRow({ status: 'failed', result: 'timeout', completed_at: NOW }),
      ]);

      const task = await repo.fail('task-1', 'agent-1', 'timeout');

      expect(task?.status).toBe('failed');
      expect(task?.result).toBe('timeout');

      const [sql, params] = mockAdapter.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("status = 'failed'");
      expect(sql).toContain('WHERE id = $2 AND claimed_by = $3');
      expect(params).toEqual(['timeout', 'task-1', 'agent-1']);
    });

    it('returns null when claimer does not match', async () => {
      mockAdapter.query.mockResolvedValueOnce([]);
      expect(await repo.fail('task-1', 'wrong-agent', 'e')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // listPending
  // ---------------------------------------------------------------------------

  describe('listPending', () => {
    it('orders by priority CASE then created_at ASC with default limit 10', async () => {
      mockAdapter.query.mockResolvedValueOnce([
        makeRow({ priority: 'urgent' }),
        makeRow({ id: 'task-2', priority: 'high' }),
      ]);

      const tasks = await repo.listPending('crew-1');

      expect(tasks).toHaveLength(2);
      const [sql, params] = mockAdapter.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("WHERE crew_id = $1 AND status = 'pending'");
      expect(sql).toContain('created_at ASC');
      expect(sql).toContain('LIMIT $2');
      expect(params).toEqual(['crew-1', 10]);
    });

    it('honors a custom limit', async () => {
      mockAdapter.query.mockResolvedValueOnce([]);
      await repo.listPending('crew-1', 50);

      const [, params] = mockAdapter.query.mock.calls[0] as [string, unknown[]];
      expect(params[1]).toBe(50);
    });
  });

  // ---------------------------------------------------------------------------
  // listByAgent
  // ---------------------------------------------------------------------------

  describe('listByAgent', () => {
    it('filters by claimed_by only when status is omitted', async () => {
      mockAdapter.query.mockResolvedValueOnce([]);

      await repo.listByAgent('agent-1');

      const [sql, params] = mockAdapter.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('WHERE claimed_by = $1');
      expect(sql).not.toContain('status = $2');
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(params).toEqual(['agent-1']);
    });

    it('adds status filter when provided', async () => {
      mockAdapter.query.mockResolvedValueOnce([
        makeRow({ status: 'in_progress', claimed_by: 'agent-1' }),
      ]);

      const tasks = await repo.listByAgent('agent-1', 'in_progress');

      expect(tasks).toHaveLength(1);
      const [sql, params] = mockAdapter.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('WHERE claimed_by = $1 AND status = $2');
      expect(params).toEqual(['agent-1', 'in_progress']);
    });
  });

  // ---------------------------------------------------------------------------
  // listByCrew
  // ---------------------------------------------------------------------------

  describe('listByCrew', () => {
    it('returns tasks and total with no status filter using default limit/offset', async () => {
      mockAdapter.queryOne.mockResolvedValueOnce({ count: '4' });
      mockAdapter.query.mockResolvedValueOnce([makeRow(), makeRow({ id: 'task-2' })]);

      const result = await repo.listByCrew('crew-1');

      expect(result.total).toBe(4);
      expect(result.tasks).toHaveLength(2);

      const [countSql, countParams] = mockAdapter.queryOne.mock.calls[0] as [string, unknown[]];
      expect(countSql).toContain('WHERE crew_id = $1');
      expect(countParams).toEqual(['crew-1']);

      const [dataSql, dataParams] = mockAdapter.query.mock.calls[0] as [string, unknown[]];
      expect(dataSql).toContain('created_at DESC');
      expect(dataSql).toContain('LIMIT $2 OFFSET $3');
      expect(dataParams).toEqual(['crew-1', 20, 0]);
    });

    it('adds status filter and honors custom pagination', async () => {
      mockAdapter.queryOne.mockResolvedValueOnce({ count: '7' });
      mockAdapter.query.mockResolvedValueOnce([]);

      await repo.listByCrew('crew-1', 'failed', 50, 100);

      const [countSql, countParams] = mockAdapter.queryOne.mock.calls[0] as [string, unknown[]];
      expect(countSql).toContain('WHERE crew_id = $1 AND status = $2');
      expect(countParams).toEqual(['crew-1', 'failed']);

      const [dataSql, dataParams] = mockAdapter.query.mock.calls[0] as [string, unknown[]];
      expect(dataSql).toContain('LIMIT $3 OFFSET $4');
      expect(dataParams).toEqual(['crew-1', 'failed', 50, 100]);
    });

    it('returns total 0 when no count row is returned', async () => {
      mockAdapter.queryOne.mockResolvedValueOnce(null);
      mockAdapter.query.mockResolvedValueOnce([]);

      const result = await repo.listByCrew('crew-1');
      expect(result.total).toBe(0);
      expect(result.tasks).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  describe('getCrewTasksRepository', () => {
    it('returns the same instance across calls', () => {
      const a = getCrewTasksRepository();
      const b = getCrewTasksRepository();
      expect(a).toBe(b);
      expect(a).toBeInstanceOf(CrewTasksRepository);
    });
  });
});
