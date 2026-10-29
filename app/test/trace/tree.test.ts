import { describe, expect, it } from 'vitest';
import { addRows, indexOf } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';
import { gap } from '../fixtures/workspace';
import { repoData } from '../fixtures/repo';
import { spaceIndex } from '../../src/specs/data';
import { obligationsUnder } from '../../src/trace/chain';
import { focusKey, keptFor, traceFade, traceMap, type TraceMap } from '../../src/trace/tree';
import { UNTRACED } from '../../src/trace/top';
import { drawnFor, frameMap, frameOnMap, MAX_DRAWN, viewRect } from '../../src/graph/camera';
import { treeText } from '../../src/graph/map';

// The Trace stage's tree (app/src/trace/tree.ts): one tree per product laid out by the Graph's Tree layout, below its
// top the record tree down to each obligation and its chain to its right by the chain's links, gaps as dashed boxes, the
// Untraced mark last; where focusing each kind of record stands and what it keeps at full strength; what Gaps only fades.

/** The model product with two business outcomes its one capability serves. */
function withOutcomes() {
  const data = modelWorkspace();
  addRows(data, 'business_outcome',
    { id: 'P-BO01', title: 'More things lent', product_id: 'P', statement: 'Members borrow more.', measure: 'Loans a month', target: 'Up a tenth' },
    { id: 'P-BO02', title: 'Fewer lost things', product_id: 'P', statement: 'Fewer things go missing.', measure: 'Things lost a year', target: 'Down a half' });
  addRows(data, 'serves', { source_id: 'P-D-CAP01', target_id: 'P-BO01' }, { source_id: 'P-D-CAP01', target_id: 'P-BO02' });
  return indexOf(data);
}

const FADE = { focusFade: 0.25 };
const childrenOf = (m: TraceMap, key: string) => m.map.nodes.get(key)!.children;
const idsUnder = (m: TraceMap, key: string) => childrenOf(m, key).map((k) => m.nodes.get(k)!.id);
/** Every box's place, as a snapshot. */
const positions = (m: TraceMap) => JSON.stringify([...m.map.nodes.values()].map((n) => [n.id, n.x, n.y, n.w, n.h, n.text]));

describe('the Trace stage\'s tree', () => {
  it('LA-V98-R03-T03 The tree\'s children rule: outcomes with links, a domain\'s parents side by side, the record tree to each obligation and its chain to the right, a shared record repeated with its count', () => {
    const index = withOutcomes();
    const map = traceMap(index, 'P');
    // The product: its outcomes, its domains, its own obligations' parents, the Untraced mark last.
    expect(childrenOf(map, 'P')).toEqual(['P-BO01', 'P-BO02', 'P-D', 'P-E', 'P-VO01', UNTRACED]);
    // An outcome: a link to the capability serving it, a box of its own that opens the capability.
    const link = map.nodes.get(childrenOf(map, 'P-BO01')[0])!;
    expect([link.role, link.opens, link.words?.title]).toEqual(['link', 'P-D-CAP01', index.byId.get('P-D-CAP01')!.title]);
    // The domain: its capability (noting what it serves), aggregates, view, then the obligations right under it, side by side.
    expect(childrenOf(map, 'P-D')).toEqual(['P-D-CAP01', 'P-D-A1', 'P-D-A2', 'P-D-A3', 'P-V01', 'P-D-SP01', 'P-D-DS01']);
    expect(map.nodes.get('P-D-CAP01')!.note).toBe('serves P-BO01, P-BO02');
    // The record tree down to each obligation: the capability, its use case, its requirements.
    expect(childrenOf(map, 'P-D-CAP01')).toEqual(['P-D-UC01']);
    expect(childrenOf(map, 'P-D-UC01')).toEqual(['P-D-UC01-R01', 'P-D-UC01-R02']);
    // An obligation's chain to its right by its links: the requirement to its flow and its test, the flow to its step, the
    // step to its command and view; each an arrow (a link), each record once in the chain, keyed by the chain.
    expect(idsUnder(map, 'P-D-UC01-R01')).toEqual(['P-D-UC01-FL01', 'P-D-UC01-R01-T01']);
    expect(idsUnder(map, 'P-D-UC01-R01|P-D-UC01-FL01')).toEqual(['P-D-UC01-FL01-S01']);
    expect(idsUnder(map, 'P-D-UC01-R01|P-D-UC01-FL01-S01')).toEqual(['P-D-CMD01', 'P-V01']);
    expect(map.links.has('P-D-UC01-R01|P-D-UC01-FL01')).toBe(true);
    expect(map.links.has('P-D-UC01')).toBe(false);
    expect(map.nodes.get('P-D-UC01-R01|file:test/lend.test.ts')).toMatchObject({ role: 'file', opens: 'P-D-UC01-R01-T01', chain: 'P-D-UC01-R01' });
    // A record several places hold is drawn in each, every copy noting how many: a command four chains hold, the view as
    // a parent and in a chain.
    const command = map.copies.get('P-D-CMD01')!;
    expect(command).toHaveLength(4);
    for (const k of command) expect(map.nodes.get(k)!.note).toBe('in 4 places');
    expect(map.copies.get('P-V01')).toEqual(['P-V01', 'P-D-UC01-R01|P-V01']);
    expect(map.nodes.get('P-D-UC01-R01|P-V01')!.note).toBe('in 2 places');
    expect(map.nodes.get('P-D-UC01-R01')!.note).toBeUndefined();
    // Every obligation of the product is drawn, as itself.
    for (const o of obligationsUnder(index, 'P')) expect(map.nodes.get(o)?.chain, o).toBe(o);
    expect(map.counts.obligations).toBe(obligationsUnder(index, 'P').length);
    // Sized by the Graph's Tree layout: siblings share one size and text scale, at most their width's share; a parent with
    // fewer children holds larger ones.
    const domain = childrenOf(map, 'P-D').map((k) => map.map.nodes.get(k)!);
    expect(new Set(domain.map((n) => `${n.w} ${n.h} ${n.text}`)).size).toBe(1);
    expect(domain[0].text).toBeLessThanOrEqual(treeText(domain[0].w));
    expect(map.map.nodes.get('P-D-UC01')!.h).toBeGreaterThan(map.map.nodes.get('P-D-UC01-R01')!.h);
  });

  it('LA-V98-R04-T03 A gap is a dashed box beside its obligation, and Gaps only fades the complete branches', () => {
    // A specification nothing implements or proves, as coverage reports it: gap boxes before its chain.
    const data = modelWorkspace();
    data.coverage[0].gaps.push(gap('P-D-SP01', 'specification', 'built'), gap('P-D-SP01', 'specification', 'proved'));
    const index = indexOf(data);
    const map = traceMap(index, 'P');
    const gaps = childrenOf(map, 'P-D-SP01').map((k) => map.nodes.get(k)!).filter((n) => n.role === 'gap');
    expect(gaps.map((n) => n.words?.title)).toEqual(['Not built', 'Not proved']);
    expect(childrenOf(map, 'P-D-SP01').slice(0, 2)).toEqual(gaps.map((n) => n.key));
    // A traced requirement has none.
    expect(childrenOf(map, 'P-D-UC01-R01').some((k) => map.nodes.get(k)!.role === 'gap')).toBe(false);
    expect(map.counts.withGaps).toBe(map.gapped.size);
    // Gaps only: every box stays; the specification, its chain, the branches above it and the Untraced mark at full
    // strength, a complete requirement and its chain faded.
    const fade = traceFade(map, null, true, FADE);
    for (const k of ['P-D-SP01', 'P-D-SP01|P-D-CMD01', gaps[0].key, 'P-D', 'P', UNTRACED, `${UNTRACED}|P-D-CMD02`]) expect(fade(k), k).toBe(1);
    for (const k of ['P-D-UC01-R01', 'P-D-UC01-R01|P-D-UC01-FL01', 'P-D-A1']) expect(fade(k), k).toBe(FADE.focusFade);
  });

  it('LA-V98-R07-T03 The Untraced mark comes last under the product, holding each record no chain reaches', () => {
    const index = withOutcomes();
    const map = traceMap(index, 'P');
    const mark = map.nodes.get(UNTRACED)!;
    expect(childrenOf(map, 'P').at(-1)).toBe(UNTRACED);
    expect(mark.role).toBe('untraced');
    expect(mark.words?.meta).toBe('5 records no chain reaches');
    // Each as itself, in the schema's kind order: the commands, the query, then the flow step.
    expect(idsUnder(map, UNTRACED)).toEqual(['P-D-CMD02', 'P-D-CMD03', 'P-E-CMD01', 'P-D-QRY01', 'P-D-UC01-FL01-S02']);
    expect(map.nodes.get(`${UNTRACED}|P-D-CMD02`)!.role).toBe('record');
    // Where everything is reached there is no mark.
    const data = modelWorkspace();
    for (const c of data.coverage) c.gaps = c.gaps.filter((g) => g.missing !== 'record-untraced');
    expect(traceMap(indexOf(data), 'P').nodes.has(UNTRACED)).toBe(false);
  });

  it('LA-V98-R08-T02 Focusing stands each kind of record on its box and keeps what is under it at full strength', () => {
    const index = withOutcomes();
    const map = traceMap(index, 'P');
    const fadeOf = (focus: string, at: string | null = null) => { const key = focusKey(map, index, focus, at); return { key, fade: traceFade(map, keptFor(map, focus, key), false, FADE) }; };
    // The product: its own box, nothing faded.
    const product = fadeOf('P');
    expect(product.key).toBe('P');
    expect(product.fade('P-D-UC01-R01|P-D-UC01-FL01')).toBe(1);
    // A use case: its box, what hangs from it kept, the rest faded.
    const uc = fadeOf('P-D-UC01');
    expect(uc.key).toBe('P-D-UC01');
    expect([uc.fade('P-D-UC01-R02|P-D-UC01-FL01-S03'), uc.fade('P-D-UC01'), uc.fade('P-D-CAP01'), uc.fade('P-D-A1')]).toEqual([1, 1, FADE.focusFade, FADE.focusFade]);
    // A command several chains hold: the copy arrived in, else its first; every copy kept.
    const copies = map.copies.get('P-D-CMD01')!;
    expect(copies.length).toBeGreaterThan(2);
    expect(fadeOf('P-D-CMD01').key).toBe(copies[0]);
    const arrived = fadeOf('P-D-CMD01', copies[2]);
    expect(arrived.key).toBe(copies[2]);
    for (const k of copies) expect(arrived.fade(k), k).toBe(1);
    expect(arrived.fade('P-D-UC01-R01|P-D-CMD01-H')).toBe(1);
    expect(arrived.fade('P-D-UC01-R01')).toBe(FADE.focusFade);
    // An untraced command: its box under the Untraced mark.
    expect(fadeOf('P-D-CMD02').key).toBe(`${UNTRACED}|P-D-CMD02`);
    // An entity: its aggregate. A stage: its domain. A record of another product's: the product.
    expect(fadeOf('P-D-EN03').key).toBe('P-D-A3');
    expect(fadeOf('P-D/domain-model').key).toBe('P-D');
    expect(fadeOf('NOPE').key).toBe('P');
  });

  it('LA-PAT-APP-UX-R19-T01 The Trace tree is laid out once: focusing two records and toggling Gaps only moves no box', () => {
    const index = withOutcomes();
    const map = traceMap(index, 'P');
    const before = positions(map);
    for (const focus of ['P-D-UC01-R01', 'P-D-CMD01']) {
      const key = focusKey(map, index, focus);
      traceFade(map, keptFor(map, focus, key), true, FADE)(key);
      traceFade(map, keptFor(map, focus, key), false, FADE)(key);
    }
    expect(positions(map)).toBe(before);
    // The same tree for the same product and data; a new tree, laid out once, for new data.
    expect(traceMap(index, 'P')).toBe(map);
    const again = traceMap(withOutcomes(), 'P');
    expect(again).not.toBe(map);
    expect(positions(again)).toBe(before);
  });

  it('LA-V98-R06-T03 Only what is in view is drawn, at most 260 boxes, the runs too small to see as bars', async () => {
    const index = spaceIndex(indexOf(await repoData({ chains: true })), 'LA');
    const map = traceMap(index, 'LA');
    expect(map.map.nodes.size).toBeGreaterThan(MAX_DRAWN * 10);
    // Far out, the whole tree: at most the budget as boxes, the rest as bars.
    const far = drawnFor(map.map, frameMap(map.map, 1440, 900), 1440, 900);
    expect(far.boxes.length).toBeLessThanOrEqual(MAX_DRAWN);
    expect(far.bars.length).toBeGreaterThan(0);
    // Framed on a requirement: only boxes that meet the view, and the requirement among them.
    const requirement = obligationsUnder(index, 'LA').find((o) => index.byId.get(o)!.kind === 'uc_requirement')!;
    const v = frameOnMap(map.map, requirement, 1, 1440, 900, 1e9);
    const r = viewRect(v, 1440, 900);
    const near = drawnFor(map.map, v, 1440, 900, [requirement]);
    expect(near.boxes.map((b) => b.id)).toContain(requirement);
    for (const b of near.boxes) { const n = map.map.nodes.get(b.id)!; expect(n.x + n.w >= r.x0 && n.x <= r.x1 && n.y + n.h >= r.y0 && n.y <= r.y1, b.id).toBe(true); }
  }, 120_000);
});
