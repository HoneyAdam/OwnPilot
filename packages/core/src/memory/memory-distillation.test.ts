import { describe, it, expect } from 'vitest';
import {
  buildMemoryExtractionPrompt,
  parseMemoryCandidates,
  buildConsolidationPrompt,
  parseConsolidation,
  buildRecallSummaryPrompt,
  cosineSimilarity,
  MAX_MEMORIES_PER_PASS,
  MAX_MEMORY_CONTENT_CHARS,
} from './memory-distillation.js';

describe('buildMemoryExtractionPrompt', () => {
  it('includes the conversation text and JSON-array instruction', () => {
    const p = buildMemoryExtractionPrompt('user: I love hiking');
    expect(p).toContain('I love hiking');
    expect(p).toContain('JSON array');
    expect(p).toContain('"type"');
  });
});

describe('parseMemoryCandidates', () => {
  it('parses a plain JSON array', () => {
    const out = parseMemoryCandidates(
      '[{"type":"preference","content":"User prefers dark mode","importance":0.8,"tags":["ui"]}]'
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: 'preference',
      content: 'User prefers dark mode',
      importance: 0.8,
      tags: ['ui'],
    });
  });

  it('tolerates code fences and surrounding prose', () => {
    const raw = 'Here:\n```json\n[{"type":"fact","content":"User lives in Berlin"}]\n```\ndone';
    const out = parseMemoryCandidates(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.content).toBe('User lives in Berlin');
    expect(out[0]!.importance).toBe(0.5); // default
    expect(out[0]!.tags).toEqual([]);
  });

  it('drops items with invalid or missing type', () => {
    const out = parseMemoryCandidates(
      '[{"type":"bogus","content":"x"},{"content":"y"},{"type":"fact","content":"keep me"}]'
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.content).toBe('keep me');
  });

  it('drops empty content and clamps importance to 0..1', () => {
    const out = parseMemoryCandidates(
      '[{"type":"fact","content":"  ","importance":0.9},{"type":"fact","content":"ok","importance":5}]'
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.importance).toBe(1);
  });

  it('dedupes identical type+content (case-insensitive)', () => {
    const out = parseMemoryCandidates(
      '[{"type":"fact","content":"Likes tea"},{"type":"fact","content":"likes tea"}]'
    );
    expect(out).toHaveLength(1);
  });

  it('caps the number of candidates', () => {
    const items = Array.from({ length: MAX_MEMORIES_PER_PASS + 10 }, (_, i) => ({
      type: 'fact',
      content: `fact number ${i}`,
    }));
    const out = parseMemoryCandidates(JSON.stringify(items));
    expect(out.length).toBe(MAX_MEMORIES_PER_PASS);
  });

  it('truncates over-long content', () => {
    const long = 'a'.repeat(MAX_MEMORY_CONTENT_CHARS + 200);
    const out = parseMemoryCandidates(`[{"type":"fact","content":"${long}"}]`);
    expect(out[0]!.content.length).toBe(MAX_MEMORY_CONTENT_CHARS);
  });

  it('returns [] for non-array or garbage', () => {
    expect(parseMemoryCandidates('not json')).toEqual([]);
    expect(parseMemoryCandidates('{"type":"fact"}')).toEqual([]);
  });
});

describe('buildConsolidationPrompt / parseConsolidation', () => {
  it('lists the contents to merge', () => {
    const p = buildConsolidationPrompt(['User has a dog', 'User has a dog named Rex']);
    expect(p).toContain('User has a dog named Rex');
    expect(p).toContain('ONE clear');
  });

  it('parses a plain merged statement', () => {
    expect(parseConsolidation('User has a dog named Rex.')).toBe('User has a dog named Rex.');
  });

  it('strips fences and wrapping quotes', () => {
    expect(parseConsolidation('```\nUser likes tea\n```')).toBe('User likes tea');
    expect(parseConsolidation('"User likes tea"')).toBe('User likes tea');
  });

  it('returns null for empty', () => {
    expect(parseConsolidation('   ')).toBeNull();
  });
});

describe('buildRecallSummaryPrompt', () => {
  it('includes query and facts and an only-use-these instruction', () => {
    const p = buildRecallSummaryPrompt('Where does the user live?', ['User lives in Berlin']);
    expect(p).toContain('Where does the user live?');
    expect(p).toContain('User lives in Berlin');
    expect(p).toContain('ONLY');
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });
  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });
  it('returns 0 on length mismatch or empty', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });
  it('returns 0 on zero-magnitude vector', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});
