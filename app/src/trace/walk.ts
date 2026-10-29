import type { SpecIndex } from '../specs/data';
import { graphMove, stepName } from '../graph/steps';
import { levelMove, type Move, type StageLevels } from '../views/levels';
import type { TraceMap, TraceNode } from './tree';

// The Trace stage's walk (LA-V61-R49, LA-V98-R03): the stage walk's levels (views/levels.ts) over the product's tree as
// drawn, by the Graph's Tree keys (graph/steps.ts graphMove): Left and Out to the parent, Right and In to the first
// child, Up and Down across the siblings, going on past the last to the next parent's first child at that level. Every
// node is a node of the walk, each copy of a record in its own place, so the walk keeps the chain it arrived in. Pure and
// tested directly; TraceView.tsx moves the focus.

const levelsCache = new WeakMap<TraceMap, StageLevels>();

/** The map's tree as the walk's levels, by node key. */
export function traceLevels(map: TraceMap): StageLevels {
  const known = levelsCache.get(map);
  if (known) return known;
  const node = (key: string) => map.map.nodes.get(key);
  const levels: StageLevels = {
    root: map.product,
    parent: (key) => node(key)?.parent ?? null,
    children: (key) => node(key)?.children ?? [],
    across: (key, direction) => {
      const up = node(key)?.parent;
      if (!up) return null;
      const siblings = node(up)!.children;
      return siblings[siblings.indexOf(key) + (direction === 'right' || direction === 'down' ? 1 : -1)] ?? null;
    },
  };
  levelsCache.set(map, levels);
  return levels;
}

/** Where a move goes from a node, by the Tree's keys, or null. */
export const traceTarget = (map: TraceMap, at: string, move: Move): string | null => levelMove(traceLevels(map), at, graphMove('tree', move));

/** What the walk says on a node: a record as the graph names it, "Not built, a gap of Lend a thing", "File src/lend.ts". */
export function nodeWords(index: SpecIndex, node: TraceNode): string {
  switch (node.role) {
    case 'gap': { const obligation = node.chain!; return `${node.words!.title}, a gap of ${index.byId.get(obligation)?.title ?? obligation}`; }
    case 'file': return `File ${node.words!.title}`;
    case 'link': return `Link to ${stepName(index, node.opens!)}: Enter focuses it`;
    case 'untraced': return `Untraced, ${node.words!.meta}`;
    case 'record': return stepName(index, node.id);
  }
}
