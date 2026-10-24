import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import { sameTierCycle, type Neighbourhood } from './model';

// Lays out an ego graph in tiers with ELK's layered algorithm: top to bottom by record level
// (product, domain, aggregates and use cases, rules and requirements, design records, tests), or
// left to right along a trace. Each node's tier becomes an ELK partition, so a tier is one layer;
// within a tier nodes keep the model's order (stage, kind, ID), so re-centring is predictable.
// Links between records in the same tier are drawn but do not shape the layout. When those links
// form a cycle the graph cannot be read as tiers, and it is drawn radially around the focus instead.
// Positions are shifted so the focus's centre is at (0, 0).

export const NODE_WIDTH = 190;
export const NODE_HEIGHT = 56;

const elk = new ELK();

export type Point = { x: number; y: number };

export interface Placed {
  /** Top-left corner of each node, keyed by node ID. */
  positions: Map<string, Point>;
  /** 'layered' (in tiers) or 'radial' (the fallback). */
  layout: 'layered' | 'radial';
  /** For the radial fallback: the same-tier cycle that prevented tiers. */
  cycle: string[] | null;
}

/** The ELK graph for a tiered layout: one partition per tier, edges only between tiers, pointing down the tiers. */
export function layeredGraph(n: Neighbourhood): ElkNode {
  const tiers = [...new Set(n.nodes.map((x) => x.tier))].sort((a, b) => a - b);
  const rank = new Map(tiers.map((t, i) => [t, i]));
  const tierOf = new Map(n.nodes.map((x) => [x.id, x.tier]));
  const pairs = new Map<string, { source: string; target: string }>();
  for (const e of n.edges) {
    const s = tierOf.get(e.source);
    const t = tierOf.get(e.target);
    if (s === undefined || t === undefined || s === t) continue;
    const [source, target] = s < t ? [e.source, e.target] : [e.target, e.source];
    pairs.set(`${source}|${target}`, { source, target });
  }
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': n.mode === 'trace' ? 'RIGHT' : 'DOWN',
      'elk.partitioning.activate': 'true',
      'elk.separateConnectedComponents': 'false',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',      'elk.layered.spacing.nodeNodeBetweenLayers': n.mode === 'trace' ? '110' : '80',
      'elk.spacing.nodeNode': '28',
    },
    children: n.nodes.map((node) => ({
      id: node.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      layoutOptions: { 'elk.partitioning.partition': String(rank.get(node.tier)) },
    })),
    edges: [...pairs.values()].map((p, i) => ({ id: `e${i}`, sources: [p.source], targets: [p.target] })),
  };
}

function radialGraph(n: Neighbourhood): ElkNode {
  return {
    id: 'root',
    layoutOptions: { 'elk.algorithm': 'radial', 'elk.radial.radius': '260', 'elk.spacing.nodeNode': '24' },
    children: n.nodes.map((node) => ({ id: node.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: n.nodes
      .filter((node) => n.via.has(node.id))
      .map((node, i) => ({ id: `t${i}`, sources: [n.via.get(node.id)!], targets: [node.id] })),
  };
}

export async function layoutNeighbourhood(n: Neighbourhood): Promise<Placed> {
  const positions = new Map<string, Point>();
  const cycle = sameTierCycle(n);
  const layout = cycle ? 'radial' : 'layered';
  if (n.nodes.length === 0) return { positions, layout, cycle };
  if (n.nodes.length === 1) {
    positions.set(n.focus, { x: -NODE_WIDTH / 2, y: -NODE_HEIGHT / 2 });
    return { positions, layout, cycle };
  }
  const laid = await elk.layout(cycle ? radialGraph(n) : layeredGraph(n));
  const focus = laid.children?.find((c) => c.id === n.focus);
  const dx = (focus?.x ?? 0) + NODE_WIDTH / 2;
  const dy = (focus?.y ?? 0) + NODE_HEIGHT / 2;
  for (const c of laid.children ?? []) positions.set(c.id, { x: Math.round((c.x ?? 0) - dx), y: Math.round((c.y ?? 0) - dy) });
  return { positions, layout, cycle };
}

/** The point where the line from a box's centre towards (tx, ty) leaves the box. */
export function boxExit(cx: number, cy: number, tx: number, ty: number, w = NODE_WIDTH, h = NODE_HEIGHT) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = 1 / Math.max(Math.abs(dx) / (w / 2), Math.abs(dy) / (h / 2));
  return { x: cx + dx * scale, y: cy + dy * scale };
}
