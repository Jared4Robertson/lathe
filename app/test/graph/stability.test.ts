import { describe, expect, it } from 'vitest';
import type { PlacedMap } from '../../src/graph/map';
import { type MapLabel } from '../../src/graph/text';
import { addRows, removeRows, setRow } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';
import { recordIndexOf, type ServedData } from '../read-view';
import { traced } from '../trace/rows';
import { orderGraph } from '../../src/trace/order';
import { layOutTrace } from '../../src/trace/layout';
import { cellKey, TRACE_STAGES } from '../../src/trace/trace';
import { ITEM_HEIGHT } from '../../src/trace/layout';
import { graphMap, groundMap, groundMapAfter, layoutNested, layoutTree, nestedMap } from './maps';

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

/**
 * The boxes outside the changed parents' regions (each parent's own box counts as outside) that moved, resized or changed
 * text; a changed parent's own text may change only where it becomes a parent or a leaf (a Nested leaf's label is
 * centered at its leaves' scale, a parent's in its header band at its parents', LA-EXP-DS07).
 */
function movedOutside(before: PlacedMap, after: PlacedMap, parents: readonly string[]): string[] {
  const inside = new Set<string>();
  for (const map of [before, after]) for (const p of parents) for (const id of region(map, p)) if (id !== p) inside.add(id);
  const moved: string[] = [];
  for (const [id, b] of before.nodes) {
    if (inside.has(id)) continue;
    const a = after.nodes.get(id);
    const becameOther = parents.includes(id) && (a?.children.length === 0) !== (b.children.length === 0);
    if (!a || a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h || (a.text !== b.text && !becameOther)) moved.push(id);
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

/** The boxes outside the changed parents' regions whose header band changed (the Nested map's), its siblings' insides with it. */
function headerChangedOutside(before: PlacedMap, after: PlacedMap, parents: readonly string[]): string[] {
  const inside = new Set(parents.flatMap((p) => [...region(before, p), ...region(after, p)]));
  const header = (map: PlacedMap, id: string) => (map.nodes.get(id) as { header?: number } | undefined)?.header;
  return [...before.nodes.keys()].filter((id) => !inside.has(id) && header(before, id) !== header(after, id));
}

describe.each([
  ['tree', 'LA-EXP-DS05-T16'],
  ['nested', 'LA-EXP-DS07-T04'],
] as const)('%s: the layout keeps a change local even where a parent gains its first child or loses its last (%s)', (view: View, _test: string) => {
  // Each sibling's text is fitted whether it has children or not (the Nested header band as if every sibling were a
  // parent), so a record that becomes a parent, or stops being one, changes nothing of its siblings.
  const before = mapOf(view, BEFORE);
  it('a first child moves nothing outside its new parent', () => {
    const after = mapOf(view, changed(BEFORE, (t) => { t.a3 = ['a3.1']; }));
    expect(movedOutside(before, after, ['a3'])).toEqual([]);
    expect(headerChangedOutside(before, after, ['a3'])).toEqual([]);
  });
  it('removing a last child moves nothing outside its parent', () => {
    const after = mapOf(view, changed(BEFORE, (t) => { t.c2 = []; }));
    expect(movedOutside(before, after, ['c2'])).toEqual([]);
    expect(headerChangedOutside(before, after, ['c2'])).toEqual([]);
  });
  it('a first child under a sibling with the longest label keeps its siblings\' insides', () => {
    const after = mapOf(view, changed(BEFORE, (t) => { t.a3 = ['a3.1']; }), { ...TITLES, a3: 'A record whose title is long enough to wrap onto several lines of its box' });
    const was = mapOf(view, BEFORE, { ...TITLES, a3: 'A record whose title is long enough to wrap onto several lines of its box' });
    expect(movedOutside(was, after, ['a3'])).toEqual([]);
    expect(headerChangedOutside(was, after, ['a3'])).toEqual([]);
  });
});

// ---------- On a product's own data: the Graph's Tree and Nested maps and the Trace stage ----------

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

/** Every container above `id` in a map, and `id` itself. */
const chainOf = (map: PlacedMap, id: string): string[] => { const out: string[] = []; for (let at: string | null = id; at !== null; at = map.nodes.get(at)?.parent ?? null) out.push(at); return out; };

/** A box's place inside its parent (from its parent's corner) and its size. */
const inParent = (map: PlacedMap, id: string) => {
  const n = map.nodes.get(id)!;
  const p = n.parent ? map.nodes.get(n.parent)! : { x: 0, y: 0 };
  return { x: n.x - p.x, y: n.y - p.y, w: n.w, h: n.h };
};

const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The Map's rule for a change (LA-PAT-APP-UX-R22, LA-EXP-DS12), as on the ERD: outside the changed parents, every box
 * keeps its size, and its place inside its parent unless a sibling that grew or was pushed now covers where it was
 * (each such box is reported); the changed parents and the containers above them never shrink; no two siblings overlap.
 */
function mapChange(before: PlacedMap, after: PlacedMap, parents: readonly string[]) {
  const inside = new Set(parents.flatMap((p) => [...region(before, p), ...region(after, p)].filter((id) => id !== p)));
  const chain = new Set(parents.flatMap((p) => [...chainOf(before, p), ...chainOf(after, p)]));
  const shifted: string[] = [];
  const resized: string[] = [];
  for (const id of before.nodes.keys()) {
    if (inside.has(id) || !after.nodes.has(id) || after.nodes.get(id)!.parent !== before.nodes.get(id)!.parent) continue;
    const [b, a] = [inParent(before, id), inParent(after, id)];
    if (chain.has(id)) { if (a.w < b.w || a.h < b.h) resized.push(id); } else if (a.w !== b.w || a.h !== b.h) resized.push(id);
    if (a.x === b.x && a.y === b.y) continue;
    // Pushed: a sibling now covers where it was.
    const up = after.nodes.get(id)!.parent;
    const siblings = up ? after.nodes.get(up)!.children.filter((c) => c !== id) : [];
    if (!siblings.some((c) => before.nodes.has(c) && overlap(inParent(after, c), b))) shifted.push(id);
  }
  const overlapping: string[] = [];
  for (const n of after.nodes.values()) {
    const kids = n.children.map((c) => after.nodes.get(c)!);
    kids.forEach((k, i) => kids.slice(i + 1).forEach((o) => { if (overlap(k, o)) overlapping.push(`${k.id}/${o.id}`); }));
  }
  return { shifted, resized, overlapping };
}

/** The parents of every place the changed records have in the maps before and after: the changed regions. */
const parentsOf = (maps: readonly PlacedMap[], records: readonly string[], idOf: (place: string) => string = (p) => p) =>
  [...new Set(maps.flatMap((map) => [...map.nodes.values()].filter((n) => records.includes(idOf(n.id)) && n.parent !== null).map((n) => n.parent!)))];

describe('LA-PAT-APP-UX-R22 a problem badge appearing moves nothing', () => {
  // The badge's room is kept on every label, whether its box has the badge or not, so a record that gains a problem (an
  // ancestor's group badge appearing with it) changes no box's text or size, on any map.
  const withProblem = () => {
    const d = product();
    d.problems.push({ severity: 'error', check: 'dangling-link', record: 'P-D-A2', message: 'Aggregate P-D-A2 links to a missing record.' });
    return d;
  };
  const same = (before: PlacedMap, after: PlacedMap) => expect(movedOutside(before, after, [])).toEqual([]);
  it('LA-EXP-DS05-T16 on the Graph\'s Tree map', () => same(graphMap(recordIndexOf(product()), 'P'), graphMap(recordIndexOf(withProblem()), 'P')));
  it('LA-EXP-DS07-T04 on the Graph\'s Nested map', () => {
    const [before, after] = [nestedMap(recordIndexOf(product()), 'P'), nestedMap(recordIndexOf(withProblem()), 'P')];
    same(before, after);
    expect(headerChangedOutside(before, after, [])).toEqual([]);
  });
  it('LA-EXP-DS12-T04 on the Graph\'s Map', () => same(groundMap(recordIndexOf(product())), groundMap(recordIndexOf(withProblem()))));
  it('LA-V98-R20-T02 on the Trace stage', () => {
    const layOut = (d: ServedData) => { const { graph } = traced(d); return layOutTrace(graph, orderGraph(graph, null), { open: new Set(graph.rows.map((r) => cellKey(r.useCase, 'use-case'))), step: null }); };
    const [before, after] = [layOut(product()), layOut(withProblem())];
    expect([...after.places]).toEqual([...before.places]);
  });
});

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
  it('LA-EXP-DS12-T04 on the Graph\'s Map: every box outside the changed containers keeps its place unless a grown one now covers it, and Tidy up packs afresh', () => {
    const before = groundMap(recordIndexOf(product()));
    const changedIndex = recordIndexOf(changedData());
    const after = groundMapAfter(changedIndex, before);
    const parents = parentsOf([before, after], records);
    expect(parents.length).toBeGreaterThan(0);
    expect(mapChange(before, after, parents)).toEqual({ shifted: [], resized: [], overlapping: [] });
    // Laid out again on the same data, nothing moves; Tidy up gives the first layout's picture.
    expect(movedOutside(after, groundMapAfter(changedIndex, after), [])).toEqual([]);
    expect(movedOutside(groundMap(changedIndex), groundMapAfter(changedIndex, null), [])).toEqual([]);
  });

  it('LA-V98-R20-T02 on the Trace stage: the rows keep their order, a closed row its place, and an open one moves only the rows below it', () => {
    const { graph: was } = traced(product());
    const { graph: now } = traced(changedData());
    const shown = orderGraph(was, null);
    const order = orderGraph(now, shown);
    expect(order.rows).toEqual(shown.rows);
    // Every row closed: every box of every row keeps its place.
    const closed = { open: new Set<string>(), step: null };
    const [a, b] = [layOutTrace(was, shown, closed), layOutTrace(now, order, closed)];
    expect([...b.rows]).toEqual([...a.rows]);
    expect([...b.places]).toEqual([...a.places]);
    // Every row open: the rows above the first changed row keep every box where it was.
    const open = { open: new Set(now.rows.flatMap((r) => TRACE_STAGES.map((s) => cellKey(r.useCase, s)))), step: null };
    const [c, d] = [layOutTrace(was, shown, open), layOutTrace(now, order, open)];
    const changedRows = order.rows.filter((u) => JSON.stringify(was.rowOf.get(u)?.data) !== JSON.stringify(now.rowOf.get(u)?.data));
    const first = Math.min(...changedRows.map((u) => order.rows.indexOf(u)));
    for (const u of order.rows.slice(0, first)) {
      expect(d.rows.get(u)).toEqual(c.rows.get(u));
      for (const [key, p] of c.places) if (was.items.get(key)?.row === u) expect(d.places.get(key), key).toEqual(p);
    }
  });
});

describe('LA-EXP-DS12-T04 on the Graph\'s Map a removed record leaves its room and a new one takes free room first', () => {
  it('a requirement removed leaves its room; one added after takes it, its use case no bigger, and nothing else moves', () => {
    const first = groundMap(recordIndexOf(product()));
    const less = product();
    removeRows(less, 'use_case_test', (r) => r.id === 'P-D-UC01-R02-T01');
    removeRows(less, 'fulfills', (r) => r.target_id === 'P-D-UC01-R02');
    removeRows(less, 'uc_requirement', (r) => r.id === 'P-D-UC01-R02');
    const removed = groundMapAfter(recordIndexOf(less), first);
    // Only the removed ones are gone: every other box, their use case's too, keeps its place and size.
    expect(movedOutside(first, removed, [])).toEqual(['P-D-UC01-R02', 'P-D-UC01-R02-T01']);
    addRows(less, 'uc_requirement', { id: 'P-D-UC01-R03', title: 'A lost thing is refused', use_case_id: 'P-D-UC01', statement: 'A lost thing MUST be refused.' });
    const added = groundMapAfter(recordIndexOf(less), removed);
    expect(movedOutside(removed, added, [])).toEqual([]);
    const [was, now] = [first.nodes.get('P-D-UC01-R02')!, added.nodes.get('P-D-UC01-R03')!];
    expect([now.x, now.y]).toEqual([was.x, was.y]);
    // Tidy up packs the Map afresh, closing the room.
    expect(movedOutside(groundMap(recordIndexOf(less)), groundMapAfter(recordIndexOf(less), null), [])).toEqual([]);
  });
});

describe('LA-V98-R20-T02 on the Trace stage a use case added or removed moves no other row', () => {
  const closed = { open: new Set<string>(), step: null };
  const rowsOf = (d: ServedData, previous: ReturnType<typeof orderGraph> | null) => { const { graph } = traced(d); const order = orderGraph(graph, previous); return { order, laid: layOutTrace(graph, order, closed) }; };
  it('a removed use case leaves its row\'s room; a new one takes it when near, else goes at the end of its section; Tidy up closes the room', () => {
    const first = rowsOf(product(), null);
    const less = product();
    removeRows(less, 'uc_requirement', (r) => r.use_case_id === 'P-D-UC02');
    removeRows(less, 'use_case', (r) => r.id === 'P-D-UC02');
    const removed = rowsOf(less, first.order);
    for (const [u, band] of removed.laid.rows) expect(band, u).toEqual(first.laid.rows.get(u));
    addRows(less, 'use_case', { id: 'P-D-UC09', title: 'Renew a loan', capability_id: 'P-D-CAP01', goal: 'A member keeps a thing longer.' });
    const added = rowsOf(less, removed.order);
    for (const [u, band] of removed.laid.rows) expect(added.laid.rows.get(u), u).toEqual(band);
    expect(added.laid.rows.get('P-D-UC09')).toEqual(first.laid.rows.get('P-D-UC02'));
    // A second new one finds no room: at the end of its section, every other row still.
    addRows(less, 'use_case', { id: 'P-D-UC10', title: 'Reserve a thing', capability_id: 'P-D-CAP01', goal: 'A member holds a thing for later.' });
    const more = rowsOf(less, added.order);
    for (const [u, band] of added.laid.rows) expect(more.laid.rows.get(u), u).toEqual(band);
    const ends = [...added.laid.rows.values()].map((b) => b.y + b.h);
    expect(more.laid.rows.get('P-D-UC10')!.y).toBeGreaterThan(Math.max(...ends));
    // Tidy up: ordered afresh, no room kept.
    expect(orderGraph(traced(less).graph, null).roomBefore.size).toBe(0);
  });

  it('an outcome keeps its top through opening rows and new data; a new one takes a free place near its rows, else the bottom; a removed one leaves its place', () => {
    const outcomeTop = (laid: ReturnType<typeof layOutTrace>, o: string) => laid.places.get(`outcome/${o}`)?.y;
    const first = rowsOf(product(), null);
    const tops = { P_BO01: outcomeTop(first.laid, 'P-BO01'), P_BO02: outcomeTop(first.laid, 'P-BO02') };
    // Opening every row moves rows, never an outcome.
    const { graph } = traced(product());
    const open = layOutTrace(graph, first.order, { open: new Set(graph.rows.flatMap((r) => TRACE_STAGES.map((st) => cellKey(r.useCase, st)))), step: null });
    expect([outcomeTop(open, 'P-BO01'), outcomeTop(open, 'P-BO02')]).toEqual([tops.P_BO01, tops.P_BO02]);
    // A new outcome: the others stay, and it sits a box clear of them.
    const more = product();
    addRows(more, 'business_outcome', { id: 'P-BO03', title: 'Members come back', product_id: 'P', statement: 'Members return.', measure: 'Visits a month', target: 'Up a fifth' });
    addRows(more, 'serves', { source_id: 'P-D-CAP01', target_id: 'P-BO03' });
    const added = rowsOf(more, first.order);
    expect([outcomeTop(added.laid, 'P-BO01'), outcomeTop(added.laid, 'P-BO02')]).toEqual([tops.P_BO01, tops.P_BO02]);
    const y3 = outcomeTop(added.laid, 'P-BO03')!;
    for (const t of [tops.P_BO01!, tops.P_BO02!]) expect(Math.abs(y3 - t)).toBeGreaterThanOrEqual(ITEM_HEIGHT);
    // Removing P-BO01 leaves its place: P-BO02 and P-BO03 stay.
    removeRows(more, 'serves', (r) => r.target_id === 'P-BO01');
    removeRows(more, 'business_outcome', (r) => r.id === 'P-BO01');
    const removed = rowsOf(more, added.order);
    expect([outcomeTop(removed.laid, 'P-BO02'), outcomeTop(removed.laid, 'P-BO03')]).toEqual([tops.P_BO02, y3]);
    // Tidy up: a fresh order keeps no tops.
    expect(orderGraph(traced(more).graph, null).outcomeTops.size).toBe(0);
  });
});

