import { describe, expect, it } from 'vitest';
import type { PlacedMap } from '../../src/graph/map';
import { textMeasure, type MapLabel } from '../../src/graph/text';
import { traceInput, traceMap } from '../../src/trace/tree';
import { addRows, removeRows, setRow } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';
import { recordIndexOf, type ServedData } from '../read-view';
import { traced } from '../trace/traces';
import { graphMap, layoutNested, layoutTree, nestedMap } from './maps';

// A change moves only what it changed (LA-PAT-APP-UX-R22, LA-EXP-DS05, LA-EXP-DS07): adding, removing, renaming or
// moving a record under a parent rearranges only that parent's region (for a move, the old and the new parent's), and
// every other box keeps its exact place, size and text; siblings keep their order. Each layout is laid out before and
// after each change, on the same rule the layout's worker runs.

type Tree = Record<string, string[]>;

/** A product with three domains, each with a few records, some of them with children of their own. */
const BEFORE: Tree = {
  p: ['d1', 'd2', 'd3'],
  d1: ['a1', 'a2', 'a3'],
  d2: ['b1', 'b2'],
  d3: ['c1', 'c2', 'c3', 'c4'],
  a1: ['a1.1', 'a1.2'],
  a2: ['a2.1', 'a2.2', 'a2.3'],
  b1: ['b1.1', 'b1.2'],
  b2: ['b2.1', 'b2.2'],
  c2: ['c2.1', 'c2.2'],
};
const TITLES: Record<string, string> = { a2: 'Aggregate with a longer title that wraps' };
const labelOf = (titles: Record<string, string>) => (id: string): MapLabel => ({ title: titles[id] ?? `Record ${id}`, meta: `Aggregate · ${id}` });

const layOut = { tree: layoutTree, nested: layoutNested } as const;
type View = keyof typeof layOut;
const mapOf = (view: View, tree: Tree, titles: Record<string, string> = TITLES): PlacedMap =>
  layOut[view](['p'], (id) => tree[id] ?? [], labelOf(titles));

/** Every node at or under `id` in a map. */
function region(map: PlacedMap, id: string): Set<string> {
  const out = new Set<string>();
  const walk = (at: string) => { out.add(at); for (const c of map.nodes.get(at)?.children ?? []) walk(c); };
  walk(id);
  return out;
}

/** The boxes outside the changed parents' regions (each parent's own box counts as outside) that moved, resized or changed text. */
function movedOutside(before: PlacedMap, after: PlacedMap, parents: readonly string[]): string[] {
  const inside = new Set<string>();
  for (const map of [before, after]) for (const p of parents) for (const id of region(map, p)) if (id !== p) inside.add(id);
  const moved: string[] = [];
  for (const [id, b] of before.nodes) {
    if (inside.has(id)) continue;
    const a = after.nodes.get(id);
    if (!a || a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h || a.text !== b.text) moved.push(id);
  }
  return moved;
}

/** Each parent's children, top to bottom (Tree) or in reading order (Nested), as the map places them. */
const placedOrder = (map: PlacedMap, parent: string) =>
  [...(map.nodes.get(parent)?.children ?? [])].sort((a, b) => { const na = map.nodes.get(a)!; const nb = map.nodes.get(b)!; return na.y - nb.y || na.x - nb.x; });

/** The siblings that were there before, in the order the map places them after: their order must be kept. */
const keptOrder = (before: PlacedMap, after: PlacedMap, parent: string) => {
  const was = placedOrder(before, parent);
  return placedOrder(after, parent).filter((id) => was.includes(id));
};

const changed = (tree: Tree, edit: (t: Tree) => void): Tree => { const t = structuredClone(tree); edit(t); return t; };

/** Each change to the tree: what it does, the parents whose regions it may rearrange, and the order it leaves them in. */
const LOCAL: { name: string; tree?: (t: Tree) => void; titles?: Record<string, string>; parents: string[]; order?: Record<string, string[]> }[] = [
  { name: 'adding a record moves only its parent\'s region, and puts it at its place among its siblings', tree: (t) => { t.d1 = ['a1', 'a1b', 'a2', 'a3']; }, parents: ['d1'], order: { d1: ['a1', 'a1b', 'a2', 'a3'] } },
  { name: 'removing a record moves only its parent\'s region, and its siblings keep their order', tree: (t) => { t.c3 = []; t.d3 = ['c1', 'c2', 'c4']; }, parents: ['d3'], order: { d3: ['c1', 'c2', 'c4'] } },
  { name: 'renaming a record moves only its parent\'s region, and nothing is re-sorted', titles: { a3: 'A record renamed to a title long enough to wrap onto several lines of its box' }, parents: ['d1'], order: { d1: ['a1', 'a2', 'a3'] } },
  { name: 'moving a record moves only its old and its new parent\'s regions', tree: (t) => { t.a2 = ['a2.1', 'a2.3']; t.b2 = ['b2.1', 'a2.2', 'b2.2']; }, parents: ['a2', 'b2'], order: { a2: ['a2.1', 'a2.3'], b2: ['b2.1', 'a2.2', 'b2.2'] } },
  { name: 'a change deep in the tree keeps every box of the other domains, and the changed parent\'s own box', tree: (t) => { t['a1.2'] = ['x1', 'x2']; }, parents: ['a1.2'] },
];

function staysLocal(view: View, change: (typeof LOCAL)[number]) {
  const before = mapOf(view, BEFORE);
  const after = mapOf(view, change.tree ? changed(BEFORE, change.tree) : BEFORE, { ...TITLES, ...change.titles });
  expect(movedOutside(before, after, change.parents)).toEqual([]);
  for (const [parent, order] of Object.entries(change.order ?? {})) expect(placedOrder(after, parent)).toEqual(order);
}

describe('LA-EXP-DS05-T16 the Tree layout keeps every box outside a change where it was', () => {
  it.each(LOCAL)('$name', (change) => staysLocal('tree', change));
});

describe('LA-EXP-DS07-T04 the Nested layout keeps every box outside a change where it was', () => {
  it.each(LOCAL)('$name', (change) => staysLocal('nested', change));
});

describe('LA-EXP-DS05-T16 the Tree layout keeps a change local even where a parent gains its first child or loses its last', () => {
  // The Tree's text fits each label in its own box, whether it has children or not, so a record that becomes a parent
  // (or stops being one) changes nothing of its siblings.
  const before = mapOf('tree', BEFORE);
  it('a first child moves nothing outside its new parent', () => {
    const after = mapOf('tree', changed(BEFORE, (t) => { t.a3 = ['a3.1']; }));
    expect(movedOutside(before, after, ['a3'])).toEqual([]);
  });
  it('removing a last child moves nothing outside its parent', () => {
    const after = mapOf('tree', changed(BEFORE, (t) => { t.c2 = []; }));
    expect(movedOutside(before, after, ['c2'])).toEqual([]);
  });
});

// ---------- On a product's own data: the Graph's Tree and Nested maps and the Trace's tree ----------

/** The model product with a second use case of two requirements, and two outcomes its capability serves. */
function product(): ServedData {
  const data = modelWorkspace();
  addRows(data, 'use_case', { id: 'P-D-UC02', title: 'Return a thing', capability_id: 'P-D-CAP01', goal: 'A member brings a thing back.' });
  addRows(data, 'uc_requirement',
    { id: 'P-D-UC02-R01', title: 'The return is recorded', use_case_id: 'P-D-UC02', statement: 'The return MUST be recorded.' },
    { id: 'P-D-UC02-R02', title: 'A late return is noted', use_case_id: 'P-D-UC02', statement: 'A late return MUST be noted.' });
  addRows(data, 'business_outcome',
    { id: 'P-BO01', title: 'More things lent', product_id: 'P', statement: 'Members borrow more.', measure: 'Loans a month', target: 'Up a tenth' },
    { id: 'P-BO02', title: 'Fewer lost things', product_id: 'P', statement: 'Fewer things go missing.', measure: 'Things lost a year', target: 'Down a half' });
  return addRows(data, 'serves', { source_id: 'P-D-CAP01', target_id: 'P-BO01' }, { source_id: 'P-D-CAP01', target_id: 'P-BO02' });
}

/**
 * Each change a Reader or an Agent makes, with the records it changes. A requirement is removed as the command layer
 * lets it be, after its test: two changes, each moving only its own parent's region.
 */
const CHANGES: { name: string; records: string[]; edit: (d: ServedData) => void }[] = [
  { name: 'adding a requirement', records: ['P-D-UC01-R03'], edit: (d) => { addRows(d, 'uc_requirement', { id: 'P-D-UC01-R03', title: 'A lost thing is refused', use_case_id: 'P-D-UC01', statement: 'A lost thing MUST be refused.' }); } },
  {
    name: 'removing a requirement and its test', records: ['P-D-UC01-R02', 'P-D-UC01-R02-T01'], edit: (d) => {
      removeRows(d, 'use_case_test', (r) => r.id === 'P-D-UC01-R02-T01');
      removeRows(d, 'fulfills', (r) => r.target_id === 'P-D-UC01-R02');
      removeRows(d, 'uc_requirement', (r) => r.id === 'P-D-UC01-R02');
    },
  },
  { name: 'renaming an aggregate', records: ['P-D-A2'], edit: (d) => { setRow(d, 'aggregate', 'P-D-A2', { title: 'Member of the library, renamed to a title long enough to wrap' }); } },
  { name: 'moving a requirement to another use case', records: ['P-D-UC01-R02'], edit: (d) => { setRow(d, 'uc_requirement', 'P-D-UC01-R02', { use_case_id: 'P-D-UC02' }); } },
];

/** The parents of every place the changed records have in the maps before and after: the changed regions. */
const parentsOf = (maps: readonly PlacedMap[], records: readonly string[], idOf: (place: string) => string = (p) => p) =>
  [...new Set(maps.flatMap((map) => [...map.nodes.values()].filter((n) => records.includes(idOf(n.id)) && n.parent !== null).map((n) => n.parent!)))];

describe.each(CHANGES)('$name keeps every box outside its parent where it was', ({ records, edit }) => {
  const changedData = () => { const d = product(); edit(d); return d; };

  const onTheGraph = (view: View) => {
    const layOut = (d: ServedData) => (view === 'tree' ? graphMap : nestedMap)(recordIndexOf(d), 'P');
    const before = layOut(product());
    const after = layOut(changedData());
    const parents = parentsOf([before, after], records);
    expect(parents.length).toBeGreaterThan(0);
    expect(movedOutside(before, after, parents)).toEqual([]);
    for (const p of parents) expect(keptOrder(before, after, p)).toEqual(placedOrder(before, p).filter((id) => after.nodes.get(p)?.children.includes(id)));
  };
  it('LA-EXP-DS05-T16 on the Graph\'s Tree map', () => onTheGraph('tree'));
  it('LA-EXP-DS07-T04 on the Graph\'s Nested map', () => onTheGraph('nested'));

  it('LA-V98-R12-T02 on the Trace\'s tree', () => {
    const layOut = (d: ServedData) => {
      const { index, traces } = traced(d);
      const m = traceMap(index, traces, 'P');
      const input = traceInput(m, index, textMeasure().key);
      return { map: layoutTree([m.product], (k) => m.tree.get(k)!.children, (k) => input.labels[input.shape.ids.indexOf(k)]), idOf: (k: string) => m.nodes.get(k)?.id ?? k };
    };
    const before = layOut(product());
    const after = layOut(changedData());
    const parents = [...new Set([...parentsOf([before.map], records, before.idOf), ...parentsOf([after.map], records, after.idOf)])];
    expect(parents.length).toBeGreaterThan(0);
    expect(movedOutside(before.map, after.map, parents)).toEqual([]);
  });
});
