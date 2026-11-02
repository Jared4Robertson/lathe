// The Graph stage's walk (LA-V93-R19, LA-V61-R49): the stage walk's moves (views/levels.ts) over the graph's tree, from
// anywhere on the page. The commands layer's one handler (useStageWalk, app/src/shell/commands.tsx) sends each move to
// the stage shown. Out and In (Shift+Up and Shift+Down) go to the parent and the first child in every view; the arrows
// keep each view's keys: in the Tree view Left out, Right in, Up and Down across the siblings; in the Nested
// view, which draws children inside their parent, Up out, Down in, Left and Right across. Across goes on, past the last
// sibling, to the next parent's first child at that level (levels.ts). The ERD stage walks its map through `useWalk`
// (erd/walk.ts), the Trace stage its rows (trace/walk.ts).
import { useCallback, useEffect, useRef } from 'react';
import { kindLabel, type RecordIndex } from '../exploring/record-summaries/record-index';
import { useStageWalk } from '../shell/commands';
import { forward, levelMove, type Direction, type Move, type StageLevels } from '../views/levels';
import type { WalkBar } from '../views/StageChrome';
import { groupKindLabel, groupName, groupOwner, isGraphNode, isGroup, nodeChildren, nodeParent } from './model';
import { mapRootOf } from './map';
import { groundChildren, groundParent, groundTree } from './ground';
import type { GraphLayout } from './GraphPage';

/** Whether a view draws children inside their parent (Nested), and so steps out and in by Up and Down. */
const nestsChildren = (layout: GraphLayout) => layout !== 'tree';

/** The level move an arrow takes in a view: Tree Left out and Right in, Nested Up out and Down in; the other arrows across. */
export function graphMove(layout: GraphLayout, move: Move): Move {
  if (nestsChildren(layout)) return move === 'up' ? 'out' : move === 'down' ? 'in' : move;
  return move === 'left' ? 'out' : move === 'right' ? 'in' : move;
}

/** What each step button does in a view, for its name and tooltip. */
export function graphWalkLabels(layout: GraphLayout): Record<Move, string> {
  const says = (move: Move) => {
    const to = graphMove(layout, move);
    if (to === 'out') return 'Step out to the parent';
    if (to === 'in') return 'Step in to the first child';
    return to === 'left' || to === 'up' ? 'Step to the previous sibling' : 'Step to the next sibling';
  };
  return { left: says('left'), right: says('right'), up: says('up'), down: says('down'), out: 'Out to the parent', in: 'In to the first child' };
}

/** On a phone, the walk's bar (LA-V93-R76): Previous and Next are the view's two arrows that step across; the other two step out and in, as Out and In do. */
export function graphWalkBar(layout: GraphLayout): WalkBar {
  const across = (['left', 'right', 'up', 'down'] as const).filter((d) => graphMove(layout, d) === d);
  return { previous: across.find((d: Direction) => !forward(d))!, next: across.find(forward)!, more: [] };
}

const levelsCache = new WeakMap<RecordIndex, Map<string, StageLevels>>();
/**
 * The graph's tree under one product as levels: the product, its stages and domains, and down to every record, in the
 * nav's order; in the Map, the Map's own tree (ground.ts): its districts, neighborhoods, areas and records, each record
 * holding only its composition.
 */
export function graphLevels(index: RecordIndex, root: string, layout: GraphLayout = 'tree'): StageLevels {
  let byRoot = levelsCache.get(index);
  if (!byRoot) { byRoot = new Map(); levelsCache.set(index, byRoot); }
  const map = layout === 'map';
  const key = `${map ? 'map' : 'tree'}|${root}`;
  const known = byRoot.get(key);
  if (known) return known;
  const parentOf = (id: string) => (map ? groundParent(index, id) : nodeParent(index, id));
  const children = (id: string) => (map ? groundChildren(index, id) : nodeChildren(index, id)).filter((c) => isGraphNode(index, c));
  const levels: StageLevels = {
    root,
    parent: (id) => (id === root ? null : parentOf(id)),
    children,
    across: (id, direction) => {
      const up = parentOf(id);
      if (up === null) return null;
      const siblings = children(up);
      const at = siblings.indexOf(id);
      if (at < 0) return null;
      return siblings[at + (direction === 'right' || direction === 'down' ? 1 : -1)] ?? null;
    },
  };
  byRoot.set(key, levels);
  return levels;
}

/** Where a move goes from a node in a view: by the view's keys, over its product's tree. */
export function graphTarget(index: RecordIndex, focus: string, layout: GraphLayout, move: Move): string | null {
  if (!isGraphNode(index, focus)) return null;
  const root = layout === 'map' ? groundTree(index).root : mapRootOf(index, focus);
  if (root === null || (layout === 'map' && focus !== root && groundParent(index, focus) === null)) return null;
  const to = levelMove(graphLevels(index, root, layout), focus, graphMove(layout, move));
  return to && isGraphNode(index, to) ? to : null;
}

/** What a step says to a screen reader: the new focus as the graph's box names it, "Use case Borrow a tool", "Use cases in LA-D". */
export function stepName(index: RecordIndex, id: string): string {
  if (isGroup(index, id)) return `${groupKindLabel(index, id)} ${groupName(index, id)} in ${groupOwner(index, id)}`;
  const record = index.byId.get(id);
  return record ? `${kindLabel(index, record.kind)} ${record.title}` : id;
}

/**
 * Registers the Graph's walk: a move from anywhere but a control that uses arrows itself goes by the view's keys and
 * moves the focus there, as a click does. `follow` says, before the move, whether keyboard focus follows to the new
 * focus's box (and so is read out there); otherwise the walk is announced.
 */
export function useGraphWalk(index: RecordIndex, focus: string, layout: GraphLayout, onNavigate: (id: string) => void, follow?: (to: string) => boolean) {
  const target = useCallback((move: Move) => graphTarget(index, focus, layout, move), [index, focus, layout]);
  useWalk(index, focus, target, onNavigate, follow);
}

/** How long a move waits for the focus the move before it went to. */
const WALK_WAIT_MS = 1000;

/**
 * Registers a stage's walk by its own target: `target` says where a move goes from the focus, or null. The walk moves
 * the focus there, as a click does, and announces it unless `follow` takes keyboard focus there. A move pressed before
 * the stage has drawn the focus the last one went to waits for it, so it goes from there and never from the focus before.
 */
export function useWalk(index: RecordIndex, focus: string, target: (move: Move) => string | null, onNavigate: (id: string) => void, follow?: (to: string) => boolean) {
  const going = useRef<{ to: string; at: number } | null>(null);
  const waiting = useRef<Move[]>([]);
  const walk = useCallback((move: Move) => {
    // A move that never lands (the address went elsewhere) holds the next one no longer than a moment.
    if (going.current && going.current.to !== focus && performance.now() - going.current.at < WALK_WAIT_MS) {
      waiting.current.push(move);
      return null;
    }
    const to = target(move);
    going.current = to ? { to, at: performance.now() } : null;
    if (!to) return null;
    const followed = follow?.(to) ?? false;
    onNavigate(to);
    return followed ? null : stepName(index, to);
  }, [index, focus, target, onNavigate, follow]);
  // A new focus is drawn: the moves pressed meanwhile go from it, in order.
  useEffect(() => {
    if (!going.current) return;
    going.current = null;
    const next = waiting.current.shift();
    if (next) walk(next);
  }, [focus, walk]);
  useStageWalk(walk, isGraphNode(index, focus));
}
