import type { ErdBox, ErdFocus, ErdMap, Rect } from './erd';

// The ERD stage's walk (LA-V61-R49): each plain arrow moves the focus to the nearest box in that
// direction on the map, as the picture shows it, never by the record tree. Pure geometry over the
// map's one layout (layout.ts), so a unit test proves it on a small fixed layout.
//
// - A box walks among boxes of its own grain: an entity among entities, an aggregate's boundary
//   among aggregates, a region among regions, each also reaching a closed box above its grain (an
//   empty aggregate or domain), since that box holds nothing finer to land on.
// - It looks in widening rings: first inside its own parent (an entity stays inside its aggregate's
//   area), then inside its parent's parent (its domain's region), then the whole map, so at a
//   region's edge it continues into the neighboring region.
// - In each ring a box lies in the arrow's direction when its center does; those that overlap the
//   current box's row (Left and Right) or column (Up and Down) come first, then the shortest
//   distance between centers. Faded boxes count: a step into a faded area brings it into focus.

export type Direction = 'left' | 'right' | 'up' | 'down';

/** The direction each plain arrow walks the map. */
export const ARROW_DIRECTION: Readonly<Record<string, Direction>> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

const center = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const DEPTH: Record<ErdBox['kind'], number> = { domain: 0, aggregate: 1, entity: 2 };

/** Whether `to` lies in the direction from `from`, and whether it overlaps `from`'s row or column on the way. */
function lies(from: Rect, to: Rect, direction: Direction): { ahead: boolean; inLine: boolean } {
  const a = center(from);
  const b = center(to);
  const across = direction === 'left' || direction === 'right';
  const ahead = { left: b.x < a.x, right: b.x > a.x, up: b.y < a.y, down: b.y > a.y }[direction];
  const inLine = across ? to.y < from.y + from.height && to.y + to.height > from.y : to.x < from.x + from.width && to.x + to.width > from.x;
  return { ahead, inLine };
}

/** The nearest of `candidates` in the direction from `from`: in line first, then by the distance between centers; ties keep map order. */
export function nearestBox(from: Rect, candidates: readonly { id: string; rect: Rect }[], direction: Direction): string | null {
  const a = center(from);
  let best: { id: string; inLine: boolean; distance: number } | null = null;
  for (const c of candidates) {
    const { ahead, inLine } = lies(from, c.rect, direction);
    if (!ahead) continue;
    const b = center(c.rect);
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    if (!best || (inLine && !best.inLine) || (inLine === best.inLine && distance < best.distance)) best = { id: c.id, inLine, distance };
  }
  return best?.id ?? null;
}

/**
 * Where an arrow goes on the map from a focus: from its picked-out box, else its scope's box (a
 * domain's region). From the product, which picks out no box, the arrow enters the map at the
 * region nearest the corner it comes from (`enter`). Null when nothing lies that way.
 */
export function erdStep(map: ErdMap, rects: ReadonlyMap<string, Rect>, at: ErdFocus, direction: Direction): string | null {
  const byId = new Map(map.boxes.map((b) => [b.id, b]));
  const placed = (b: ErdBox) => (rects.has(b.id) ? [{ id: b.id, rect: rects.get(b.id)! }] : []);
  const start = at.pick ?? (byId.has(at.scope) ? at.scope : null);
  const box = start ? byId.get(start) : undefined;
  const from = box ? rects.get(box.id) : undefined;
  if (!box || !from) return enter(map, rects, direction);
  const holders = new Set(map.boxes.flatMap((b) => (b.parent ? [b.parent] : [])));
  const depth = DEPTH[box.kind];
  // Its grain: boxes as deep as it, and the closed boxes above it.
  const grain = map.boxes.filter((b) => b.id !== box.id && (DEPTH[b.kind] === depth || (DEPTH[b.kind] < depth && !holders.has(b.id))));
  const within = (b: ErdBox, ring: string | undefined) => {
    if (ring === undefined) return true;
    for (let up = b.parent; up; up = byId.get(up)?.parent) if (up === ring) return true;
    return false;
  };
  const rings: (string | undefined)[] = [];
  for (let up = box.parent; up; up = byId.get(up)?.parent) rings.push(up);
  rings.push(undefined);
  for (const ring of rings) {
    const to = nearestBox(from, grain.filter((b) => within(b, ring)).flatMap(placed), direction);
    if (to) return to;
  }
  return null;
}

/** The region an arrow enters the map at from outside it: the one nearest the corner it comes from, the top left for Right and Down, the bottom right for Left and Up. */
function enter(map: ErdMap, rects: ReadonlyMap<string, Rect>, direction: Direction): string | null {
  const regions = map.boxes.flatMap((b) => (b.kind === 'domain' && rects.has(b.id) ? [{ id: b.id, at: center(rects.get(b.id)!) }] : []));
  if (regions.length === 0) return null;
  const forward = direction === 'right' || direction === 'down';
  const corner = forward
    ? { x: Math.min(...regions.map((r) => rects.get(r.id)!.x)), y: Math.min(...regions.map((r) => rects.get(r.id)!.y)) }
    : { x: Math.max(...regions.map((r) => rects.get(r.id)!.x + rects.get(r.id)!.width)), y: Math.max(...regions.map((r) => rects.get(r.id)!.y + rects.get(r.id)!.height)) };
  const distance = (p: { x: number; y: number }) => Math.hypot(p.x - corner.x, p.y - corner.y);
  return regions.reduce((best, r) => (distance(r.at) < distance(best.at) ? r : best)).id;
}
