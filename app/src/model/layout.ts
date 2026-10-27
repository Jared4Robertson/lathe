import type { ElkNode } from 'elkjs/lib/elk-api';
import { elkLayout } from '../elk';
import { boxSize, type Erd, type Rect } from './erd';

// Lays out a model with ELK's layered algorithm, left to right along its lines, in event storming
// order: policies, commands, specifications, aggregates (or entities), events, then read models and
// queries. A box that belongs to another (an event to its aggregate or root entity, a query to its read
// model) gets an unseen edge from it, so it sits in a later layer. The diagram's own boxes come first
// in model order and the faded context after them, so the same diagram always gets the same picture.

export function erdGraph(erd: Erd): ElkNode {
  const ordered = [...erd.boxes.filter((b) => !b.context), ...erd.boxes.filter((b) => b.context)];
  const ids = new Set(erd.boxes.map((b) => b.id));
  const belongs = erd.boxes.filter((b) => b.parent && ids.has(b.parent)).map((b) => ({ sources: [b.parent!], targets: [b.id] }));
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.spacing.nodeNode': '28',
      'elk.spacing.componentComponent': '60',
    },
    children: ordered.map((b) => ({ id: b.id, ...boxSize(b) })),
    edges: [
      ...erd.lines.map((l, i) => ({ id: `e${i}`, sources: [l.source], targets: [l.target] })),
      ...belongs.map((e, i) => ({ id: `b${i}`, ...e })),
    ],
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
