import { describe, expect, it } from 'vitest';
import { addRows, indexOf } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';
import { gap } from '../fixtures/workspace';
import { untracedUnder } from '../../src/trace/chain';
import { allBoxes, BOX_H, tracePicture, visibleIn, type LaneColumn, type TracePicture } from '../../src/trace/lanes';

// The Trace stage's picture (app/src/trace/lanes.ts): one obligation's chain with its why columns, or
// a why tree and a lane per obligation, gaps as dashed boxes, the Untraced lane last, laid out once in
// map units; and what a rectangle of it holds.

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

const columnsOf = (p: TracePicture) => p.columns.map((c) => c.column);
const boxesOf = (p: TracePicture, id: string) => allBoxes(p).filter((b) => b.id === id);
const laneOf = (p: TracePicture, obligation: string | null) => p.lanes.find((l) => l.obligation === obligation)!;
const inColumn = (p: TracePicture, obligation: string | null, column: LaneColumn) => laneOf(p, obligation).boxes.filter((b) => b.column === column).map((b) => b.id);
const arrows = (p: TracePicture) => p.lanes.flatMap((l) => l.lines).map((l) => `${l.source} > ${l.target}`);

describe('the Trace stage\'s picture', () => {
  it('LA-V98-R03-T03 A product\'s why tree starts at its outcomes, a capability serving several repeated under each; a domain\'s at its capabilities, their outcomes as notes', () => {
    const index = withOutcomes();
    // The product: each outcome a root, the capability repeated under each with its use case and lanes, marked "also serves" the other.
    const product = tracePicture(index, 'P');
    expect(columnsOf(product).slice(0, 4)).toEqual(['outcome', 'capability', 'parent', 'obligation']);
    const roots = product.tree.boxes.filter((b) => b.column === 'outcome').map((b) => b.id);
    expect(roots).toEqual(['P-BO01', 'P-BO02']);
    const caps = boxesOf(product, 'P-D-CAP01');
    expect(caps).toHaveLength(2);
    expect(caps.map((c) => c.notes)).toEqual([['Also serves Fewer lost things'], ['Also serves More things lent']]);
    expect(product.lanes.filter((l) => l.obligation === 'P-D-UC01-R01')).toHaveLength(2);
    // Each parent is as tall as the lanes beneath it, and joined to each child by a level line.
    for (const cap of caps) {
      const under = product.lanes.filter((l) => l.top >= cap.y && l.top + l.height <= cap.y + cap.h + 1e-9);
      expect(under.map((l) => l.obligation)).toEqual(['P-D-UC01-R01', 'P-D-UC01-R02']);
      expect(cap.y).toBe(under[0].top);
    }
    expect(product.tree.lines.some((l) => l.source === 'P-BO01' && l.target === 'P-D-CAP01' && l.points[0].y === l.points[1].y)).toBe(true);

    // The domain: the capability is a root, both outcomes its note; there is no outcome column.
    const domain = tracePicture(index, 'P-D');
    expect(columnsOf(domain)).not.toContain('outcome');
    expect(boxesOf(domain, 'P-D-CAP01').map((b) => b.notes)).toEqual([['Serves More things lent, Fewer lost things']]);
    // An invariant hangs from its aggregate, a specification under its domain from no tree, after it.
    expect(domain.tree.boxes.find((b) => b.id === 'P-D-A3')?.column).toBe('parent');
    const order = domain.lanes.map((l) => l.obligation);
    expect(order.indexOf('P-D-SP01')).toBeGreaterThan(order.indexOf('P-D-INV01'));

    // The use case: the tree starts at it.
    const useCase = tracePicture(index, 'P-D-UC01');
    expect(useCase.tree.boxes.map((b) => b.id)).toEqual(['P-D-UC01']);
    expect(columnsOf(useCase)[0]).toBe('parent');

    // One obligation: its chain, both outcomes stacked in their column, each leading to the capability.
    const chain = tracePicture(index, 'P-D-UC01-R01');
    expect(chain.shape).toBe('chain');
    expect(chain.lanes).toHaveLength(1);
    expect(inColumn(chain, 'P-D-UC01-R01', 'outcome')).toEqual(['P-BO01', 'P-BO02']);
    expect(arrows(chain)).toEqual(expect.arrayContaining(['P-BO01 > P-D-CAP01', 'P-BO02 > P-D-CAP01', 'P-D-CAP01 > P-D-UC01', 'P-D-UC01 > P-D-UC01-R01']));
  });

  it('LA-V98-R04-T03 A lane\'s gap is a dashed box in its column, and Gaps only keeps only the lanes with one', () => {
    // A specification nothing implements or proves, as coverage reports it: a gap box in the build and tests columns, none for its design.
    const data = modelWorkspace();
    data.coverage[0].gaps.push(gap('P-D-SP01', 'specification', 'built'), gap('P-D-SP01', 'specification', 'proved'));
    const index = indexOf(data);
    const domain = tracePicture(index, 'P-D');
    const gaps = laneOf(domain, 'P-D-SP01').boxes.filter((b) => b.role === 'gap');
    expect(gaps.map((b) => [b.column, b.words?.title])).toEqual([['build', 'Not built'], ['tests', 'Not proved']]);
    // A traced requirement has none.
    expect(laneOf(domain, 'P-D-UC01-R01').boxes.some((b) => b.role === 'gap')).toBe(false);
    expect(domain.counts.withGaps).toBe(domain.lanes.filter((l) => l.obligation && l.gaps.length > 0).length);
    // Gaps only: only the lanes with a gap, and the Untraced lane.
    const gapsOnly = tracePicture(index, 'P-D', { gapsOnly: true });
    expect(gapsOnly.lanes.filter((l) => l.obligation).every((l) => l.gaps.length > 0)).toBe(true);
    expect(gapsOnly.lanes.map((l) => l.obligation)).not.toContain('P-D-UC01-R01');
    expect(gapsOnly.lanes.at(-1)!.obligation).toBeNull();
  });

  it('LA-V98-R07-T03 The Untraced lane comes last, its head then each record no chain reaches in its column', () => {
    const index = indexOf(modelWorkspace());
    const domain = tracePicture(index, 'P-D');
    const untraced = domain.lanes.at(-1)!;
    expect(untraced.obligation).toBeNull();
    const head = untraced.boxes.find((b) => b.column === 'obligation')!;
    const ids = untracedUnder(index, 'P-D').flatMap((g) => g.ids);
    expect(head.role).toBe('untraced');
    expect(head.words?.meta).toBe(`${ids.length} records no chain reaches`);
    expect(inColumn(domain, null, 'step')).toContain('P-D-UC01-FL01-S02');
    expect(inColumn(domain, null, 'design')).toContain('P-D-CMD02');
    expect(untraced.boxes.length).toBe(ids.length + 1);
    // Every box of the lane starts at its top.
    expect(Math.min(...untraced.boxes.map((b) => b.y))).toBe(untraced.top);
    // Where everything is reached there is none.
    expect(tracePicture(index, 'P-D-UC01').lanes.some((l) => l.obligation === null)).toBe(false);
  });

  it('LA-V98-R08-T02 A held record is drawn as the focus in each lane that holds it; an untraced one in the Untraced lane, in the frame', () => {
    const index = indexOf(modelWorkspace());
    // A command a chain holds: only its obligation's lane, the command in the design column.
    const held = tracePicture(index, 'P-D-CMD01');
    expect(held.shape).toBe('rows');
    expect(held.lanes.map((l) => l.obligation)).toEqual(['P-D-UC01-R01']);
    expect(inColumn(held, 'P-D-UC01-R01', 'design')).toContain('P-D-CMD01');
    // A command nothing traces to: its aggregate's lanes, and the Untraced lane holding it.
    const untraced = tracePicture(index, 'P-D-CMD02');
    expect(untraced).toMatchObject({ shape: 'context', untraced: true, scope: 'P-D-A3' });
    expect(untraced.lanes.map((l) => l.obligation)).toEqual(['P-D-INV01', 'P-D-INV02', null]);
    expect(inColumn(untraced, null, 'design')).toContain('P-D-CMD02');
    // An entity: its aggregate's lanes, and no untraced state.
    const entity = tracePicture(index, 'P-D-EN03');
    expect(entity).toMatchObject({ shape: 'context', untraced: false });
    expect(entity.lanes.filter((l) => l.obligation).map((l) => l.obligation)).toEqual(['P-D-INV01', 'P-D-INV02']);
  });

  it('LA-V98-R06-T03 Only what is in view is drawn, at most 260 boxes; far out the boxes are bars', () => {
    const data = modelWorkspace();
    addRows(data, 'uc_requirement', ...Array.from({ length: 400 }, (_, n) => ({ id: `P-D-UC01-R${String(n + 10).padStart(3, '0')}`, title: `Rule ${n + 10}`, use_case_id: 'P-D-UC01', statement: `Rule ${n + 10} MUST hold.` })));
    const p = tracePicture(indexOf(data), 'P-D-UC01');
    expect(p.lanes.length).toBeGreaterThan(400);
    // A rectangle holds only the boxes and arrows that meet it: the use case's tall box and the lanes it crosses.
    const lane = p.lanes[200];
    const rect = { x0: -1e6, x1: 1e6, y0: lane.top, y1: lane.top + lane.height };
    const seen = visibleIn(p, rect);
    const lanes = new Set(seen.boxes.filter((b) => b.lane >= 0).map((b) => b.lane));
    expect([...lanes].every((i) => Math.abs(i - 200) <= 1)).toBe(true);
    expect(seen.boxes.filter((b) => b.lane < 0).map((b) => b.id)).toEqual(['P-D-UC01']);
    for (const b of seen.boxes) expect(b.y + b.h >= rect.y0 && b.y <= rect.y1).toBe(true);
    // A box is BOX_H tall, a tree box as tall as its lanes.
    expect(p.tree.boxes[0].h).toBe(p.height);
    expect(p.lanes[0].boxes.every((b) => b.h === BOX_H)).toBe(true);
  });
});
