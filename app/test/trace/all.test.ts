import { describe, expect, it } from 'vitest';
import { addRows } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';
import { allGraph, gapKey, gapsPath, keptBy, pathOf } from '../../src/trace/all';
import { allTarget, allWords } from '../../src/trace/all-walk';
import { traced } from './traces';

// The All-at-once view's graph (app/src/trace/all.ts): the product's whole trace in five columns, each record once,
// its links read from the Trace read model (list-traces with its Serves links), its gaps, what no outcome reaches, each
// box's path and the walk over it.

/** The model product with an outcome its capability serves, and a second use case whose step invokes the first's command. */
function data() {
  const d = modelWorkspace();
  addRows(d, 'business_outcome', { id: 'P-BO01', title: 'More things lent', product_id: 'P', statement: 'Members borrow more.', measure: 'Loans a month', target: 'Up a tenth' });
  addRows(d, 'serves', { source_id: 'P-D-CAP01', target_id: 'P-BO01' });
  addRows(d, 'use_case', { id: 'P-D-UC02', title: 'Renew a loan', capability_id: 'P-D-CAP01', goal: 'A member keeps a thing longer.' });
  addRows(d, 'flow', { id: 'P-D-UC02-FL01', title: 'Renew a loan in the web app', use_case_id: 'P-D-UC02', interface_id: 'P-IF01' });
  addRows(d, 'flow_step', { id: 'P-D-UC02-FL01-S01', title: 'Librarian renews the loan', flow_id: 'P-D-UC02-FL01', path: 'main', position: 1 });
  addRows(d, 'invokes', { source_id: 'P-D-UC02-FL01-S01', target_id: 'P-D-CMD01' });
  return d;
}
const graphOf = (d = data()) => { const { index, traces } = traced(d); return { index, graph: allGraph(index, traces, index.product) }; };
const linksOf = (g: ReturnType<typeof graphOf>['graph']) => g.links.map((l) => `${l.kind}:${l.from}>${l.to}`);

describe('the All-at-once graph', () => {
  it('LA-V98-R02-T03 holds five columns, outcomes, use cases, every obligation kind, what builds them and their tests, each record once, gaps after the records', () => {
    const { graph } = graphOf();
    expect(graph.columns[0]).toEqual(['P-BO01']);
    expect(graph.columns[1]).toEqual(['P-D-UC01', 'P-D-UC02']);
    // Every obligation kind: UC, view and API requirements, invariants, specifications, policies, domain services, constraints.
    expect(graph.columns[2]).toEqual(expect.arrayContaining(['P-D-UC01-R01', 'P-V01-R01', 'P-D-EP01-R01', 'P-D-INV01', 'P-D-SP01', 'P-D-PO01', 'P-D-DS01', 'P-VO01-C01']));
    expect(graph.columns[3]).toEqual(expect.arrayContaining(['P-D-CMD01-H', 'P-D-INV01-RL', 'P-UI01', 'P-VO01-VT']));
    expect(graph.columns[4]).toEqual(expect.arrayContaining(['P-D-UC01-R01-T01', 'P-D-INV01-T']));
    // Each record once, in one column.
    const all = graph.columns.flat();
    expect(new Set(all).size).toBe(all.length);
    // Gaps come after the records of their column.
    const proved = graph.columns[4];
    expect(proved.findIndex((k) => k.startsWith('gap:'))).toBeGreaterThan(proved.findLastIndex((k) => !k.startsWith('gap:')));
    expect(graph.counts.obligations).toBe(graph.columns[2].length);
  });

  it('LA-V98-R03-T03 draws a line for each link the Trace read gives: serves, reaches, built by and proved by', () => {
    const { graph } = graphOf();
    const links = linksOf(graph);
    expect(links).toEqual(expect.arrayContaining([
      'serves:P-BO01>P-D-UC01', 'serves:P-BO01>P-D-UC02',
      'reaches:P-D-UC01>P-D-UC01-R01', 'reaches:P-D-UC01>P-D-INV01', 'reaches:P-D-UC01>P-V01-R01',
      'built:P-D-UC01-R01>P-D-CMD01-H', 'built:P-D-INV01>P-D-INV01-RL',
      'proved:P-D-UC01-R01>P-D-UC01-R01-T01', 'proved:P-D-INV01>P-D-INV01-T',
    ]));
    // An invariant both use cases reach through the one command: one box, a line from each.
    expect(links.filter((l) => l.endsWith('>P-D-INV01') && l.startsWith('reaches:'))).toEqual(['reaches:P-D-UC01>P-D-INV01', 'reaches:P-D-UC02>P-D-INV01']);
    // Every line runs to a column on its right.
    for (const l of graph.links) expect(graph.nodes.get(l.to)!.column).toBeGreaterThan(graph.nodes.get(l.from)!.column);
  });

  it('LA-V98-R04-T03 a gap is a dashed box in the column of what is missing, linked from its obligation, and Gaps only keeps each gapped obligation\'s path', () => {
    const { graph } = graphOf();
    const gap = graph.nodes.get(gapKey('P-D-INV02', 'tests'))!;
    expect(gap).toMatchObject({ role: 'gap', column: 4, gap: { obligation: 'P-D-INV02', missing: 'tests' } });
    expect(linksOf(graph)).toContain(`proved:P-D-INV02>${gapKey('P-D-INV02', 'tests')}`);
    expect([...graph.gapped].sort()).toEqual(['P-D-INV02', 'P-D-UC01-R02']);
    const kept = gapsPath(graph);
    for (const k of ['P-D-INV02', 'P-D-UC01-R02', gap.key, 'P-D-UC01', 'P-BO01']) expect(kept.keys.has(k), k).toBe(true);
    // A complete obligation and what only it holds are off Gaps only's paths.
    for (const k of ['P-D-UC01-R01', 'P-D-UC01-R01-T01', 'P-D-CMD01-H']) expect(kept.keys.has(k), k).toBe(false);
    expect(keptBy(graph, null, true)).toBe(kept);
  });

  it('LA-V98-R07-T03 what no outcome reaches by the links sits under no outcome', () => {
    const { graph } = graphOf();
    // A policy no use case reaches serves no outcome; everything an outcome reaches is under it.
    expect(graph.nodes.get('P-D-PO01')!.under).toBe(false);
    for (const k of ['P-BO01', 'P-D-UC01', 'P-D-INV01', 'P-D-INV01-T']) expect(graph.nodes.get(k)!.under, k).toBe(true);
    // With no outcome served, nothing is under one but the outcome.
    const plain = modelWorkspace();
    addRows(plain, 'business_outcome', { id: 'P-BO01', title: 'More things lent', product_id: 'P', statement: 'Members borrow more.', measure: 'Loans a month', target: 'Up a tenth' });
    const { graph: none } = graphOf(plain);
    expect([...none.nodes.values()].filter((n) => n.under).map((n) => n.key)).toEqual(['P-BO01']);
    expect(none.counts.outside).toBe(none.nodes.size - 1 - [...none.nodes.values()].filter((n) => n.role === 'gap').length);
  });

  it('LA-V98-R08-T02 a box\'s path runs back to its outcomes and on to its tests, both ways from the box itself only', () => {
    const { graph } = graphOf();
    // A use case: its outcome, its obligations and what builds and proves them; not the other use case those obligations have.
    const uc = pathOf(graph, 'P-D-UC02');
    for (const k of ['P-BO01', 'P-D-INV01', 'P-D-INV01-RL', 'P-D-INV01-T']) expect(uc.keys.has(k), k).toBe(true);
    expect(uc.keys.has('P-D-UC01')).toBe(false);
    expect(uc.keys.has('P-D-UC01-R01')).toBe(false);
    // A test: back to its obligation, the use cases reaching it and their outcome; nothing to its right.
    const test = pathOf(graph, 'P-D-INV01-T');
    expect([...test.keys].sort()).toEqual(['P-BO01', 'P-D-INV01', 'P-D-INV01-T', 'P-D-UC01', 'P-D-UC02']);
    // The lines lit are the path's own: not the obligation's line to its rule, which is off a test's path.
    const lit = [...test.links].map((l) => `${graph.links[l].from}>${graph.links[l].to}`).sort();
    expect(lit).toEqual(['P-BO01>P-D-UC01', 'P-BO01>P-D-UC02', 'P-D-INV01>P-D-INV01-T', 'P-D-UC01>P-D-INV01', 'P-D-UC02>P-D-INV01']);
    // A focus with Gaps only keeps the part of its path Gaps only keeps: the use cases and outcome that lead to a gap, not the complete invariant and its test.
    expect([...keptBy(graph, 'P-D-INV01-T', true)!.keys].sort()).toEqual(['P-BO01', 'P-D-UC01', 'P-D-UC02']);
  });

  it('LA-V61-R49-T05 LA-V98-R09-T01 the walk goes up and down a column and along the links left and right; from no box, to the first outcome', () => {
    const { index, graph } = graphOf();
    const column = graph.columns[2];
    const at = 'P-D-UC01-R01';
    const i = column.indexOf(at);
    expect(allTarget(graph, null, at, 'up')).toBe(column[i - 1]);
    expect(allTarget(graph, null, at, 'down')).toBe(column[i + 1]);
    expect(allTarget(graph, null, at, 'left')).toBe('P-D-UC01');
    expect(allTarget(graph, null, at, 'out')).toBe('P-D-UC01');
    // Right goes to the nearest column that way: what builds it, before its test.
    expect(allTarget(graph, null, at, 'right')).toBe('P-D-CMD01-H');
    expect(allTarget(graph, null, at, 'in')).toBe('P-D-CMD01-H');
    expect(allTarget(graph, null, 'P-D-UC01-R01-T01', 'right')).toBeNull();
    expect(allTarget(graph, null, 'P-D-UC01-R01-T01', 'left')).toBe(at);
    // Onto a gap, said in words; from no box (the product), the first outcome.
    expect(allTarget(graph, null, 'P-D-INV02', 'right')).toBe(gapKey('P-D-INV02', 'tests'));
    expect(allWords(index, graph, gapKey('P-D-INV02', 'tests'))).toBe(`Not proved, a gap of ${index.byId.get('P-D-INV02')!.title}`);
    expect(allTarget(graph, null, null, 'down')).toBe('P-BO01');
  });
});
