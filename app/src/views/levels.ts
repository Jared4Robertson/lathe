// Every stage's walk as levels (LA-V61-R49, LA-PAT-APP-UX-R21): each stage is a hierarchy, the Graph its tree, the ERD
// product › domain region › aggregate area › entity. One walk moves over any of them:
// - Out goes to the container, In to the first node inside it (Shift+Up and Shift+Down, Shift+W and Shift+S, or vim's Shift+K and Shift+J);
// - an arrow moves among siblings, the same level in the same container, by the stage's own `across` (spatially on the
//   ERD, by the layout's keys on the Graph), and at the container's edge continues to the next container's
//   first node at that level in reading order (Right and Down), or the previous container's last (Left and Up), so
//   repeated presses visit every node at a level;
// - from the root, an arrow goes in: Right and Down to its first node, Left and Up to its last.
// Pure and tested directly; each stage builds its levels (graph/steps.ts, erd/walk.ts; the Trace walks its rows and
// their links instead, trace/walk.ts) and the commands layer's one handler sends each move to the stage shown (shell/commands.tsx useStageWalk).

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
  /** Where an arrow goes from a node inside its container, or null at the container's edge. */
  across: (id: string, direction: Direction) => string | null;
}

/** The first node `depth` levels under `node` in reading order (the last, going back), or null when it reaches none. */
function edgeAt(levels: StageLevels, node: string, depth: number, ahead: boolean): string | null {
  if (depth === 0) return node;
  const inside = levels.children(node);
  for (let i = ahead ? 0 : inside.length - 1; i >= 0 && i < inside.length; i += ahead ? 1 : -1) {
    const found = edgeAt(levels, inside[i], depth - 1, ahead);
    if (found !== null) return found;
  }
  return null;
}

/**
 * The node after `node` at its level in reading order (before it, going back), or null at the level's end. Found from the
 * node up, through the nearest ancestor with a sibling that way and down again, so a step looks only at the hierarchy
 * around the node: a new map (a reload of a large product) is never indexed whole to draw the walk's buttons.
 */
function nextAtLevel(levels: StageLevels, node: string, ahead: boolean): string | null {
  let at = node;
  for (let depth = 0; ; depth++) {
    const container = levels.parent(at);
    if (container === null) return null;
    const siblings = levels.children(container);
    for (let i = siblings.indexOf(at) + (ahead ? 1 : -1); i >= 0 && i < siblings.length; i += ahead ? 1 : -1) {
      const found = edgeAt(levels, siblings[i], depth, ahead);
      if (found !== null) return found;
    }
    at = container;
  }
}

/** The next container after `container` at its level in reading order (or before it, going back) that holds anything: its first node (or last). */
function continueFrom(levels: StageLevels, container: string, ahead: boolean): string | null {
  for (let next = nextAtLevel(levels, container, ahead); next !== null; next = nextAtLevel(levels, next, ahead)) {
    const inside = levels.children(next);
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
