// Every stage's walk as levels (LA-V61-R49, LA-PAT-APP-UX-R21): each stage is a hierarchy, the Graph its tree, the ERD
// product › domain region › aggregate area › entity, the Trace product › domain band › lane › box (a "+N more" box
// holding what it hides). One walk moves over any of them:
// - Out goes to the container, In to the first node inside it (Shift+Up and Shift+Down, or Shift+W and Shift+S);
// - an arrow moves among siblings, the same level in the same container, by the stage's own `across` (spatially on the
//   ERD and the Trace, by the layout's keys on the Graph), and at the container's edge continues to the next container's
//   first node at that level in reading order (Right and Down), or the previous container's last (Left and Up), so
//   repeated presses visit every node at a level;
// - from the root, an arrow goes in: Right and Down to its first node, Left and Up to its last.
// Pure and tested directly; each stage builds its levels (graph/steps.ts, erd/walk.ts, trace/walk.ts) and the commands
// layer's one handler sends each move to the stage shown (shell/commands.tsx useStageWalk).

export type Direction = 'left' | 'right' | 'up' | 'down';
/** A move of the walk: an arrow, or out to the container and in to the first node inside it. */
export type Move = Direction | 'out' | 'in';
/** The moves in the toolbar's order, which is the same on every stage: the arrows, then Out and In. */
export const MOVES: readonly Move[] = ['left', 'right', 'up', 'down', 'out', 'in'];
/** Whether an arrow goes forward in reading order (Right and Down) or back (Left and Up). */
export const forward = (direction: Direction) => direction === 'right' || direction === 'down';

/** A stage's hierarchy, by node IDs. */
export interface StageLevels {
  root: string;
  /** The container a node sits in; null for the root. */
  parent: (id: string) => string | null;
  /** The nodes inside a container, in reading order (left to right, top to bottom). */
  children: (id: string) => readonly string[];
  /** Where an arrow goes from a node inside its container (or the stage's own neighbor, as the Trace's why tree), or null at the container's edge. */
  across: (id: string, direction: Direction) => string | null;
}

/** Each level's nodes in reading order, container by container, and each node's place in its level. */
interface LevelIndex { levels: string[][]; at: Map<string, { level: number; i: number }> }
const indexes = new WeakMap<StageLevels, LevelIndex>();

function levelIndex(levels: StageLevels): LevelIndex {
  const known = indexes.get(levels);
  if (known) return known;
  const index: LevelIndex = { levels: [], at: new Map() };
  let row = [levels.root];
  index.at.set(levels.root, { level: 0, i: 0 });
  while (row.length > 0) {
    index.levels.push(row);
    const next: string[] = [];
    for (const id of row) {
      for (const c of levels.children(id)) {
        if (index.at.has(c)) continue;
        index.at.set(c, { level: index.levels.length, i: next.length });
        next.push(c);
      }
    }
    row = next;
  }
  indexes.set(levels, index);
  return index;
}

/** The next container after `container` at its level in reading order (or before it, going back) that holds anything: its first node (or last). */
function continueFrom(levels: StageLevels, container: string, ahead: boolean): string | null {
  const place = levelIndex(levels).at.get(container);
  if (!place) return null;
  const row = levelIndex(levels).levels[place.level];
  for (let i = place.i + (ahead ? 1 : -1); i >= 0 && i < row.length; i += ahead ? 1 : -1) {
    const inside = levels.children(row[i]);
    if (inside.length > 0) return ahead ? inside[0] : inside[inside.length - 1];
  }
  return null;
}

/** Where a move goes from a node, or null where there is nowhere to go. */
export function levelMove(levels: StageLevels, at: string, move: Move): string | null {
  if (move === 'out') return levels.parent(at);
  if (move === 'in') return levels.children(at)[0] ?? null;
  const ahead = forward(move);
  const container = levels.parent(at);
  if (container === null) {
    const inside = levels.children(at);
    return (ahead ? inside[0] : inside[inside.length - 1]) ?? null;
  }
  return levels.across(at, move) ?? continueFrom(levels, container, ahead);
}

/** Every node a walk reaches from `start` by any run of moves: the guarantee each stage is tested on. */
export function reachable(levels: StageLevels, start = levels.root): Set<string> {
  const seen = new Set([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const move of MOVES) {
      const to = levelMove(levels, queue[i], move);
      if (to !== null && !seen.has(to)) { seen.add(to); queue.push(to); }
    }
  }
  return seen;
}

/** A rectangle in map units. */
export interface Rect { x: number; y: number; width: number; height: number }

const center = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** The nearest of `candidates` in a direction from `from`: those overlapping its row (Left and Right) or column (Up and Down) first, then by the distance between centers; ties keep their order. */
export function nearestBox(from: Rect, candidates: readonly { id: string; rect: Rect }[], direction: Direction): string | null {
  const a = center(from);
  const across = direction === 'left' || direction === 'right';
  let best: { id: string; inLine: boolean; distance: number } | null = null;
  for (const c of candidates) {
    const b = center(c.rect);
    const ahead = { left: b.x < a.x, right: b.x > a.x, up: b.y < a.y, down: b.y > a.y }[direction];
    if (!ahead) continue;
    const to = c.rect;
    const inLine = across ? to.y < from.y + from.height && to.y + to.height > from.y : to.x < from.x + from.width && to.x + to.width > from.x;
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    if (!best || (inLine && !best.inLine) || (inLine === best.inLine && distance < best.distance)) best = { id: c.id, inLine, distance };
  }
  return best?.id ?? null;
}

/** Boxes in reading order: in rows top to bottom (a box starts a new row below the middle of the row's first), each row left to right. */
export function readingOrder<T extends { rect: Rect }>(boxes: readonly T[]): T[] {
  const byTop = [...boxes].sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  const rows: T[][] = [];
  for (const b of byTop) {
    const row = rows[rows.length - 1];
    if (row && b.rect.y < row[0].rect.y + row[0].rect.height / 2) row.push(b);
    else rows.push([b]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.rect.x - b.rect.x));
}
