import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { Neighbourhood } from './model';

// Lays out an ego graph in columns with ELK's layered algorithm, left to right: by depth in the
// parent/child tree around the focus, or along a trace. The model gives each node its column and
// its row within the column; each column becomes an ELK partition, so a column is one layer, and
// within a column ELK keeps the model's rows, so re-centring is predictable. Every link between two
// columns is laid out pointing to the right, whichever way it really points, and links between
// records in one column (siblings that refer to each other) are drawn but do not shape the layout.
// So the layout graph never has a cycle and every graph can be drawn in columns.
// Positions are shifted so the focus's centre is at (0, 0).

export const NODE_WIDTH = 190;
export const NODE_HEIGHT = 56;

const elk = new ELK();

export type Point = { x: number; y: number };

export interface Placed {
  /** Top-left corner of each node, keyed by node ID. */
  positions: Map<string, Point>;
  /**
   * Always 'layered': columns lay out every graph. 'radial' and `cycle` remain only so the graph
   * page's old fallback notice still compiles; they are never produced.
   */
  layout: 'layered' | 'radial';
  cycle: string[] | null;
}

/** The ELK graph for a layout in columns: one partition per column, nodes in column and row order, edges only between columns, pointing right. */
export function layeredGraph(n: Neighbourhood): ElkNode {
  const columns = [...new Set(n.nodes.map((x) => x.column))].sort((a, b) => a - b);
  const rank = new Map(columns.map((c, i) => [c, i]));
  const columnOf = new Map(n.nodes.map((x) => [x.id, x.column]));
  const pairs = new Map<string, { source: string; target: string }>();
  for (const e of n.edges) {
    const s = columnOf.get(e.source);
    const t = columnOf.get(e.target);
    if (s === undefined || t === undefined || s === t) continue;
    const [source, target] = s < t ? [e.source, e.target] : [e.target, e.source];
    pairs.set(`${source}|${target}`, { source, target });
  }
  const ordered = [...n.nodes].sort((a, b) => a.column - b.column || a.row - b.row);
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.partitioning.activate': 'true',
      'elk.separateConnectedComponents': 'false',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
      'elk.layered.spacing.nodeNodeBetweenLayers': '110',
      'elk.spacing.nodeNode': '28',
    },
    children: ordered.map((node) => ({
      id: node.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      layoutOptions: { 'elk.partitioning.partition': String(rank.get(node.column)) },
    })),
    edges: [...pairs.values()].map((p, i) => ({ id: `e${i}`, sources: [p.source], targets: [p.target] })),
  };
}

export async function layoutNeighbourhood(n: Neighbourhood): Promise<Placed> {
  const positions = new Map<string, Point>();
  const placed: Placed = { positions, layout: 'layered', cycle: null };
  if (n.nodes.length === 0) return placed;
  if (n.nodes.length === 1) {
    positions.set(n.focus, { x: -NODE_WIDTH / 2, y: -NODE_HEIGHT / 2 });
    return placed;
  }
  const laid = await elk.layout(layeredGraph(n));
  const focus = laid.children?.find((c) => c.id === n.focus);
  const dx = (focus?.x ?? 0) + NODE_WIDTH / 2;
  const dy = (focus?.y ?? 0) + NODE_HEIGHT / 2;
  for (const c of laid.children ?? []) positions.set(c.id, { x: Math.round((c.x ?? 0) - dx), y: Math.round((c.y ?? 0) - dy) });
  return placed;
}

/** The point where the line from a box's centre towards (tx, ty) leaves the box. */
export function boxExit(cx: number, cy: number, tx: number, ty: number, w = NODE_WIDTH, h = NODE_HEIGHT) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = 1 / Math.max(Math.abs(dx) / (w / 2), Math.abs(dy) / (h / 2));
  return { x: cx + dx * scale, y: cy + dy * scale };
}
