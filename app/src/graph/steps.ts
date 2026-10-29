// The Graph stage's walk (LA-V93-R19, LA-V61-R49): the stage walk's moves (views/levels.ts) over the graph's tree, from
// anywhere on the page. The commands layer's one handler (useStageWalk, app/src/shell/commands.tsx) sends each move to
// the stage shown. Out and In (Shift+Up and Shift+Down) go to the parent and the first child in every view; the arrows
// keep each view's keys: in the Tree view Left out, Right in, Up and Down across the siblings; in the Nested and Voronoi
// views, which draw children inside their parent, Up out, Down in, Left and Right across. Across goes on, past the last
// sibling, to the next parent's first child at that level (levels.ts). The ERD stage walks its map through `useWalk`
// (erd/walk.ts), the Trace stage its lanes (trace/walk.ts).
import { useCallback } from 'react';
import { kindLabel, type SpecIndex } from '../specs/data';
import { useStageWalk } from '../shell/commands';
import { levelMove, type Move, type StageLevels } from '../views/levels';
import { groupKindLabel, groupName, groupOwner, isGraphNode, isGroup, nodeChildren, nodeParent } from './model';
import { mapRootOf } from './map';
import type { GraphLayout } from './GraphPage';

/** Whether a view draws children inside their parent (Nested and Voronoi), and so steps out and in by Up and Down. */
const nestsChildren = (layout: GraphLayout) => layout !== 'tree';

/** The level move an arrow takes in a view: Tree Left out and Right in, Nested and Voronoi Up out and Down in; the other arrows across. */
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

const levelsCache = new WeakMap<SpecIndex, Map<string, StageLevels>>();
/** The graph's tree under one product as levels: the product, its stages and domains, and down to every record, in the nav's order. */
export function graphLevels(index: SpecIndex, root: string): StageLevels {
  let byRoot = levelsCache.get(index);
  if (!byRoot) { byRoot = new Map(); levelsCache.set(index, byRoot); }
  const known = byRoot.get(root);
  if (known) return known;
  const children = (id: string) => nodeChildren(index, id).filter((c) => isGraphNode(index, c));
  const levels: StageLevels = {
    root,
    parent: (id) => (id === root ? null : nodeParent(index, id)),
    children,
    across: (id, direction) => {
      const up = nodeParent(index, id);
      if (up === null) return null;
      const siblings = children(up);
      const at = siblings.indexOf(id);
      if (at < 0) return null;
      return siblings[at + (direction === 'right' || direction === 'down' ? 1 : -1)] ?? null;
    },
  };
  byRoot.set(root, levels);
  return levels;
}

/** Where a move goes from a node in a view: by the view's keys, over its product's tree. */
export function graphTarget(index: SpecIndex, focus: string, layout: GraphLayout, move: Move): string | null {
  if (!isGraphNode(index, focus)) return null;
  const to = levelMove(graphLevels(index, mapRootOf(index, focus)), focus, graphMove(layout, move));
  return to && isGraphNode(index, to) ? to : null;
}

/** What a step says to a screen reader: the new focus as the graph's box names it, "Use case Borrow a tool", "Use cases in LA-D". */
export function stepName(index: SpecIndex, id: string): string {
  if (isGroup(index, id)) return `${groupKindLabel(index, id)} ${groupName(index, id)} in ${groupOwner(index, id)}`;
  const record = index.byId.get(id);
  return record ? `${kindLabel(index, record.kind)} ${record.title}` : id;
}

/**
 * Registers the Graph's walk: a move from anywhere but a control that uses arrows itself goes by the view's keys and
 * moves the focus there, as a click does. `follow` says, before the move, whether keyboard focus follows to the new
 * focus's box (and so is read out there); otherwise the walk is announced.
 */
export function useGraphWalk(index: SpecIndex, focus: string, layout: GraphLayout, onNavigate: (id: string) => void, follow?: (to: string) => boolean) {
  const target = useCallback((move: Move) => graphTarget(index, focus, layout, move), [index, focus, layout]);
  useWalk(index, focus, target, onNavigate, follow);
}

/**
 * Registers a stage's walk by its own target: `target` says where a move goes from the focus, or null. The walk moves
 * the focus there, as a click does, and announces it unless `follow` takes keyboard focus there.
 */
export function useWalk(index: SpecIndex, focus: string, target: (move: Move) => string | null, onNavigate: (id: string) => void, follow?: (to: string) => boolean) {
  const walk = useCallback((move: Move) => {
    const to = target(move);
    if (!to) return null;
    const followed = follow?.(to) ?? false;
    onNavigate(to);
    return followed ? null : stepName(index, to);
  }, [index, target, onNavigate, follow]);
  useStageWalk(walk, isGraphNode(index, focus));
}
