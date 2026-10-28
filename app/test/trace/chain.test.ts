import { describe, expect, it } from 'vitest';
import { addRows, indexOf } from '../fixtures/load';
import { patternWorkspace } from '../fixtures/patterns';
import { gapColumns, holdersOf, obligationsUnder, traceChain, traceMatrix, traceShape, untracedUnder } from '../../src/trace/chain';
import { isObligation } from '../../src/trace/offer';
import { testIndex, testWorkspace } from '../graph/workspace';

// The Trace view's logic (app/src/trace/chain.ts): an obligation's chain, and the matrix of every
// obligation under a record or group.

const files = (id: string, index = testIndex()) => traceChain(index, id)!.files.map((f) => f.path);

describe('an obligation\'s chain', () => {
  const index = testIndex();

  it('LA-V98-R02-T01 An obligation\'s chain holds what designs, builds and proves it, and the files they name', () => {
    // A UC requirement: the step that fulfills it, its flow, where it happens and what it invokes; that command's handler; its test.
    const req = traceChain(index, 'P-D-UC01-R01')!;
    expect(req.design).toEqual(expect.arrayContaining(['P-D-UC01-FL01', 'P-D-UC01-FL01-S01', 'P-V01', 'P-D-CMD01']));
    expect(req.design).not.toContain('P-D-UC01-FL01-S02');
    expect(req.build).toEqual(['P-D-CMD01-H']);
    expect(req.tests).toEqual(['P-D-UC01-R01-T01']);
    expect(files('P-D-UC01-R01')).toEqual(['src/loans.ts', 'test/lend.test.ts']);
    expect(req.files.find((f) => f.path === 'src/loans.ts')!.namedBy).toEqual(['P-D-CMD01-H']);
    // An invariant: its aggregate, the aggregate's repository and the table whose unique key enforces it.
    const inv = traceChain(index, 'P-D-INV01')!;
    expect(inv.design).toEqual(['P-D-A3']);
    expect(inv.build).toEqual(expect.arrayContaining(['P-D-A3-REPO', 'P-D-EN03-TB']));
    expect(inv.tests).toEqual(['P-D-INV01-T']);
    // A constraint: its value object and the value object's value type.
    const con = traceChain(index, 'P-VO01-C01')!;
    expect(con.design).toEqual(['P-VO01']);
    expect(con.build).toEqual(['P-VO01-VT']);
    expect(files('P-VO01-C01')).toEqual(['src/name.ts', 'test/name.test.ts']);
    // A pattern rule: the tests that prove it, in every domain that follows its pattern.
    const patterns = indexOf(patternWorkspace());
    const rule = traceChain(patterns, 'DM-PAT-AUDIT-R01')!;
    expect(rule.tests).toContain('DM-PAT-AUDIT-R01-T01');
    expect(rule.files.map((f) => f.path)).toContain('test/audit.test.ts');
    // Nothing else has a chain.
    for (const id of ['P-D-UC01-R01', 'P-D-INV01', 'P-VO01-C01', 'P-D-SP01', 'P-D-PO02', 'P-D-DS01', 'P-D-EP01-R01', 'P-V01-R01']) expect(isObligation(index, id), id).toBe(true);
    for (const id of ['P', 'P-D', 'P-D-UC01', 'P-D-CMD01', 'P-D-UC01-R01-T01', 'P-V01', 'missing']) expect(traceChain(index, id), id).toBeNull();
  });

  it('LA-V98-R04-T01 A gap is a column owed and left empty; a pattern rule owes no design or build', () => {
    expect(gapColumns(traceChain(index, 'P-D-UC01-R01')!)).toEqual([]);
    // A specification nothing implements or proves: it owes a build, tests and files; its design is its technical records.
    const spec = traceChain(index, 'P-D-SP01')!;
    expect(spec.notOwed.has('design')).toBe(true);
    expect(gapColumns(spec)).toEqual(['build', 'tests', 'files']);
    const rule = traceChain(indexOf(patternWorkspace()), 'DM-PAT-AUDIT-R01')!;
    expect([...rule.notOwed].sort()).toEqual(['build', 'design']);
    expect(gapColumns(rule)).not.toContain('design');
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
  it('LA-V98-R07-T01 Untraced lists the steps, operations, handlers, components and tests no obligation reaches, by kind', () => {
    const index = testIndex();
    const of = (focus: string, i = index) => Object.fromEntries(untracedUnder(i, focus).map((g) => [g.kind, g.ids]));
    // Under the domain: a step that fulfills nothing, the commands and the query no fulfilling step invokes, by kind in the schema's order.
    const domain = untracedUnder(index, 'P-D');
    expect(domain.map((g) => g.kind)).toEqual(['command', 'query', 'flow_step']);
    expect(of('P-D').flow_step).toEqual(['P-D-UC01-FL01-S02']);
    expect(of('P-D').command).toContain('P-D-CMD02');
    // What a chain reaches is not listed, nor a container, a flow test or anything of another kind.
    const listed = domain.flatMap((g) => g.ids);
    for (const id of ['P-D-UC01-FL01-S01', 'P-D-CMD01', 'P-D-CMD01-H', 'P-D-UC01-FL01', 'P-V01', 'P-D-A3', 'P-D-UC01-FL01-T', 'P-D-UC01-R01-T01', 'P-D-EN03']) expect(listed, id).not.toContain(id);
    // Only what is under the focus: an aggregate's own command, and nothing under a use case.
    expect(of('P-D-A3')).toEqual({ command: ['P-D-CMD02'] });
    expect(untracedUnder(index, 'P-D-UC01')).toEqual([]);
    // Once the step fulfills a requirement, it is traced.
    const w = testWorkspace();
    addRows(w, 'fulfills', { source_id: 'P-D-UC01-FL01-S02', target_id: 'P-D-UC01-R01' });
    expect(of('P-D/interaction-design', indexOf(w))).toEqual({});
  });
});
