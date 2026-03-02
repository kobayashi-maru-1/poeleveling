import type { SkillTree } from "../../../../common/data/tree";
import type { UrlTree } from "./url-tree";
import type { ViewBox } from "./svg";

export interface UrlTreeDelta {
  nodesActive: string[];
  nodesAdded: string[];
  nodesRemoved: string[];
  connectionsActive: string[];
  connectionsAdded: string[];
  connectionsRemoved: string[];
  masteries: Record<string, string>;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>();
  for (const v of b) if (a.has(v)) out.add(v);
  return out;
}

function difference<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>(a);
  for (const v of b) out.delete(v);
  return out;
}

export function buildUrlTreeDelta(
  current: UrlTree.Data,
  previous: UrlTree.Data,
  skillTree: SkillTree.Data
): UrlTreeDelta {
  const curNodes = new Set(current.nodes);
  const prevNodes = new Set(previous.nodes);

  for (const [nodeId, effectId] of Object.entries(current.masteries)) {
    if (previous.masteries[nodeId] !== effectId) prevNodes.delete(nodeId);
  }

  const nodesActive  = intersection(curNodes, prevNodes);
  const nodesAdded   = difference(curNodes, prevNodes);
  const nodesRemoved = difference(prevNodes, curNodes);

  if (current.ascendancy !== undefined)
    nodesActive.add(current.ascendancy.startNodeId);

  const masteries = buildMasteryEffects(current, previous);
  const connections = buildConnections(nodesActive, nodesAdded, nodesRemoved, skillTree);

  return {
    nodesActive:  Array.from(nodesActive),
    nodesAdded:   Array.from(nodesAdded),
    nodesRemoved: Array.from(nodesRemoved),
    ...connections,
    masteries,
  };
}

function buildMasteryEffects(current: UrlTree.Data, previous: UrlTree.Data) {
  const masteries: Record<string, string> = {};
  for (const lookup of [previous.masteries, current.masteries])
    for (const [id, eff] of Object.entries(lookup))
      masteries[id] = eff;
  return masteries;
}

function buildConnections(
  active: Set<string>,
  added: Set<string>,
  removed: Set<string>,
  skillTree: SkillTree.Data
) {
  const connectionsActive: string[] = [];
  const connectionsAdded: string[] = [];
  const connectionsRemoved: string[] = [];

  for (const graph of skillTree.graphs) {
    for (const conn of graph.connections) {
      const id = `${conn.a}-${conn.b}`;
      const aA = active.has(conn.a),  bA = active.has(conn.b);
      const aN = added.has(conn.a),   bN = added.has(conn.b);
      const aR = removed.has(conn.a), bR = removed.has(conn.b);

      if (aA && bA) connectionsActive.push(id);
      if ((aN && (bN || bA)) || (bN && (aN || aA))) connectionsAdded.push(id);
      if ((aR && (bR || bA)) || (bR && (aR || aA))) connectionsRemoved.push(id);
    }
  }
  return { connectionsActive, connectionsAdded, connectionsRemoved };
}

export function calculateBounds(
  nodesActive: string[],
  nodesAdded: string[],
  nodesRemoved: string[],
  nodes: SkillTree.NodeLookup,
  viewBox: ViewBox
): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const update = (id: string) => {
    const n = nodes[id];
    if (!n) return;
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
  };

  if (nodesAdded.length === 0 && nodesRemoved.length === 0) {
    nodesActive.forEach(update);
  } else {
    nodesAdded.forEach(update);
    nodesRemoved.forEach(update);
  }

  const pad = 1250;
  return {
    x: minX - pad - viewBox.x,
    y: minY - pad - viewBox.y,
    width:  maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}
