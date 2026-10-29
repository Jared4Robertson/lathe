import { describe, expect, it } from 'vitest';
import { addRows, indexOf } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';
import { gap } from '../fixtures/workspace';
import { obligationsUnder, untracedUnder } from '../../src/trace/chain';
import { allBoxes, BOX_H, CELL_SHOWN, lanesIn, ROW_GAP, traceFade, traceFocus, traceMap, visibleIn, type LaneColumn, type TraceMap } from '../../src/trace/lanes';

// The Trace stage's map (app/src/trace/lanes.ts): one map per product, a why tree from its outcomes
// and a lane per obligation, gaps as dashed boxes, the Untraced lane last, laid out once in map
// units; where focusing each kind of record puts the camera and what it keeps at full strength; what
// Gaps only fades; and what a rectangle of it holds.

/** The model product with two business outcomes its one capability serves, and the refused step in the lending view. */
function withOutcomes() {
  const data = modelWorkspace();
  addRows(data, 'business_outcome',
    { id: 'P-BO01', title: 'More things lent', product_id: 'P', statement: 'Members borrow more.', measure: 'Loans a month', target: 'Up a tenth' },
    { id: 'P-BO02', title: 'Fewer lost things', product_id: 'P', statement: 'Fewer things go missing.', measure: 'Things lost a year', target: 'Down a half' });
  addRows(data, 'serves', { source_id: 'P-D-CAP01', target_id: 'P-BO01' }, { source_id: 'P-D-CAP01', target_id: 'P-BO02' });
  addRows(data, 'happens_in', { source_id: 'P-D-UC01-FL01-S03', target_id: 'P-V01' });
  return indexOf(data);
}

const FADE = { focusFade: 0.25 };
const columnsOf = (m: TraceMap) => m.columns.map((c) => c.column);
const boxesOf = (m: TraceMap, id: string) => allBoxes(m).filter((b) => b.id === id);
const laneOf = (m: TraceMap, obligation: string | null) => m.lanes.find((l) => l.obligation === obligation)!;
const inColumn = (m: TraceMap, obligation: string | null, column: LaneColumn) => laneOf(m, obligation).boxes.filter((b) => b.column === column).map((b) => b.id);
/** Every box's and line's place, as a snapshot. */
const positions = (m: TraceMap) => JSON.stringify([...[...allBoxes(m), ...m.lanes.flatMap((l) => l.open?.boxes ?? [])].map((b) => [b.key, b.x, b.y, b.w, b.h]), ...[...m.tree.lines, ...m.lanes.flatMap((l) => l.lines)].map((l) => [l.key, l.points])]);

describe('the Trace stage\'s map', () => {
  it('LA-V98-R03-T03 A product\'s why tree starts at its outcomes, a capability serving several repeated under each; with none, at its capabilities', () => {
    const index = withOutcomes();
    const map = traceMap(index, 'P');
    expect(columnsOf(map).slice(0, 4)).toEqual(['outcome', 'capability', 'parent', 'obligation']);
    expect(map.tree.boxes.filter((b) => b.column === 'outcome').map((b) => b.id)).toEqual(['P-BO01', 'P-BO02']);
    const caps = boxesOf(map, 'P-D-CAP01');
    expect(caps).toHaveLength(2);
    expect(caps.map((c) => c.notes)).toEqual([['Also serves Fewer lost things'], ['Also serves More things lent']]);
    expect(map.lanesOf.get('P-D-UC01-R01')).toHaveLength(2);
    // Each parent is as tall as the lanes beneath it, and joined to each child by a level line.
    for (const cap of caps) {
      const under = map.lanes.filter((l) => l.top >= cap.y && l.top + l.height <= cap.y + cap.h + 1e-9);
      expect(under.map((l) => l.obligation)).toEqual(['P-D-UC01-R01', 'P-D-UC01-R02']);
      expect(cap.y).toBe(under[0].top);
    }
    expect(map.tree.lines.some((l) => l.source === 'P-BO01' && l.target === 'P-D-CAP01' && l.points[0].y === l.points[1].y)).toBe(true);
    // An invariant hangs from its aggregate, a specification under its domain from no tree, after it.
    expect(map.tree.boxes.find((b) => b.id === 'P-D-A3')?.column).toBe('parent');
    const order = map.lanes.map((l) => l.obligation);
    expect(order.indexOf('P-D-SP01')).toBeGreaterThan(order.indexOf('P-D-INV01'));
    // Every obligation of the product has a lane.
    expect(new Set(map.lanesOf.keys())).toEqual(new Set(obligationsUnder(index, 'P')));

    // With no outcomes the tree starts at the capability, and no column is drawn for outcomes.
    const plain = traceMap(indexOf(modelWorkspace()), 'P');
    expect(columnsOf(plain)).not.toContain('outcome');
    expect(plain.tree.boxes.find((b) => b.column === 'capability')?.id).toBe('P-D-CAP01');
  });

  it('LA-V98-R04-T03 A lane\'s gap is a dashed box in its column, and Gaps only fades the lanes with none', () => {
    // A specification nothing implements or proves, as coverage reports it: a gap box in the build and tests columns, none for its design.
    const data = modelWorkspace();
    data.coverage[0].gaps.push(gap('P-D-SP01', 'specification', 'built'), gap('P-D-SP01', 'specification', 'proved'));
    const index = indexOf(data);
    const map = traceMap(index, 'P');
    const gaps = laneOf(map, 'P-D-SP01').boxes.filter((b) => b.role === 'gap');
    expect(gaps.map((b) => [b.column, b.words?.title])).toEqual([['build', 'Not built'], ['tests', 'Not proved']]);
    // A traced requirement has none.
    expect(laneOf(map, 'P-D-UC01-R01').boxes.some((b) => b.role === 'gap')).toBe(false);
    expect(map.counts.withGaps).toBe(new Set(map.lanes.filter((l) => l.obligation && l.gaps.length > 0).map((l) => l.obligation)).size);
    // Gaps only: every lane stays; those with a gap and the Untraced lane at full strength, the rest faded.
    const fade = traceFade(map, null, true, FADE);
    for (const lane of map.lanes) {
      const kept = lane.obligation === null || lane.gaps.length > 0;
      for (const b of lane.boxes) expect(fade(b.key), b.key).toBe(kept ? 1 : FADE.focusFade);
    }
    expect(fade(laneOf(map, 'P-D-UC01-R01').boxes[0].key)).toBe(FADE.focusFade);
    expect(map.lanes.at(-1)!.obligation).toBeNull();
  });

  it('LA-V98-R07-T03 The Untraced lane comes last, its head then each record no chain reaches in its column', () => {
    const index = indexOf(modelWorkspace());
    const map = traceMap(index, 'P');
    const untraced = map.lanes.at(-1)!;
    expect(untraced.obligation).toBeNull();
    const head = untraced.boxes.find((b) => b.column === 'obligation')!;
    const ids = untracedUnder(index, 'P').flatMap((g) => g.ids);
    expect(head.role).toBe('untraced');
    expect(head.words?.meta).toBe(`${ids.length} records no chain reaches`);
    expect(inColumn(map, null, 'step')).toContain('P-D-UC01-FL01-S02');
    expect(inColumn(map, null, 'design')).toEqual(expect.arrayContaining(['P-D-CMD02', 'P-E-CMD01']));
    expect(untraced.boxes.length).toBe(ids.length + 1);
    // Every box of the lane starts at its top.
    expect(Math.min(...untraced.boxes.map((b) => b.y))).toBe(untraced.top);
  });

  it('LA-V98-R08-T02 Focusing frames each kind of record on the map and keeps what is under it at full strength', () => {
    const index = withOutcomes();
    const map = traceMap(index, 'P');
    const lanesUnder = (ids: readonly string[]) => new Set(ids.flatMap((o) => map.lanesOf.get(o) ?? []));
    // The product: the whole map, nothing faded.
    expect(traceFocus(map, index, 'P')).toEqual({ rect: { x: 0, y: 0, w: map.width, h: map.height }, anchor: null, lanes: null, open: null, box: null });
    // A use case: its first box in the tree and the lanes to its right, every copy's lanes kept.
    const uc = traceFocus(map, index, 'P-D-UC01');
    const ucBox = boxesOf(map, 'P-D-UC01')[0];
    expect(uc.rect).toEqual({ x: ucBox.x, y: ucBox.y, w: map.width - ucBox.x, h: ucBox.h });
    expect(uc.lanes).toEqual(lanesUnder(['P-D-UC01-R01', 'P-D-UC01-R02']));
    // An obligation: its first lane, centered on its box; its lane under each outcome kept.
    const req = traceFocus(map, index, 'P-D-UC01-R01');
    const first = map.lanes[map.lanesOf.get('P-D-UC01-R01')![0]];
    expect(req.rect).toEqual({ x: 0, y: first.top, w: map.width, h: first.height });
    expect(req.anchor).toMatchObject({ x: first.boxes.find((b) => b.column === 'obligation')!.x, h: BOX_H });
    expect(req.lanes).toEqual(lanesUnder(['P-D-UC01-R01']));
    // A command three chains hold: its first copy's lane, every lane holding a copy kept.
    const cmd = traceFocus(map, index, 'P-D-CMD01');
    const copies = boxesOf(map, 'P-D-CMD01');
    expect(cmd.anchor).toMatchObject({ x: copies[0].x, y: copies[0].y });
    expect(cmd.lanes).toEqual(new Set(copies.map((b) => b.lane)));
    expect(new Set([...cmd.lanes!].map((i) => map.lanes[i].obligation))).toEqual(new Set(['P-D-DS01', 'P-D-SP01', 'P-D-UC01-R01']));
    // A command nothing traces to: its own row in the Untraced lane.
    const loose = traceFocus(map, index, 'P-D-CMD02');
    const looseBox = boxesOf(map, 'P-D-CMD02')[0];
    expect(map.lanes[looseBox.lane].obligation).toBeNull();
    expect(loose.rect).toEqual({ x: 0, y: looseBox.y, w: map.width, h: looseBox.h });
    // An entity, outside every chain: its aggregate, the invariants' parent in the tree.
    expect(traceFocus(map, index, 'P-D-EN03')).toEqual(traceFocus(map, index, 'P-D-A3'));
    expect(traceFocus(map, index, 'P-D-A3').lanes).toEqual(lanesUnder(['P-D-INV01', 'P-D-INV02']));
    // A domain: all its obligations' lanes, and the Untraced lane for what is untraced under it.
    const domain = traceFocus(map, index, 'P-D');
    expect(domain.lanes).toEqual(new Set([...lanesUnder(obligationsUnder(index, 'P-D')), map.lanes.length - 1]));
    // The fade keeps the focus's lanes, and the tree boxes over them, at full strength.
    const fade = traceFade(map, req.lanes, false, FADE);
    expect(fade(first.boxes[0].key)).toBe(1);
    expect(fade(laneOf(map, 'P-D-INV01').boxes[0].key)).toBe(FADE.focusFade);
    expect(fade(ucBox.key)).toBe(1);
    expect(fade(boxesOf(map, 'P-D-A3')[0].key)).toBe(FADE.focusFade);
  });

  it('LA-PAT-APP-UX-R19-T01 The Trace map is laid out once: focusing two records and toggling Gaps only moves no box', () => {
    const index = withOutcomes();
    const map = traceMap(index, 'P');
    const before = positions(map);
    for (const focus of ['P-D-UC01-R01', 'P-D-CMD01']) {
      const at = traceFocus(map, index, focus);
      traceFade(map, at.lanes, false, FADE);
      traceFade(map, at.lanes, true, FADE);
      // The same map for the same product and data, whatever was focused or filtered.
      expect(traceMap(index, 'P')).toBe(map);
    }
    expect(positions(map)).toBe(before);
    // New data is a new index: the map is laid out again for it, once.
    const again = indexOf(modelWorkspace());
    expect(traceMap(again, 'P')).not.toBe(map);
    expect(traceMap(again, 'P')).toBe(traceMap(again, 'P'));
  });

  it('LA-V98-R06-T03 Only what is in view is drawn, at most 260 boxes; far out the boxes are bars, and further out the lanes', () => {
    const data = modelWorkspace();
    addRows(data, 'uc_requirement', ...Array.from({ length: 400 }, (_, n) => ({ id: `P-D-UC01-R${String(n + 10).padStart(3, '0')}`, title: `Rule ${n + 10}`, use_case_id: 'P-D-UC01', statement: `Rule ${n + 10} MUST hold.` })));
    const map = traceMap(indexOf(data), 'P');
    expect(map.lanes.length).toBeGreaterThan(400);
    // A rectangle holds only the boxes and arrows that meet it: the tree's tall boxes and the lanes it crosses.
    const lane = map.lanes[200];
    const segment = map.segments[lane.segment];
    const rect = { x0: segment.x, x1: segment.x + map.segmentWidth, y0: lane.top, y1: lane.top + lane.height };
    const seen = visibleIn(map, rect);
    const lanes = new Set(seen.boxes.filter((b) => b.lane >= 0).map((b) => b.lane));
    expect([...lanes].every((i) => Math.abs(i - 200) <= 1)).toBe(true);
    expect(seen.boxes.filter((b) => b.lane < 0).map((b) => b.id)).toEqual(['P-D-CAP01', 'P-D-UC01']);
    for (const b of seen.boxes) expect(b.y + b.h >= rect.y0 && b.y <= rect.y1).toBe(true);
    // Far out, a lane is one bar from its first box to its last.
    const far = lanesIn(map, rect);
    expect(far.lanes.every((l) => Math.abs(l.lane - 200) <= 1)).toBe(true);
    expect(map.lanes[200].left).toBe(Math.min(...map.lanes[200].boxes.map((b) => b.x)));
    // A box is BOX_H tall.
    expect(map.lanes[0].boxes.every((b) => b.h === BOX_H)).toBe(true);
  });

  it('LA-V98-R13-T01 A lane\'s column shows four boxes then "+N more", one more shows all; focusing the lane opens it over the lanes below, nothing moving', () => {
    /** The model product with `extra` more files under P-D-UC01-R01's test. */
    const withFiles = (extra: number) => {
      const data = modelWorkspace();
      const chain = data.chains.find((c) => c.obligation === 'P-D-UC01-R01')!;
      for (let n = 1; n <= extra; n++) chain.files.push({ path: `test/lend-${n}.test.ts`, named_by: ['P-D-UC01-R01-T01'] });
      return indexOf(data);
    };
    const base = traceMap(withFiles(0), 'P').lanes.find((l) => l.obligation === 'P-D-UC01-R01')!.boxes.filter((b) => b.column === 'files').length;
    // One more than CELL_SHOWN: every box shows, and the lane has no open form.
    const five = laneOf(traceMap(withFiles(CELL_SHOWN + 1 - base), 'P'), 'P-D-UC01-R01');
    expect(five.boxes.filter((b) => b.column === 'files')).toHaveLength(CELL_SHOWN + 1);
    expect(five.open).toBeNull();

    const index = withFiles(8);
    const map = traceMap(index, 'P');
    const all = base + 8;
    const i = map.lanesOf.get('P-D-UC01-R01')![0];
    const lane = map.lanes[i];
    // Shown: the first four files, then "+N more", the lane five boxes tall; arrows to a hidden file go to it.
    const shown = lane.boxes.filter((b) => b.column === 'files');
    expect(shown.map((b) => b.role)).toEqual(['file', 'file', 'file', 'file', 'more']);
    expect(shown[4].words).toEqual({ title: `+${all - CELL_SHOWN} more`, meta: `Files · ${all} in all` });
    expect(shown[4].opens).toBe('P-D-UC01-R01-T01');
    expect(lane.height).toBe(5 * BOX_H + 4 * ROW_GAP);
    expect(lane.lines.filter((l) => l.target === shown[4].id)).toHaveLength(1);
    // Open: every file, the shown ones where they are and the rest below them, past the lane's bottom.
    const open = lane.open!;
    const files = open.boxes.filter((b) => b.column === 'files');
    expect(files).toHaveLength(all);
    expect(files.slice(0, CELL_SHOWN)).toEqual(shown.slice(0, CELL_SHOWN));
    expect(files.every((b, n) => n === 0 || b.y > files[n - 1].y)).toBe(true);
    expect(open.bottom).toBeGreaterThan(lane.top + lane.height);
    expect(open.lines.filter((l) => l.target.startsWith('file:'))).toHaveLength(all);

    // Focusing the obligation, or a record in the lane, opens it and frames it to its open form's bottom.
    const before = positions(map);
    for (const id of ['P-D-UC01-R01', 'P-D-UC01-R01-T01']) {
      const at = traceFocus(map, index, id);
      expect(at.open, id).toBe(i);
      expect(at.rect.y + at.rect.h).toBe(open.bottom);
    }
    // A domain focused opens none.
    expect(traceFocus(map, index, 'P-D').open).toBeNull();
    // Drawn open: the lane's every box; the boxes of the lanes below that it covers left out, their arrows too; the others where they were.
    const whole = { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 };
    const seen = visibleIn(map, whole, i);
    expect(seen.boxes.filter((b) => b.lane === i && b.column === 'files')).toHaveLength(all);
    const covered = (b: { lane: number; y: number }) => b.lane > i && map.lanes[b.lane].segment === lane.segment && b.y < open.bottom;
    expect(seen.boxes.some(covered)).toBe(false);
    expect(allBoxes(map).filter((b) => b.lane >= 0 && covered(b)).length).toBeGreaterThan(0);
    const keys = new Set(seen.boxes.map((b) => b.key));
    expect(seen.lines.every((l) => keys.has(l.from) && keys.has(l.to))).toBe(true);
    const shut = visibleIn(map, whole);
    expect(shut.boxes.filter((b) => b.lane === i && b.column === 'files').map((b) => b.role)).toEqual(['file', 'file', 'file', 'file', 'more']);
    // Far out, the open lane is one bar to its open form's bottom, and the lanes it covers none.
    const far = lanesIn(map, whole, i);
    expect(far.lanes.find((l) => l.lane === i)!.h).toBe(open.bottom - lane.top);
    expect(far.lanes.some((l) => covered({ lane: l.lane, y: l.y }))).toBe(false);
    expect(positions(map)).toBe(before);
  });

  it('LA-V98-R14-T01 The lanes are grouped in labeled bands by domain, in the tree\'s order, flowing down columns so a large product\'s overview is about as wide as tall', () => {
    const index = withOutcomes();
    const map = traceMap(index, 'P');
    // A band per part of the tree that holds obligations, in the tree's order, each labeled and its lanes together; the Untraced lane last, in its own.
    expect(map.bands.map((b) => b.label)).toEqual([...map.bands.filter((b) => b.id !== 'untraced').map((b) => index.byId.get(b.id)?.title ?? 'Shared'), 'Untraced']);
    expect(map.bands.find((b) => b.id === 'P-D')?.label).toBe(index.byId.get('P-D')!.title);
    expect(map.bands.at(-1)).toMatchObject({ id: 'untraced', from: map.lanes.length - 1, to: map.lanes.length });
    map.bands.forEach((b, n) => {
      expect(b.from).toBe(n === 0 ? 0 : map.bands[n - 1].to);
      for (let i = b.from; i < b.to; i++) expect(map.lanes[i].band).toBe(n);
      // Its label sits over its first lane, in its head.
      expect(b.heads[0]).toMatchObject({ x: map.segments[map.lanes[b.from].segment].x, continued: false });
      expect(b.heads[0].y).toBeLessThan(map.lanes[b.from].top);
    });
    for (const o of obligationsUnder(index, 'P-D')) for (const i of map.lanesOf.get(o)!) expect(map.bands[map.lanes[i].band].id).toBe('P-D');
    // A small product's bands go on in one column, under each other.
    expect(map.segments).toHaveLength(1);

    // A large one's flow down several columns side by side, the overview about a pane's shape; a band too tall for a
    // column goes on at the next's top, labeled again, its tree boxes split there and marked "Continued".
    const data = modelWorkspace();
    addRows(data, 'uc_requirement', ...Array.from({ length: 900 }, (_, n) => ({ id: `P-D-UC01-R${String(n + 10).padStart(3, '0')}`, title: `Rule ${n + 10}`, use_case_id: 'P-D-UC01', statement: `Rule ${n + 10} MUST hold.` })));
    const large = traceMap(indexOf(data), 'P');
    expect(large.segments.length).toBeGreaterThan(2);
    expect(large.width / large.height).toBeGreaterThan(0.8);
    expect(large.width / large.height).toBeLessThan(3);
    const domain = large.bands.find((b) => b.id === 'P-D')!;
    expect(domain.heads.length).toBeGreaterThan(1);
    expect(domain.heads.slice(1).every((h) => h.continued)).toBe(true);
    expect(large.tree.boxes.filter((b) => b.id === 'P-D-UC01' && b.notes.includes('Continued')).length).toBe(domain.heads.length - 1);
    // Down each column the lanes are in order, so what is in view is found by halving.
    for (const s of large.segments) for (let i = s.from + 1; i < s.to; i++) expect(large.lanes[i].top).toBeGreaterThan(large.lanes[i - 1].top);
    expect(large.segments.every((s, n) => n === 0 || s.x > large.segments[n - 1].x + large.segmentWidth)).toBe(true);
  });
});
