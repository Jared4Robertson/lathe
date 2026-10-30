import { kindLabel, type RecordIndex } from '../exploring/record-summaries/record-index';
import { linkLabel } from '../specs/labels';
import { lowerLabel } from '../plural';
import { PARENT } from './model';
import type { Line } from './paint';

// The Map's links as lines (LA-EXP-DS12): what a record is joined to beyond its composition (its links both ways, and
// its parent when it does not nest in it) is drawn only when it is relevant: the focus's and the selection's links,
// labeled by their relation; with All links on, every link between the records drawn, up to MOST_LINKS.

/** The most lines All links draws at once: past it, zoom in to see a smaller area's. */
export const MOST_LINKS = 400;

type Box = { x: number; y: number; w: number; h: number };

/** One link to draw: its ends, its relation and its words read from its source. */
export interface MapLink { source: string; target: string; relation: string; label: string }

/** The links of some records, both ways, and each one's parent where the map does not hold it in it (at any depth), whose ends are both on the map; each once. */
export function linksOf(index: RecordIndex, has: (id: string) => boolean, parentOnMap: (id: string) => string | null, ids: Iterable<string>, most = Infinity): MapLink[] {
  const out = new Map<string, MapLink>();
  const within = (id: string, up: string) => {
    for (let at = parentOnMap(id); at !== null; at = parentOnMap(at)) if (at === up) return true;
    return false;
  };
  const add = (l: MapLink) => { if (out.size < most && has(l.source) && has(l.target) && l.source !== l.target) out.set(`${l.source}|${l.relation}|${l.target}`, l); };
  for (const id of ids) {
    for (const l of index.outgoing.get(id) ?? []) add({ ...l, label: linkLabel(index, l, 'source') });
    for (const l of index.incoming.get(id) ?? []) add({ ...l, label: linkLabel(index, l, 'source') });
    const record = index.byId.get(id);
    if (record?.parent && !within(id, record.parent)) {
      const up = index.byId.get(record.parent);
      add({ source: id, target: record.parent, relation: PARENT, label: `In ${up ? lowerLabel(kindLabel(index, up.kind)) : 'parent'}` });
    }
    for (const c of index.children.get(id) ?? []) {
      if (!within(c.id, id)) add({ source: c.id, target: id, relation: PARENT, label: `In ${lowerLabel(kindLabel(index, index.byId.get(id)?.kind ?? ''))}` });
    }
  }
  return [...out.values()];
}

/**
 * A link's line between two boxes: from the side of its source facing its target to the facing side of its target, at
 * their middles, so the curve (paint.ts) leaves and enters square to them: level between boxes side by side, upright
 * between boxes one above the other. `zoom` keeps its stroke at least its width on screen; its words sit by the end
 * `labelNear` names (the focus, where the focus's lines meet, so one name stands for each relation there), else midway.
 */
export function linkLine(link: MapLink, a: Box, b: Box, zoom: number, labelNear?: 'source' | 'target'): Line {
  const beside = b.x >= a.x + a.w || b.x + b.w <= a.x;
  const stacked = !beside && (b.y >= a.y + a.h || b.y + b.h <= a.y);
  const right = b.x + b.w / 2 >= a.x + a.w / 2;
  const down = b.y + b.h / 2 >= a.y + a.h / 2;
  const points: Line['points'] = stacked
    ? (down ? [{ x: a.x + a.w / 2, y: a.y + a.h }, { x: b.x + b.w / 2, y: b.y }] : [{ x: a.x + a.w / 2, y: a.y }, { x: b.x + b.w / 2, y: b.y + b.h }])
    : (right ? [{ x: a.x + a.w, y: a.y + a.h / 2 }, { x: b.x, y: b.y + b.h / 2 }] : [{ x: a.x, y: a.y + a.h / 2 }, { x: b.x + b.w, y: b.y + b.h / 2 }]);
  return {
    id: `${link.source}|${link.relation}|${link.target}`,
    source: link.source,
    target: link.target,
    style: 'link',
    link: true,
    points,
    scale: Math.max(1, 1 / zoom),
    label: link.label,
    ...(labelNear ? { labelNear } : {}),
    ...(stacked ? { upright: true } : {}),
  };
}
