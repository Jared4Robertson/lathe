import { describe, expect, it } from 'vitest';
import { addRows } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';
import { cellKey, everyStepKey, innerKey, rowPath, statusOf, visible, type Openness } from '../../src/trace/trace';
import { orderGraph } from '../../src/trace/order';
import { ITEM_GAP, ITEM_HEIGHT, layOutTrace, outcomesBeside, ROW_GAP, type BoxPlace, type TraceLaid } from '../../src/trace/layout';
import { litBy } from '../../src/trace/path';
import { traceTarget } from '../../src/trace/walk';
import { traced } from './rows';

// The Trace stage (LA-V98), pure: its rows from the Trace read (list-trace-rows, LA-TRC-RM13), its
// stage statuses, what each open box shows, a selection's path across its row, the walk, and the layout's stability.

/** The model product with a second use case, two outcomes its capability serves, and a use case of a capability serving none. */
function product() {
  const data = modelWorkspace();
  addRows(data, 'use_case',
    { id: 'P-D-UC02', title: 'Return a thing', capability_id: 'P-D-CAP01', goal: 'A member brings a thing back.' });
  addRows(data, 'uc_requirement', { id: 'P-D-UC02-R01', title: 'The return is recorded', use_case_id: 'P-D-UC02', statement: 'The return MUST be recorded.' });
  addRows(data, 'capability', { id: 'P-D-CAP02', title: 'Housekeeping', domain_id: 'P-D', description: 'Keeping the shelves.' });
  addRows(data, 'use_case', { id: 'P-D-UC03', title: 'Dust the shelves', capability_id: 'P-D-CAP02', goal: 'The shelves stay clean.' });
  addRows(data, 'business_outcome',
    { id: 'P-BO01', title: 'More things lent', product_id: 'P', statement: 'Members borrow more.', measure: 'Loans a month', target: 'Up a tenth' },
    { id: 'P-BO02', title: 'Fewer lost things', product_id: 'P', statement: 'Fewer things go missing.', measure: 'Things lost a year', target: 'Down a half' });
  return addRows(data, 'serves', { source_id: 'P-D-CAP01', target_id: 'P-BO01' }, { source_id: 'P-D-CAP01', target_id: 'P-BO02' });
}

const NOTHING: Openness = { open: new Set(), step: null };
const opened = (keys: string[], step: string | null = null): Openness => ({ open: new Set(keys), step });

describe('LA-V98-R15-T02 The Trace stage has one row per use case, each once, with a line from each outcome its capability serves', () => {
  it('rows every use case of the space once, links each outcome to the rows it serves, and sets the rows serving none after the rest', () => {
    const { graph } = traced(product());
    expect(graph.rows.map((r) => r.useCase)).toEqual(['P-D-UC01', 'P-D-UC02', 'P-D-UC03']);
    expect(graph.outcomes).toEqual(['P-BO01', 'P-BO02']);
    expect(graph.serves).toEqual([['P-BO01', 'P-D-UC01'], ['P-BO02', 'P-D-UC01'], ['P-BO01', 'P-D-UC02'], ['P-BO02', 'P-D-UC02']]);
    expect(graph.counts.outside).toBe(1);
    const order = orderGraph(graph, null);
    expect(order.rows.at(-1)).toBe('P-D-UC03');
    const laid = layOutTrace(graph, order, NOTHING);
    // Each row as tall as one box while closed; the row serving no outcome under the mark, below the rest.
    for (const u of order.rows) expect(laid.rows.get(u)!.h).toBe(ITEM_HEIGHT);
    expect(laid.outsideTop).toBe(laid.rows.get('P-D-UC03')!.y);
    expect(laid.rows.get('P-D-UC03')!.y).toBeGreaterThan(laid.rows.get(order.rows[1])!.y);
    // Each outcome beside the rows it serves.
    expect(laid.places.get('outcome/P-BO01')!.y).toBeLessThanOrEqual(laid.rows.get(order.rows[1])!.y);
  });
});

describe('LA-V98-R16-T01 A closed row says each stage\'s status, a stage with a gap a dashed gap', () => {
  it('counts flows and requirements not designed, handlers and what is not built, and tests and what is not proved', () => {
    const { graph } = traced(product());
    const uc1 = graph.rowOf.get('P-D-UC01')!.data;
    expect(statusOf(uc1, 'design')).toEqual({ title: '1 flow · all designed', gap: false });
    expect(statusOf(uc1, 'technical')).toEqual({ title: '1 handler · all built', gap: false });
    expect(statusOf(uc1, 'suite')).toEqual({ title: '3 tests · 1 not proved', gap: true });
    // A use case with no flow: no flows, no handlers and no tests, each a gap.
    const uc2 = graph.rowOf.get('P-D-UC02')!.data;
    expect([statusOf(uc2, 'design'), statusOf(uc2, 'technical'), statusOf(uc2, 'suite')]).toEqual([{ title: 'No flows', gap: true }, { title: 'No handlers', gap: true }, { title: 'No tests', gap: true }]);
    expect(graph.items.get('P-D-UC01|suite')!.role).toBe('gap');
    expect(graph.items.get('P-D-UC01|design')!.role).toBe('status');
  });
});

describe('LA-V98-R17-T01 Each box opens down to its children, many at once', () => {
  const { graph } = traced(product());
  const row = graph.rowOf.get('P-D-UC01')!;
  const keys = (cell: number, o: Openness) => visible(graph, row.cells[cell], o).map((k) => graph.items.get(k)!.id ?? k.split('/').at(-1));

  it('opens a use case to its requirements and the aggregates its steps change, and a flow to its steps, each step to its view, endpoints and integrations', () => {
    expect(keys(1, NOTHING)).toEqual(['P-D-UC01']);
    expect(keys(1, opened([cellKey('P-D-UC01', 'use-case')]))).toEqual(['P-D-UC01', 'P-D-UC01-R01', 'P-D-UC01-R02', 'P-D-A1', 'P-D-A2', 'P-D-A3']);
    expect(keys(2, opened([cellKey('P-D-UC01', 'design')]))).toEqual(['P-D-UC01|design', 'P-D-UC01-FL01']);
    expect(keys(2, opened([cellKey('P-D-UC01', 'design'), innerKey('P-D-UC01', 'design', 'P-D-UC01-FL01'), innerKey('P-D-UC01', 'design', 'P-D-UC01-FL01-S01')])))
      .toEqual(['P-D-UC01|design', 'P-D-UC01-FL01', 'P-D-UC01-FL01-S01', 'P-V01', 'P-V01-R01', 'P-D-EP01', 'P-D-EP01-R01', 'P-D-UC01-FL01-S02', 'P-D-UC01-FL01-S03']);
  });

  it('opens Technical flow to the selected step\'s chain (a hint with none), and under Expand all to every step\'s, grouped by step', () => {
    const tech = cellKey('P-D-UC01', 'technical');
    expect(keys(3, opened([tech]))).toEqual(['P-D-UC01|technical', 'hint']);
    expect(keys(3, opened([tech], 'P-D-UC01-FL01-S01'))).toEqual(['P-D-UC01|technical', 'P-D-UC01-FL01-S01', 'P-UI01', 'P-D-EP01', 'P-D-CMD01-H', 'P-D-REPO01']);
    expect(keys(3, opened([tech, everyStepKey('P-D-UC01')]))).toEqual(['P-D-UC01|technical', 'P-D-UC01-FL01-S01', 'P-UI01', 'P-D-EP01', 'P-D-CMD01-H', 'P-D-REPO01', 'P-D-UC01-FL01-S02', 'P-INT01-AD', 'P-D-UC01-FL01-S03']);
  });

  it('opens the suite to how much is proved, each requirement\'s and flow\'s tests with a gap where proof is missing, and Lower tests to what they rest on', () => {
    const suite = cellKey('P-D-UC01', 'suite');
    expect(keys(4, opened([suite]))).toEqual(['P-D-UC01|suite', 'proved', 'P-D-UC01-R01-T01', 'P-D-UC01-R02-T01', 'P-D-UC01-R02', 'P-D-UC01-FL01-T', 'lower']);
    expect(graph.items.get('P-D-UC01|suite/proved')!.words!.title).toBe('2 of 3 proved');
    expect(keys(4, opened([suite, innerKey('P-D-UC01', 'suite', 'lower')])).slice(-2)).toEqual(['P-D-INV01-T', 'P-D-INV02']);
  });
});

describe('LA-V98-R18-T01 Selecting a box lights its path across its row: requirement, fulfilling step, its chain, the tests proving the requirement', () => {
  const { graph } = traced(product());
  const row = graph.rowOf.get('P-D-UC01')!;

  it('walks a step back to its requirements, use case and outcomes, and on to its chain and the tests of what it fulfills', () => {
    const path = rowPath(row, ['P-D-UC01-FL01-S01'])!;
    for (const id of ['P-BO01', 'P-BO02', 'P-D-UC01', 'P-D-UC01-R01', 'P-D-UC01-FL01', 'P-V01', 'P-V01-R01', 'P-D-EP01', 'P-D-UC01-R01-T01', 'P-D-UC01-FL01-T']) expect(path.ids.has(id), id).toBe(true);
    expect([...path.ids].some((k) => k.endsWith('/P-D-CMD01-H'))).toBe(true);
    // Not the other requirement, the other steps or their tests.
    for (const id of ['P-D-UC01-R02', 'P-D-UC01-FL01-S03', 'P-D-UC01-R02-T01']) expect(path.ids.has(id), id).toBe(false);
  });

  it('lights the boxes that show the path, a closed box standing in for what it holds, with a line across each column it crosses', () => {
    const order = orderGraph(graph, null);
    const closed = litBy(graph, layOutTrace(graph, order, NOTHING), 'P-D-UC01-FL01-S01', null);
    expect(closed.rows).toEqual(['P-D-UC01']);
    // Everything stands in by its row's closed cells.
    expect(closed.box).toBe('P-D-UC01|design');
    expect([...closed.keys!].sort()).toEqual(['P-D-UC01|design', 'P-D-UC01|suite', 'P-D-UC01|technical', 'P-D-UC01|use-case', 'outcome/P-BO01', 'outcome/P-BO02']);
    expect(closed.serves).toEqual(new Set(['P-BO01>P-D-UC01', 'P-BO02>P-D-UC01']));
    const open = opened([cellKey('P-D-UC01', 'use-case'), cellKey('P-D-UC01', 'design'), innerKey('P-D-UC01', 'design', 'P-D-UC01-FL01'), cellKey('P-D-UC01', 'technical'), cellKey('P-D-UC01', 'suite')], 'P-D-UC01-FL01-S01');
    const lit = litBy(graph, layOutTrace(graph, order, open), 'P-D-UC01-FL01-S01', null);
    expect(lit.box).toBe('P-D-UC01|design/P-D-UC01-FL01/P-D-UC01-FL01-S01');
    expect(lit.keys!.has('P-D-UC01|use-case/P-D-UC01-R01')).toBe(true);
    expect(lit.keys!.has('P-D-UC01|use-case/P-D-UC01-R02')).toBe(false);
    expect(lit.keys!.has('P-D-UC01|suite/P-D-UC01-R01-T01')).toBe(true);
    expect(lit.lines).toEqual(expect.arrayContaining([
      ['P-D-UC01|use-case/P-D-UC01-R01', 'P-D-UC01|design/P-D-UC01-FL01/P-D-UC01-FL01-S01'],
      ['P-D-UC01|design/P-D-UC01-FL01/P-D-UC01-FL01-S01', 'P-D-UC01|technical/step:P-D-UC01-FL01-S01/P-UI01'],
      ['P-D-UC01|use-case/P-D-UC01-R01', 'P-D-UC01|suite/P-D-UC01-R01-T01'],
    ]));
    // Every line runs left to right.
    for (const [a, b] of lit.lines) expect(graph.items.get(a)!.column).toBeLessThan(graph.items.get(b)!.column);
    // A status box lights nothing and fades nothing.
    expect(litBy(graph, layOutTrace(graph, order, open), 'P-D-UC01', 'P-D-UC01|design').keys).toBeNull();
  });
});

describe('LA-V98-R19-T01 The Trace walk goes down a column, along the row\'s links, in to children and out', () => {
  it('moves Up and Down in a column, Right along a link to the nearest box, In opening a box and Out to its parent', () => {
    const { graph } = traced(product());
    const order = orderGraph(graph, null);
    const open = opened([cellKey('P-D-UC01', 'use-case'), cellKey('P-D-UC01', 'design'), innerKey('P-D-UC01', 'design', 'P-D-UC01-FL01')]);
    const laid = layOutTrace(graph, order, open);
    const r01 = 'P-D-UC01|use-case/P-D-UC01-R01';
    expect(traceTarget(graph, laid, open, 'P-D-UC01|use-case', 'down')).toEqual({ to: r01 });
    expect(traceTarget(graph, laid, open, r01, 'up')).toEqual({ to: 'P-D-UC01|use-case' });
    // Right from a requirement: the step fulfilling it.
    expect(traceTarget(graph, laid, open, r01, 'right')).toEqual({ to: 'P-D-UC01|design/P-D-UC01-FL01/P-D-UC01-FL01-S01' });
    // Right from a closed cell with no link that way: the row's next cell.
    expect(traceTarget(graph, laid, open, 'P-D-UC01|design', 'right')).toEqual({ to: 'P-D-UC01|technical' });
    // Left from a use case: its nearest outcome.
    expect(traceTarget(graph, laid, open, 'P-D-UC01|use-case', 'left')?.to).toMatch(/^outcome\/P-BO0[12]$/);
    // In on a closed box opens it and steps to its first child; Out steps to the parent, and on a cell's own box closes it.
    expect(traceTarget(graph, laid, open, 'P-D-UC01|suite', 'in')).toEqual({ to: 'P-D-UC01|suite/proved', toggle: cellKey('P-D-UC01', 'suite') });
    expect(traceTarget(graph, laid, open, r01, 'out')).toEqual({ to: 'P-D-UC01|use-case' });
    expect(traceTarget(graph, laid, open, 'P-D-UC01|use-case', 'out')).toEqual({ to: 'P-D-UC01|use-case', toggle: cellKey('P-D-UC01', 'use-case') });
    // From no box: the first row's use case.
    expect(traceTarget(graph, laid, open, null, 'down')).toEqual({ to: laid.columns[1][0] });
  });
});

describe('LA-V98-R20-T01 Opening a box moves only its row and the rows below it, which keep their order', () => {
  it('keeps every row above in place and every row below its own height lower, and the order of the rows', () => {
    const { graph } = traced(product());
    const order = orderGraph(graph, null);
    const before = layOutTrace(graph, order, NOTHING);
    const [first, second, third] = order.rows;
    const after = layOutTrace(graph, order, opened([cellKey(second, 'use-case')]));
    expect(after.rows.get(first)).toEqual(before.rows.get(first));
    const grew = after.rows.get(second)!.h - before.rows.get(second)!.h;
    expect(grew).toBeGreaterThan(0);
    expect(after.rows.get(third)!.y - before.rows.get(third)!.y).toBe(grew);
    // Every box of the row above keeps its place; nothing changes width.
    for (const [key, p] of before.places) {
      const item = graph.items.get(key)!;
      if (item.row === first) expect(after.places.get(key), key).toEqual(p);
      if (after.places.has(key)) expect(after.places.get(key)!.w, key).toBe(p.w);
    }
    expect([...after.rows.keys()]).toEqual([...before.rows.keys()]);
  });

  it('keeps every row shown before at its slot on a data change, a new row with no room near at the end of its section, and orders afresh only on Tidy up', () => {
    const { graph } = traced(product());
    const shown = orderGraph(graph, null);
    const data = product();
    addRows(data, 'use_case', { id: 'P-D-UC04', title: 'Lend a set', capability_id: 'P-D-CAP01', goal: 'A member borrows several things.' });
    const next = orderGraph(traced(data).graph, shown);
    expect(next.rows.filter((u) => shown.rows.includes(u))).toEqual(shown.rows);
    expect(next.rows).toContain('P-D-UC04');
    expect(next.rows.indexOf('P-D-UC04')).toBe(next.firstOutside - 1);
    expect(next.outcomes).toEqual(shown.outcomes);
  });
});

describe('LA-V98-R22-T01 The focused row\'s outcomes slide beside it, the others step aside just enough, and go home when no row is focused', () => {
  const PITCH = ITEM_HEIGHT + ITEM_GAP;
  const BAND = ITEM_HEIGHT + ROW_GAP;
  /** Eight closed rows U1..U8, and four outcomes at their own places: O1, O2 and O3 a box apart at the top, O4 lower. */
  const home = (): TraceLaid => {
    const rows = new Map(Array.from({ length: 8 }, (_, i) => [`U${i + 1}`, { y: i * BAND, h: ITEM_HEIGHT }] as const));
    const places = new Map<string, BoxPlace>();
    const columns: string[][] = [[], [], [], [], []];
    for (const [u, band] of rows) { places.set(`${u}|use-case`, { x: 352, y: band.y, w: 264, h: ITEM_HEIGHT }); columns[1].push(`${u}|use-case`); }
    for (const [o, y] of [['O1', 0], ['O2', PITCH], ['O3', 2 * PITCH], ['O4', 400]] as const) { places.set(`outcome/${o}`, { x: 0, y, w: 264, h: ITEM_HEIGHT }); columns[0].push(`outcome/${o}`); }
    return { order: {} as TraceLaid['order'], rows, columns, places, outsideTop: null, width: 1672, height: 8 * BAND - ROW_GAP };
  };
  const serves = [['O1', 'U6'], ['O2', 'U2'], ['O3', 'U2'], ['O4', 'U2'], ['O1', 'U1']] as const;
  const tops = (laid: TraceLaid) => Object.fromEntries(laid.columns[0].map((k) => [k.slice('outcome/'.length), laid.places.get(k)!.y]));
  /** Every box but the outcomes at the place it has at home. */
  const othersStay = (laid: TraceLaid, before: TraceLaid) => {
    for (const [k, p] of before.places) if (!k.startsWith('outcome/')) expect(laid.places.get(k)).toEqual(p);
  };

  it('slides the one outcome a row serves to the row\'s height, and one in the way steps aside just enough', () => {
    const before = home();
    const laid = outcomesBeside(before, serves, 'U6');
    const row = before.rows.get('U6')!.y;
    // O1 level with U6; O4, under it at 400, steps up just clear of it; O2 and O3, far above, stay.
    expect(tops(laid)).toEqual({ O2: PITCH, O3: 2 * PITCH, O4: row - PITCH, O1: row });
    othersStay(laid, before);
    expect(before.places.get('outcome/O1')!.y).toBe(0);
  });

  it('stacks several outcomes centered on the row, in their column\'s order, never above the top; one covered steps down', () => {
    const before = home();
    const laid = outcomesBeside(before, serves, 'U2');
    const row = before.rows.get('U2')!.y;
    const top = row + ITEM_HEIGHT / 2 - (3 * PITCH - ITEM_GAP) / 2;
    expect(tops(laid)).toEqual({ O2: top, O3: top + PITCH, O4: top + 2 * PITCH, O1: top + 3 * PITCH });
    // The column's boxes top to bottom, as drawn and walked.
    expect(laid.columns[0]).toEqual(['outcome/O2', 'outcome/O3', 'outcome/O4', 'outcome/O1']);
    othersStay(laid, before);
    // Near the top the stack starts at the top.
    const first = outcomesBeside(before, [['O2', 'U1'], ['O3', 'U1'], ['O4', 'U1']], 'U1');
    expect(Math.min(...Object.values(tops(first)))).toBe(0);
  });

  it('moves nothing for a row serving no outcome, follows the focus from row to row, and returns every outcome home with no row', () => {
    const before = home();
    expect(outcomesBeside(before, serves, 'U8')).toBe(before);
    expect(outcomesBeside(before, serves, null)).toBe(before);
    // Walking from U6 to U2: O1, which U2 does not serve, leaves U6 for where U2's stack puts it; nothing else moves.
    const at6 = outcomesBeside(before, serves, 'U6');
    const at2 = outcomesBeside(before, serves, 'U2');
    expect(tops(at6).O1).toBe(before.rows.get('U6')!.y);
    expect(tops(at2).O2).toBeLessThan(before.rows.get('U2')!.y);
    othersStay(at2, before);
    // No row focused: each outcome at its own place, as Tidy up last left it.
    expect(tops(outcomesBeside(before, serves, null))).toEqual({ O1: 0, O2: PITCH, O3: 2 * PITCH, O4: 400 });
  });
});
