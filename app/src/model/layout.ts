import type { ElkNode } from 'elkjs/lib/elk-api';
import { elkLayout } from '../elk';
import { boxSize, type Erd, type Rect } from './erd';

// Lays out an ERD with ELK's layered algorithm, left to right along its lines, as the graph does.
// The diagram's own boxes come first in model order and the boxes from elsewhere after them, so the
// same diagram always gets the same picture.

export function erdGraph(erd: Erd): ElkNode {
  const ordered = [...erd.boxes.filter((b) => !b.foreign), ...erd.boxes.filter((b) => b.foreign)];
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.spacing.nodeNode': '40',
      'elk.spacing.componentComponent': '60',
      // With domain events, each box goes in the first layer its lines allow, so an event sits in
      // the layer right after the entity raising it and its line stays short (LA-EXP-UC11-R07);
      // the aggregates reacting to it come after.
      ...(erd.boxes.some((b) => b.kind === 'event') ? { 'elk.layered.layering.strategy': 'LONGEST_PATH_SOURCE' } : {}),
    },
    children: ordered.map((b) => ({ id: b.id, ...boxSize(b) })),
    edges: erd.lines.map((l, i) => ({ id: `e${i}`, sources: [l.source], targets: [l.target] })),
  };
}

/** Each box's place and size. */
export async function layoutErd(erd: Erd): Promise<Map<string, Rect>> {
  const out = new Map<string, Rect>();
  if (erd.boxes.length === 0) return out;
  const laid = await elkLayout(erdGraph(erd));
  for (const c of laid.children ?? []) out.set(c.id, { x: Math.round(c.x ?? 0), y: Math.round(c.y ?? 0), width: c.width ?? 0, height: c.height ?? 0 });
  return out;
}
