/**
 * DAG utilities — Topological sort and graph traversal for workflow execution.
 */

import type { WorkflowNode, WorkflowEdge } from '../../db/repositories/workflows/index.js';

/**
 * Simple node/edge types for validation (before conversion to WorkflowNode/Edge)
 */
export interface ValidationNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface ValidationEdge {
  source: string;
  target: string;
  sourceHandle?: string;
}

/**
 * Topological sort using Kahn's algorithm.
 * Returns an array of "levels" — each level contains node IDs that can run in parallel.
 * Throws if a cycle is detected.
 */
export function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[][] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const levels: string[][] = [];
  let queue = [...nodeIds].filter((id) => inDegree.get(id) === 0);
  let processed = 0;

  while (queue.length > 0) {
    levels.push([...queue]);
    processed += queue.length;

    const nextQueue: string[] = [];
    for (const nodeId of queue) {
      for (const neighbor of adjacency.get(nodeId) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          nextQueue.push(neighbor);
        }
      }
    }
    queue = nextQueue;
  }

  if (processed < nodeIds.size) {
    throw new Error('Workflow contains a cycle — cannot execute');
  }

  return levels;
}

/** Build a source -> targets adjacency map from edges. */
function buildAdjacency(edges: WorkflowEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adj.get(edge.source);
    if (list) list.push(edge.target);
    else adj.set(edge.source, [edge.target]);
  }
  return adj;
}

/**
 * Get all downstream node IDs reachable from a given node.
 */
export function getDownstreamNodes(nodeId: string, edges: WorkflowEdge[]): Set<string> {
  const adj = buildAdjacency(edges);
  const downstream = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const target of adj.get(current) ?? []) {
      if (!downstream.has(target)) {
        downstream.add(target);
        queue.push(target);
      }
    }
  }
  return downstream;
}

/**
 * Get all downstream node IDs reachable from a specific output handle of a node.
 * Used for conditional branching — to skip nodes on the not-taken branch.
 */
export function getDownstreamNodesByHandle(
  nodeId: string,
  handle: string,
  edges: WorkflowEdge[]
): Set<string> {
  const adj = buildAdjacency(edges);
  const downstream = new Set<string>();
  const queue = edges
    .filter((e) => e.source === nodeId && e.sourceHandle === handle)
    .map((e) => e.target);

  while (queue.length > 0) {
    const current = queue.pop()!;
    if (downstream.has(current)) continue;
    downstream.add(current);
    for (const target of adj.get(current) ?? []) {
      if (!downstream.has(target)) {
        queue.push(target);
      }
    }
  }
  return downstream;
}

/**
 * Get body-only and done-only nodes for a ForEach node.
 * Body = nodes reachable from "each" handle but NOT from "done" handle.
 * Done = nodes reachable from "done" handle.
 */
export function getForEachBodyNodes(
  nodeId: string,
  edges: WorkflowEdge[]
): { bodyNodes: Set<string>; doneNodes: Set<string> } {
  const eachDownstream = getDownstreamNodesByHandle(nodeId, 'each', edges);
  const doneDownstream = getDownstreamNodesByHandle(nodeId, 'done', edges);

  const bodyNodes = new Set<string>();
  for (const id of eachDownstream) {
    if (!doneDownstream.has(id)) bodyNodes.add(id);
  }

  return { bodyNodes, doneNodes: doneDownstream };
}

/**
 * Detect cycles in workflow graph using DFS.
 * Returns error message if cycle found, null otherwise.
 * This runs at save time to prevent cycles before execution.
 */
export function detectCycle(nodes: ValidationNode[], edges: ValidationEdge[]): string | null {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const adjacency = new Map<string, string[]>();

  // Build adjacency list
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      adjacency.get(edge.source)!.push(edge.target);
    }
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    for (const neighbor of adjacency.get(nodeId) ?? []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        // Cycle found
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) {
        return `Workflow contains a cycle involving node "${node.id}"`;
      }
    }
  }

  return null;
}
