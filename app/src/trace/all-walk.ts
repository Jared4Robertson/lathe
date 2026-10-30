import { stepName } from '../graph/steps';
import type { RecordIndex } from '../exploring/record-summaries/record-index';
import type { Move } from '../views/levels';
import { GAP_WORDS, type AllGraph } from './all';
import type { AllLaid } from './all-laid';

// The All-at-once view's walk (LA-V61-R49, LA-V98): Up and Down within a column, top to bottom as drawn; Left and Right
// (and Out and In) along the links to the nearest linked box in the next column that way. From no box (the product, or a
// record the view does not draw) any move goes to the first outcome, or the first box drawn. Pure and tested directly;
// TraceView.tsx moves the focus.

/** What each step button does, for its name and tooltip. */
export const ALL_WALK_LABELS: Record<Move, string> = {
  left: 'Step along a link to the nearest box on the left',
  right: 'Step along a link to the nearest box on the right',
  up: 'Step to the box above in its column',
  down: 'Step to the box below in its column',
  out: 'Out along a link to the nearest box on the left',
  in: 'In along a link to the nearest box on the right',
};

/** Each column's keys top to bottom: the layout's when there is one, else the graph's own order. */
const columnsOf = (graph: AllGraph, laid: AllLaid | null) => laid?.order ?? graph.columns;

/** Where a move goes from a box (null for none), or null. */
export function allTarget(graph: AllGraph, laid: AllLaid | null, at: string | null, move: Move): string | null {
  const columns = columnsOf(graph, laid);
  if (at === null || !graph.nodes.has(at)) return columns.find((c) => c.length > 0)?.[0] ?? null;
  const node = graph.nodes.get(at)!;
  if (move === 'up' || move === 'down') {
    const column = columns[node.column];
    const i = column.indexOf(at);
    return column[i + (move === 'down' ? 1 : -1)] ?? null;
  }
  const rightward = move === 'right' || move === 'in';
  const linked = (rightward ? graph.out.get(at) : graph.into.get(at)) ?? [];
  const ends = linked.map((l) => (rightward ? graph.links[l].to : graph.links[l].from));
  if (ends.length === 0) return null;
  // The nearest: in the nearest column that way, then by height (or by place in the column, with no layout).
  const nearest = Math.min(...ends.map((k) => Math.abs(graph.nodes.get(k)!.column - node.column)));
  const own = laid?.places.get(at)?.y ?? columns[node.column].indexOf(at);
  const heightOf = (k: string) => laid?.places.get(k)?.y ?? columns[graph.nodes.get(k)!.column].indexOf(k);
  return ends
    .filter((k) => Math.abs(graph.nodes.get(k)!.column - node.column) === nearest)
    .sort((a, b) => Math.abs(heightOf(a) - own) - Math.abs(heightOf(b) - own) || heightOf(a) - heightOf(b))[0];
}

/** What the walk says on a box: a record as the graph names it, a gap as "Not built, a gap of Lend a thing". */
export function allWords(index: RecordIndex, graph: AllGraph, key: string): string {
  const gap = graph.nodes.get(key)?.gap;
  if (gap) return `${GAP_WORDS[gap.missing]}, a gap of ${index.byId.get(gap.obligation)?.title ?? gap.obligation}`;
  return stepName(index, key);
}
