/**
 * MemoryEngine tests — uses the REAL distillation helpers from core, mocks only
 * the MemoryService and the MemoriesRepository.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockService, mockRepo, createMemoriesRepository } = vi.hoisted(() => {
  const mockService = {
    rememberMemory: vi.fn(),
    hybridSearch: vi.fn(),
  };
  const mockRepo = {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    decay: vi.fn(),
    cleanup: vi.fn(),
  };
  const createMemoriesRepository = vi.fn(() => mockRepo);
  return { mockService, mockRepo, createMemoriesRepository };
});

vi.mock('@ownpilot/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getLog: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
    getMemoryService: () => mockService,
  };
});

vi.mock('../../db/repositories/memories.js', () => ({
  createMemoriesRepository,
}));

const { getMemoryEngine } = await import('./engine.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('extractFromConversations', () => {
  it('stores parsed candidates and counts created vs deduplicated', async () => {
    const complete = vi.fn(async () =>
      JSON.stringify([
        { type: 'preference', content: 'User prefers dark mode', importance: 0.8 },
        { type: 'fact', content: 'User lives in Berlin' },
      ])
    );
    mockService.rememberMemory
      .mockResolvedValueOnce({ memory: { id: 'a' }, deduplicated: false })
      .mockResolvedValueOnce({ memory: { id: 'b' }, deduplicated: true });

    const res = await getMemoryEngine().extractFromConversations('u1', 'user: hi', complete);

    expect(res).toEqual({ extracted: 2, created: 1, deduplicated: 1 });
    expect(mockService.rememberMemory).toHaveBeenCalledTimes(2);
    expect(mockService.rememberMemory).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ source: 'memory_extract', type: 'preference' })
    );
  });

  it('no-ops on empty conversation text', async () => {
    const complete = vi.fn();
    const res = await getMemoryEngine().extractFromConversations('u1', '   ', complete);
    expect(res).toEqual({ extracted: 0, created: 0, deduplicated: 0 });
    expect(complete).not.toHaveBeenCalled();
  });

  it('returns zero when the model finds nothing', async () => {
    const complete = vi.fn(async () => '[]');
    const res = await getMemoryEngine().extractFromConversations('u1', 'user: hi', complete);
    expect(res.extracted).toBe(0);
    expect(mockService.rememberMemory).not.toHaveBeenCalled();
  });
});

describe('consolidate', () => {
  const mem = (id: string, content: string, embedding: number[], importance = 0.5) => ({
    id,
    userId: 'u1',
    type: 'fact' as const,
    content,
    embedding,
    importance,
    tags: [],
    accessCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
  });

  it('merges a near-duplicate cluster and retires the originals', async () => {
    mockRepo.list.mockResolvedValue([
      mem('1', 'User has a dog', [1, 0, 0], 0.5),
      mem('2', 'User has a dog named Rex', [0.99, 0.01, 0], 0.7),
      mem('3', 'User lives in Berlin', [0, 1, 0], 0.6),
    ]);
    mockRepo.create.mockResolvedValue({ id: 'merged' });
    mockRepo.delete.mockResolvedValue(true);
    mockRepo.decay.mockResolvedValue(2);
    mockRepo.cleanup.mockResolvedValue(1);

    const complete = vi.fn(async () => 'User has a dog named Rex.');
    const res = await getMemoryEngine().consolidate('u1', complete);

    expect(res.clusters).toBe(1);
    expect(res.merged).toBe(1);
    expect(res.removed).toBe(2);
    expect(res.decayed).toBe(2);
    expect(res.cleaned).toBe(1);
    // merged memory keeps the higher importance (0.7)
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ importance: 0.7, source: 'memory_consolidate', type: 'fact' })
    );
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('skips clustering when fewer than 2 embedded memories, still decays/cleans', async () => {
    mockRepo.list.mockResolvedValue([mem('1', 'solo', [1, 0, 0])]);
    mockRepo.decay.mockResolvedValue(3);
    mockRepo.cleanup.mockResolvedValue(0);

    const complete = vi.fn();
    const res = await getMemoryEngine().consolidate('u1', complete);

    expect(res.merged).toBe(0);
    expect(res.skippedReason).toBeTruthy();
    expect(res.decayed).toBe(3);
    expect(complete).not.toHaveBeenCalled();
  });

  it('does not merge across different types', async () => {
    mockRepo.list.mockResolvedValue([
      { ...mem('1', 'a', [1, 0, 0]), type: 'fact' },
      { ...mem('2', 'b', [1, 0, 0]), type: 'preference' },
    ]);
    mockRepo.decay.mockResolvedValue(0);
    mockRepo.cleanup.mockResolvedValue(0);

    const res = await getMemoryEngine().consolidate('u1', vi.fn());
    expect(res.merged).toBe(0);
    expect(res.clusters).toBe(0);
  });
});

describe('recall', () => {
  it('summarizes hybrid-search hits and returns sources', async () => {
    mockService.hybridSearch.mockResolvedValue([
      { id: '1', content: 'User lives in Berlin', score: 0.9 },
      { id: '2', content: 'User works as an engineer', score: 0.7 },
    ]);
    const complete = vi.fn(async () => 'The user lives in Berlin and is an engineer.');

    const res = await getMemoryEngine().recall('u1', 'tell me about the user', complete);

    expect(res.summary).toContain('Berlin');
    expect(res.sources).toHaveLength(2);
    expect(res.sources[0]).toEqual({ id: '1', content: 'User lives in Berlin', score: 0.9 });
  });

  it('returns an empty-state summary when nothing matches', async () => {
    mockService.hybridSearch.mockResolvedValue([]);
    const complete = vi.fn();
    const res = await getMemoryEngine().recall('u1', 'anything?', complete);
    expect(res.sources).toHaveLength(0);
    expect(complete).not.toHaveBeenCalled();
  });

  it('falls back to raw matches if summarization throws', async () => {
    mockService.hybridSearch.mockResolvedValue([{ id: '1', content: 'fact one', score: 0.5 }]);
    const complete = vi.fn(async () => {
      throw new Error('llm down');
    });
    const res = await getMemoryEngine().recall('u1', 'q', complete);
    expect(res.summary).toContain('fact one');
    expect(res.sources).toHaveLength(1);
  });
});
