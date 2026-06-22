/**
 * Tests for workflow-node-job-handler.ts — enqueueWorkflowLevel and registerWorkflowWorker.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock all dependencies before importing the module under test
// ---------------------------------------------------------------------------

const mockEnqueue = vi.hoisted(() => {
  return vi.fn(async () => ({ id: 'job-1' }));
});

const mockStartWorker = vi.hoisted(() => {
  return vi.fn(() => () => {});
});

vi.mock('../job-queue-service.js', () => ({
  JobQueueService: {
    getInstance: vi.fn(() => ({
      enqueue: mockEnqueue,
      startWorker: mockStartWorker,
    })),
  },
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeNode(
  id: string,
  type = 'toolNode'
): import('../../db/repositories/workflows/index.js').WorkflowNode {
  return { id, type, data: {} } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('enqueueWorkflowLevel', () => {
  beforeEach(() => {
    mockEnqueue.mockReset().mockResolvedValue({ id: 'job-1' });
  });

  it('enqueues each node not already in nodeOutputs', async () => {
    const { enqueueWorkflowLevel } = await import('./workflow-node-job-handler.js');

    const nodeMap = new Map<string, any>([
      ['n1', makeNode('n1')],
      ['n2', makeNode('n2')],
    ]);
    const edges: any[] = [];
    const nodeOutputs: Record<string, unknown> = {};

    await enqueueWorkflowLevel(
      'wf-1',
      'log-1',
      'user1',
      ['n1', 'n2'],
      nodeMap,
      edges,
      {},
      nodeOutputs
    );

    expect(mockEnqueue).toHaveBeenCalledTimes(2);
  });

  it('skips nodes already present in nodeOutputs', async () => {
    const { enqueueWorkflowLevel } = await import('./workflow-node-job-handler.js');

    const nodeMap = new Map<string, any>([
      ['n1', makeNode('n1')],
      ['n2', makeNode('n2')],
    ]);
    const edges: any[] = [];
    const nodeOutputs = { n1: { nodeId: 'n1', status: 'success', output: 42 } as any };

    await enqueueWorkflowLevel(
      'wf-1',
      'log-1',
      'user1',
      ['n1', 'n2'],
      nodeMap,
      edges,
      {},
      nodeOutputs
    );

    // n1 is skipped (already executed), only n2 gets enqueued
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const payload = mockEnqueue.mock.calls[0]![1] as any;
    expect(payload.nodeId).toBe('n2');
  });

  it('passes correct payload shape to queue.enqueue', async () => {
    const { enqueueWorkflowLevel } = await import('./workflow-node-job-handler.js');

    const node = makeNode('n1');
    const nodeMap = new Map<string, any>([['n1', node]]);
    const edges: any[] = [{ id: 'e1', source: 'n1', target: 'n2' }];
    const nodeOutputs: Record<string, unknown> = {};

    await enqueueWorkflowLevel(
      'wf-1',
      'log-1',
      'user1',
      ['n1'],
      nodeMap,
      edges,
      { var1: 'value1' },
      nodeOutputs
    );

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const payload = mockEnqueue.mock.calls[0]![1] as any;
    expect(payload.workflowId).toBe('wf-1');
    expect(payload.nodeId).toBe('n1');
    expect(payload.workflowRunId).toBe('log-1');
    expect(payload.userId).toBe('user1');
    expect(payload.workflowSnapshot.variables).toEqual({ var1: 'value1' });
    expect(payload.orchestrateDownstream).toBe(false);
  });

  it('copies nodeOutputs snapshot per job to avoid concurrent mutations', async () => {
    const { enqueueWorkflowLevel } = await import('./workflow-node-job-handler.js');

    const nodeMap = new Map<string, any>([['n1', makeNode('n1')]]);
    const edges: any[] = [];
    const nodeOutputs: Record<string, unknown> = {};

    await enqueueWorkflowLevel('wf-1', 'log-1', 'user1', ['n1'], nodeMap, edges, {}, nodeOutputs);

    const payload = mockEnqueue.mock.calls[0]![1] as any;
    // Snapshot is a copy, not the original reference
    expect(payload.nodeOutputs).toEqual({});
    expect(payload.nodeOutputs).not.toBe(nodeOutputs);
  });
});

describe('registerWorkflowNodeWorker', () => {
  it('registers a worker with the job queue', async () => {
    mockStartWorker.mockReset().mockReturnValue(() => {});

    const { registerWorkflowNodeWorker } = await import('./workflow-node-job-handler.js');
    const deregister = registerWorkflowNodeWorker();

    expect(mockStartWorker).toHaveBeenCalledTimes(1);
    const call = mockStartWorker.mock.calls[0]!;
    expect(call[1]).toMatchObject({ queue: 'workflow_nodes', concurrency: 4 });
    deregister();
  });
});
