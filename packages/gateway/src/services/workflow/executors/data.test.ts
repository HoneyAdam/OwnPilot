import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkflowNode, NodeResult } from '../../../db/repositories/workflows/index.js';
import { executeSchemaValidatorNode, executeDataStoreNode, clearDataStore } from './data.js';

// --- Mocks ---

const mockResolveTemplates = vi.hoisted(() => {
  return (obj: Record<string, unknown>) => obj;
});

vi.mock('../template-resolver.js', () => ({
  resolveTemplates: mockResolveTemplates,
}));

beforeEach(() => {
  clearDataStore();
  vi.clearAllMocks();
});

// --- Helpers ---

function makeNode(id: string, data: unknown): WorkflowNode {
  return { id, name: id, type: 'test', data: data as never, nextNodes: [] };
}

// --- executeSchemaValidatorNode ---

describe('executeSchemaValidatorNode', () => {
  it('returns valid=true when all required fields are present and types match', () => {
    const node = makeNode('v1', {
      schema: {
        type: 'object',
        properties: { name: { type: 'string' }, age: { type: 'number' } },
        required: ['name'],
      },
    });
    const nodeOutputs = { src: { output: { name: 'Alice', age: 30 } } as unknown as NodeResult };
    const result = executeSchemaValidatorNode(node, nodeOutputs, {});
    expect(result.status).toBe('success');
    expect(result.output).toEqual({ valid: true, errors: [] });
  });

  it('returns valid=false when required field is missing', () => {
    const node = makeNode('v2', {
      schema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name', 'email'],
      },
    });
    const nodeOutputs = { src: { output: { name: 'Alice' } } as unknown as NodeResult };
    const result = executeSchemaValidatorNode(node, nodeOutputs, {});
    expect(result.output).toEqual({
      valid: false,
      errors: ['Missing required field: "email"'],
    });
  });

  it('returns valid=false when field type does not match schema', () => {
    const node = makeNode('v3', {
      schema: {
        type: 'object',
        properties: { age: { type: 'number' } },
      },
    });
    const nodeOutputs = { src: { output: { age: 'thirty' } } as unknown as NodeResult };
    const result = executeSchemaValidatorNode(node, nodeOutputs, {});
    expect(result.output).toEqual({
      valid: false,
      errors: ['Field "age" expected type "number", got "string"'],
    });
  });

  it('returns valid=true when data is null and schema type is object', () => {
    // JS quirk: typeof null === 'object'. The schema validator checks
    // typeof inputData === 'object' && inputData !== null separately, so null
    // falls through to the else-if which compares typeof null to the schema type.
    const node = makeNode('v4', {
      schema: { type: 'object' },
    });
    const nodeOutputs = { src: { output: null } as unknown as NodeResult };
    const result = executeSchemaValidatorNode(node, nodeOutputs, {});
    expect(result.output).toEqual({ valid: true, errors: [] });
  });

  it('returns error result when schema type is a scalar and data matches', () => {
    const node = makeNode('v5', {
      schema: { type: 'string' },
    });
    const nodeOutputs = { src: { output: 'hello' } as unknown as NodeResult };
    const result = executeSchemaValidatorNode(node, nodeOutputs, {});
    expect(result.output).toEqual({ valid: true, errors: [] });
  });

  it('combines multiple errors', () => {
    const node = makeNode('v6', {
      schema: {
        type: 'object',
        properties: { name: { type: 'string' }, count: { type: 'number' } },
        required: ['name', 'count'],
      },
    });
    const nodeOutputs = {
      src: { output: { count: 'five' } } as unknown as NodeResult,
    };
    const result = executeSchemaValidatorNode(node, nodeOutputs, {});
    expect(result.output).toEqual({
      valid: false,
      errors: expect.arrayContaining([
        'Missing required field: "name"',
        'Field "count" expected type "number", got "string"',
      ]),
    });
  });

  it('returns error status when strict=true and validation fails', () => {
    const node = makeNode('v7', {
      schema: { type: 'number' },
      strict: true,
    });
    const nodeOutputs = { src: { output: 'not-a-number' } as unknown as NodeResult };
    const result = executeSchemaValidatorNode(node, nodeOutputs, {});
    expect(result.status).toBe('error');
    expect(result.error).toContain('Validation failed');
  });

  it('returns success status when strict=true and validation passes', () => {
    const node = makeNode('v8', {
      schema: { type: 'string' },
      strict: true,
    });
    const nodeOutputs = { src: { output: 'ok' } as unknown as NodeResult };
    const result = executeSchemaValidatorNode(node, nodeOutputs, {});
    expect(result.status).toBe('success');
  });
});

// --- executeDataStoreNode ---

describe('executeDataStoreNode', () => {
  it('set and get a value', () => {
    const setNode = makeNode('set1', {
      operation: 'set',
      key: 'k1',
      value: 'secret',
      namespace: 'ns1',
    });
    const getNode = makeNode('get1', { operation: 'get', key: 'k1', namespace: 'ns1' });
    const setResult = executeDataStoreNode(setNode, {}, {});
    expect(setResult.status).toBe('success');
    expect((setResult.output as { previousValue: unknown }).previousValue).toBeNull();

    const getResult = executeDataStoreNode(getNode, {}, {});
    expect(getResult.status).toBe('success');
    expect(getResult.output).toBe('secret');
  });

  it('returns previousValue when overwriting', () => {
    const set1 = makeNode('s1', { operation: 'set', key: 'counter', value: 10 });
    const set2 = makeNode('s2', { operation: 'set', key: 'counter', value: 20 });
    executeDataStoreNode(set1, {}, {});
    const result = executeDataStoreNode(set2, {}, {});
    expect((result.output as { previousValue: number }).previousValue).toBe(10);
  });

  it('delete returns existed=true when key existed', () => {
    const setNode = makeNode('set2', { operation: 'set', key: 'delkey', value: 1 });
    const delNode = makeNode('del1', { operation: 'delete', key: 'delkey' });
    executeDataStoreNode(setNode, {}, {});
    const result = executeDataStoreNode(delNode, {}, {});
    expect((result.output as { existed: boolean }).existed).toBe(true);
  });

  it('delete returns existed=false when key did not exist', () => {
    const delNode = makeNode('del2', { operation: 'delete', key: 'notexist' });
    const result = executeDataStoreNode(delNode, {}, {});
    expect((result.output as { existed: boolean }).existed).toBe(false);
  });

  it('list returns all keys in namespace', () => {
    const set1 = makeNode('l1', { operation: 'set', key: 'a', value: 1, namespace: 'listns' });
    const set2 = makeNode('l2', { operation: 'set', key: 'b', value: 2, namespace: 'listns' });
    executeDataStoreNode(set1, {}, {});
    executeDataStoreNode(set2, {}, {});
    const listNode = makeNode('list1', { operation: 'list', namespace: 'listns' });
    const result = executeDataStoreNode(listNode, {}, {});
    expect(Array.isArray(result.output)).toBe(true);
    expect((result.output as string[]).sort()).toEqual(['a', 'b']);
  });

  it('has returns true when key exists', () => {
    const setNode = makeNode('h1', { operation: 'set', key: 'exists', value: true });
    const hasNode = makeNode('has1', { operation: 'has', key: 'exists' });
    executeDataStoreNode(setNode, {}, {});
    const result = executeDataStoreNode(hasNode, {}, {});
    expect(result.output).toBe(true);
  });

  it('has returns false when key does not exist', () => {
    const hasNode = makeNode('has2', { operation: 'has', key: 'notthere' });
    const result = executeDataStoreNode(hasNode, {}, {});
    expect(result.output).toBe(false);
  });

  it('returns null when get key does not exist', () => {
    const getNode = makeNode('get2', { operation: 'get', key: 'missing' });
    const result = executeDataStoreNode(getNode, {}, {});
    expect(result.status).toBe('success');
    expect(result.output).toBeNull();
  });

  it('uses default namespace when none provided', () => {
    const setNode = makeNode('d1', { operation: 'set', key: 'dk', value: 'default-val' });
    const getNode = makeNode('d2', { operation: 'get', key: 'dk' });
    executeDataStoreNode(setNode, {}, {});
    const result = executeDataStoreNode(getNode, {}, {});
    expect(result.output).toBe('default-val');
  });

  it('namespaces are isolated', () => {
    const setA = makeNode('na1', { operation: 'set', key: 'k', value: 'ns-a', namespace: 'nsA' });
    const setB = makeNode('nb1', { operation: 'set', key: 'k', value: 'ns-b', namespace: 'nsB' });
    const getA = makeNode('ngA', { operation: 'get', key: 'k', namespace: 'nsA' });
    const getB = makeNode('ngB', { operation: 'get', key: 'k', namespace: 'nsB' });
    executeDataStoreNode(setA, {}, {});
    executeDataStoreNode(setB, {}, {});
    expect(executeDataStoreNode(getA, {}, {}).output).toBe('ns-a');
    expect(executeDataStoreNode(getB, {}, {}).output).toBe('ns-b');
  });

  it('clearDataStore removes all namespaces', () => {
    const set1 = makeNode('c1', { operation: 'set', key: 'x', value: 1 });
    executeDataStoreNode(set1, {}, {});
    clearDataStore();
    const listNode = makeNode('c2', { operation: 'list' });
    const result = executeDataStoreNode(listNode, {}, {});
    expect(result.output).toEqual([]);
  });

  it('clearDataStore removes specific namespace', () => {
    const set1 = makeNode('cs1', { operation: 'set', key: 'x', value: 1, namespace: 'target' });
    const set2 = makeNode('cs2', { operation: 'set', key: 'x', value: 2, namespace: 'other' });
    executeDataStoreNode(set1, {}, {});
    executeDataStoreNode(set2, {}, {});
    clearDataStore('target');
    const listTarget = makeNode('clt', { operation: 'list', namespace: 'target' });
    const listOther = makeNode('clo', { operation: 'list', namespace: 'other' });
    expect(executeDataStoreNode(listTarget, {}, {}).output).toEqual([]);
    expect(executeDataStoreNode(listOther, {}, {}).output).toEqual(['x']);
  });
});
