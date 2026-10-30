// Where some siblings go when new data arrives on a map laid out bottom-up (LA-PAT-APP-UX-R22): the ERD's regions and
// top level (erd/layout.ts) and every container of the Graph's Map (ground.ts). Pure: each sibling at its new size is
// put where it was, as far as it can be: a box that grew keeps its place and pushes the boxes it now overlaps, a gap
// included, right when it lay to their left and down otherwise, and they push theirs; every other box keeps its exact
// place; a removed one leaves its room. A new box goes in free room first where asked (`fill`, the Map's), the first
// place in reading order where it fits inside the room the siblings had, clear of every box by the gap; else beside
// them all, below when they stand wider than `aspect`, else to the right (or always to the right, `beside: 'right'`).

/** One sibling placed, from its parent's inside's corner. */
export interface KeptBox { id: string; x: number; y: number; width: number; height: number }
/** One sibling's place before. */
export interface Was { x: number; y: number; width: number; height: number }

export interface KeepOptions {
  /** The gap a pushed or new box keeps from the others. */
  gap: number;
  /** The shape the siblings keep as they grow, their width over their height. */
  aspect: number;
  /** The room the siblings had before (its width and height): kept, so a removed box leaves its room, and searched for free room when `fill`. */
  room?: { width: number; height: number };
  /** Whether a new box goes in free room first. */
  fill?: boolean;
  /** Where a new box goes when there is no free room: beside them by the shape, or always to the right (a row's). */
  beside?: 'shape' | 'right';
}

const overlaps = (a: Was, b: Was, gap: number) =>
  a.x < b.x + b.width + gap && b.x < a.x + a.width + gap && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;

/**
 * Some siblings at their new sizes, placed where they were (`before`, each one's place inside its parent, or undefined
 * for a new one) as far as they can be: each one's place and the whole they take (at least the room before). Null when
 * none of them was there before (the level is laid out afresh).
 */
export function keepPlaces(
  boxes: readonly { id: string; width: number; height: number }[],
  before: (id: string) => Was | undefined,
  options: KeepOptions,
): { id: 'kept'; children: KeptBox[]; width: number; height: number } | null {
  const { gap, aspect, room, fill = false, beside = 'shape' } = options;
  const was = new Map(boxes.flatMap((b) => { const r = before(b.id); return r ? [[b.id, r] as const] : []; }));
  if (was.size === 0) return null;
  const byPlace = (a: { id: string }, b: { id: string }) => was.get(a.id)!.y - was.get(b.id)!.y || was.get(a.id)!.x - was.get(b.id)!.x;
  const grew = (b: { id: string; width: number; height: number }) => { const r = was.get(b.id)!; return r.width !== b.width || r.height !== b.height; };
  const kept = boxes.filter((b) => was.has(b.id));
  // The boxes that changed size first, so they keep their places and push the others.
  const order = [...kept.filter(grew).sort(byPlace), ...kept.filter((b) => !grew(b)).sort(byPlace)];
  const placed: KeptBox[] = [];
  /** Whether a box at `at` clashes with a placed one: overlaps it, or comes within the gap of it where it was not before. */
  const clash = (p: KeptBox, at: KeptBox) => {
    if (overlaps(p, at, 0)) return true;
    if (!overlaps(p, at, gap)) return false;
    const [a, b] = [was.get(p.id), was.get(at.id)];
    return !(a && b && overlaps(a, b, gap));
  };
  const settle = (at: KeptBox) => {
    for (let hit = placed.find((p) => clash(p, at)); hit; hit = placed.find((p) => clash(p, at))) {
      const [a, b] = [was.get(hit.id), was.get(at.id)];
      if (a && b && a.x + a.width <= b.x) at.x = hit.x + hit.width + gap;
      else at.y = hit.y + hit.height + gap;
    }
    placed.push(at);
  };
  for (const b of order) { const r = was.get(b.id)!; settle({ id: b.id, x: r.x, y: r.y, width: b.width, height: b.height }); }
  const right = () => Math.max(room?.width ?? 0, ...placed.map((p) => p.x + p.width));
  const bottom = () => Math.max(room?.height ?? 0, ...placed.map((p) => p.y + p.height));
  /** The first place in reading order inside the room where a box fits, clear of every placed box by the gap; null when none. */
  const freeRoom = (b: { id: string; width: number; height: number }): KeptBox | null => {
    const [w, h] = [right(), bottom()];
    const xs = [...new Set([0, ...placed.map((p) => p.x), ...placed.map((p) => p.x + p.width + gap)])].sort((p, q) => p - q);
    const ys = [...new Set([0, ...placed.map((p) => p.y), ...placed.map((p) => p.y + p.height + gap)])].sort((p, q) => p - q);
    for (const y of ys) {
      if (y + b.height > h) break;
      for (const x of xs) {
        if (x + b.width > w) break;
        const at = { id: b.id, x, y, width: b.width, height: b.height };
        if (!placed.some((p) => overlaps(p, at, gap - 1e-9))) return at;
      }
    }
    return null;
  };
  for (const b of boxes.filter((b) => !was.has(b.id))) {
    const free = fill ? freeRoom(b) : null;
    if (free) { placed.push(free); continue; }
    const [r, d] = [Math.max(0, ...placed.map((p) => p.x + p.width)), Math.max(0, ...placed.map((p) => p.y + p.height))];
    const below = beside === 'shape' && r / Math.max(1, d) > aspect;
    settle(below ? { id: b.id, x: 0, y: d + gap, width: b.width, height: b.height } : { id: b.id, x: r + gap, y: 0, width: b.width, height: b.height });
  }
  const at = new Map(placed.map((p) => [p.id, p]));
  return { id: 'kept', children: boxes.map((b) => at.get(b.id)!), width: right(), height: bottom() };
}
