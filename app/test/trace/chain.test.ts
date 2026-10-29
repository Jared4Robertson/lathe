import { describe, expect, it } from 'vitest';
import { servedByEngine } from '../fixtures/engine';
import { addRows, indexOf } from '../fixtures/load';
import { patternWorkspace } from '../fixtures/patterns';
import { gap } from '../fixtures/workspace';
import { holdersOf, obligationsUnder, traceChain, traceMatrix, traceShape, untracedUnder } from '../../src/trace/chain';
import { isObligation } from '../../src/trace/offer';
import { testIndex, testWorkspace } from '../graph/workspace';

// The Trace view's logic (app/src/trace/chain.ts): an obligation's chain, and the matrix of every
// obligation under a record or group, read from the engine's chains and coverage.

/** The model fixture's index, with the code files its records name, as the engine sees them. */
const FILES = { 'src/loans.ts': '// P-D-CMD01-H\n', 'test/lend.test.ts': '// P-D-UC01-R01-T01\n', 'src/name.ts': '// P-VO01-VT\n', 'test/name.test.ts': '// P-VO01-C01-T\n' };
const files = (id: string, index: ReturnType<typeof testIndex>) => traceChain(index, id)!.files.map((f) => f.path);

describe('an obligation\'s chain', () => {
  const index = testIndex();

  it('LA-V98-R02-T01 An obligation\'s chain holds what designs, builds and proves it, and the files they name, as the engine works it out', async () => {
    const served = indexOf(await servedByEngine(testWorkspace(), FILES));
    // A UC requirement: the step that fulfills it, its flow, where it happens and what it invokes; that command's
    // handler and the UI component rendering that view, which build it as coverage counts; its test.
    const req = traceChain(served, 'P-D-UC01-R01')!;
    expect(req.design).toEqual(expect.arrayContaining(['P-D-UC01-FL01', 'P-D-UC01-FL01-S01', 'P-V01', 'P-D-CMD01']));
    expect(req.design).not.toContain('P-D-UC01-FL01-S02');
    expect(req.build).toEqual(['P-D-CMD01-H', 'P-UI01']);
    expect(req.tests).toEqual(['P-D-UC01-R01-T01']);
    expect(files('P-D-UC01-R01', served)).toEqual(['src/loans.ts', 'src/ui/LoanTable.tsx', 'test/lend.test.ts']);
    expect(req.files.find((f) => f.path === 'src/loans.ts')!.namedBy).toEqual(['P-D-CMD01-H']);
    // Its links, each from the record nearer the obligation to the one it leads to: what the Trace stage draws its arrows from.
    expect(req.links.map(([a, b]) => `${a} > ${b}`).sort()).toEqual([
      'P-D-CMD01 > P-D-CMD01-H', 'P-D-CMD01-H > file:src/loans.ts', 'P-D-UC01-FL01 > P-D-UC01-FL01-S01', 'P-D-UC01-FL01-S01 > P-D-CMD01',
      'P-D-UC01-FL01-S01 > P-V01', 'P-D-UC01-R01 > P-D-UC01-FL01', 'P-D-UC01-R01 > P-D-UC01-R01-T01', 'P-D-UC01-R01-T01 > file:test/lend.test.ts',
      'P-UI01 > file:src/ui/LoanTable.tsx', 'P-V01 > P-UI01',
    ]);
    // An invariant: its aggregate, and what builds it as coverage counts: the table whose unique key enforces it.
    const inv = traceChain(index, 'P-D-INV01')!;
    expect(inv.design).toEqual(['P-D-A3']);
    expect(inv.build).toContain('P-D-EN03-TB');
    expect(inv.build).not.toContain('P-D-REPO01');
    expect(inv.links).toEqual(expect.arrayContaining([['P-D-INV01', 'P-D-A3'], ['P-D-INV01', 'P-D-EN03-TB']]));
    expect(inv.tests).toEqual(['P-D-INV01-T']);
    // A constraint: its value object and the value object's value type.
    const con = traceChain(index, 'P-VO01-C01')!;
    expect(con.design).toEqual(['P-VO01']);
    expect(con.build).toEqual(['P-VO01-VT']);
    expect(files('P-VO01-C01', served)).toEqual(['src/name.ts', 'test/name.test.ts']);
    // A pattern rule: the tests that prove it, in every domain that follows its pattern.
    const patterns = indexOf(patternWorkspace());
    const rule = traceChain(patterns, 'DM-PAT-AUDIT-R01')!;
    expect(rule.tests).toContain('DM-PAT-AUDIT-R01-T01');
    expect(rule.files.map((f) => f.path)).toContain('test/audit.test.ts');
    // Nothing else has a chain.
    for (const id of ['P-D-UC01-R01', 'P-D-INV01', 'P-VO01-C01', 'P-D-SP01', 'P-D-PO02', 'P-D-DS01', 'P-D-EP01-R01', 'P-V01-R01']) expect(isObligation(index, id), id).toBe(true);
    for (const id of ['P', 'P-D', 'P-D-UC01', 'P-D-CMD01', 'P-D-UC01-R01-T01', 'P-V01', 'missing']) expect(traceChain(index, id), id).toBeNull();
  });

  it('LA-V98-R04-T01 A row\'s gaps are the ones coverage reports: not designed, not built, not proved; a pattern rule owes proof only', () => {
    expect(traceChain(index, 'P-D-UC01-R01')!.gaps).toEqual([]);
    // Coverage reports the second requirement and an invariant not proved: their gap is in the tests column.
    expect(traceChain(index, 'P-D-UC01-R02')!.gaps).toEqual(['tests']);
    expect(traceChain(index, 'P-D-INV02')!.gaps).toEqual(['tests']);
    // Whatever coverage reports, the row says, and nothing else: an empty column with no gap is none.
    const w = testWorkspace();
    w.coverage[0].gaps.push(gap('P-D-SP01', 'specification', 'built'), gap('P-D-SP01', 'specification', 'designed'));
    const spec = traceChain(indexOf(w), 'P-D-SP01')!;
    expect(spec.gaps).toEqual(['design', 'build']);
    expect(spec.proofOnly).toBe(false);
    const rule = traceChain(indexOf(patternWorkspace()), 'DM-PAT-AUDIT-R02')!;
    expect(rule.proofOnly).toBe(true);
    expect(rule.gaps).toEqual(['tests']);
  });
});

describe('the matrix under a record or group', () => {
  const index = testIndex();

  it('LA-V98-R03-T01 A matrix has one row per obligation under the focus, in the nav\'s order, grouped by parent', () => {
    // A use case: its requirements, under it.
    const uc = traceMatrix(index, 'P-D-UC01');
    expect(uc.map((g) => g.parent?.id)).toEqual(['P-D-UC01']);
    expect(uc[0].rows.map((r) => r.obligation)).toEqual(obligationsUnder(index, 'P-D-UC01'));
    expect(uc[0].rows.map((r) => r.obligation)).toContain('P-D-UC01-R01');
    // A domain: every obligation under it, each group a parent, each obligation once.
    const domain = traceMatrix(index, 'P-D');
    const rows = domain.flatMap((g) => g.rows.map((r) => r.obligation));
    expect(rows).toEqual(expect.arrayContaining(['P-D-UC01-R01', 'P-D-INV01', 'P-D-SP01']));
    expect(new Set(rows).size).toBe(rows.length);
    for (const g of domain) for (const r of g.rows) expect(index.byId.get(r.obligation)!.parent ?? null).toBe(g.parent?.id ?? null);
    expect(new Set(domain.map((g) => g.parent?.id)).size).toBe(domain.length);
    // A stage of the domain, and the product: what is under them.
    expect(traceMatrix(index, 'P-D/use-cases').flatMap((g) => g.rows.map((r) => r.obligation))).toContain('P-D-UC01-R01');
    expect(traceMatrix(index, 'P').flatMap((g) => g.rows.map((r) => r.obligation))).toEqual(expect.arrayContaining(rows));
    // Every focus has a shape (LA-PAT-APP-UX-R17): a chain, a matrix, the rows that hold it, or the matrix around it.
    for (const id of ['P', 'P-D', 'P-D/use-cases', 'P-D-UC01', 'P-D-A3']) expect(traceShape(index, id).shape, id).toBe('matrix');
    expect(traceShape(index, 'P-D-UC01-R01').shape).toBe('chain');
    for (const id of ['P-D-UC01-R01-T01', 'P-D-UC01-FL01-S01', 'P-D-CMD01-H']) expect([id, traceShape(index, id).shape, holdersOf(index, id)]).toEqual([id, 'rows', ['P-D-UC01-R01']]);
    expect(traceShape(index, 'P-D-CMD02')).toMatchObject({ shape: 'context', untraced: true, scope: 'P-D-A3' });
    expect(traceShape(index, 'P-D-EN03')).toMatchObject({ shape: 'context', untraced: false, scope: 'P-D-A3' });
    expect(traceShape(index, 'P-D-TM01')).toMatchObject({ shape: 'context', untraced: false });
    expect(traceMatrix(index, 'P-D-UC01-R01-T01')).toEqual([]);
  });
});

describe('what no obligation reaches', () => {
  it('LA-V98-R07-T01 Untraced lists the records coverage reports untraced under the focus, by kind', async () => {
    const index = indexOf(await servedByEngine(testWorkspace()));
    const of = (focus: string, i = index) => Object.fromEntries(untracedUnder(i, focus).map((g) => [g.kind, g.ids]));
    // Under the domain: a step that fulfills nothing, the commands and the query no fulfilling step invokes, by kind in the schema's order.
    const domain = untracedUnder(index, 'P-D');
    expect(domain.map((g) => g.kind)).toEqual(expect.arrayContaining(['command', 'flow_step']));
    expect(of('P-D').flow_step).toEqual(['P-D-UC01-FL01-S02']);
    expect(of('P-D').command).toContain('P-D-CMD02');
    // Each is coverage's record-untraced gap; what a chain reaches is not listed, nor a container, a flow test or anything of another kind.
    const listed = domain.flatMap((g) => g.ids);
    const reported = [...index.coverage.values()].flatMap((c) => c.gaps).filter((g) => g.missing === 'record-untraced').map((g) => g.id);
    for (const id of listed) expect(reported, id).toContain(id);
    for (const id of ['P-D-UC01-FL01-S01', 'P-D-CMD01', 'P-D-CMD01-H', 'P-D-UC01-FL01', 'P-V01', 'P-D-A3', 'P-D-UC01-FL01-T', 'P-D-UC01-R01-T01', 'P-D-EN03']) expect(listed, id).not.toContain(id);
    // Only what is under the focus: nothing under a use case.
    expect(untracedUnder(index, 'P-D-UC01')).toEqual([]);
    // Once the step fulfills a requirement, the engine no longer reports it.
    const w = testWorkspace();
    addRows(w, 'fulfills', { source_id: 'P-D-UC01-FL01-S02', target_id: 'P-D-UC01-R01' });
    expect(of('P-D/interaction-design', indexOf(await servedByEngine(w)))).toEqual({});
  });
});
