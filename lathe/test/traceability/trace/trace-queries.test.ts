// The Trace reads (LA-TRC-RM13, LA-TRC-QRY18, LA-TRC-QRY19, LA-TRC-QRY21): each use case of a product's space once, from the outcomes its
// aggregate or read model serves to its acceptance tests, with its requirements, flows, steps, technical chains, flow tests and
// status per stage, and each journey's proof rolled up from its steps and its journey test, read from the rows and the
// checks' run through the read model's reader, as the CLI, the MCP tools and the HTTP API read it.
import { afterEach, describe, expect, it } from 'vitest';
import { GET_JOURNEY_PROOF, LIST_JOURNEY_PROOFS, LIST_TRACED_USE_CASES } from '../../../src/traceability/trace/queries.ts';
import type { ProductTrace, TraceJourney } from '../../../src/traceability/trace/read-model.ts';
import { answerQuery, runQuery } from '../../../src/platform/commands/run.ts';
import type { CheckRun, ReadView } from '../../../src/platform/data/rules.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Coverage, CoverageGap, Problem, TraceChain } from '../../../src/types.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { changing, complete, withJourney, without, writeData, type Data } from '../../helpers.ts';

const open: Store[] = [];
afterEach(async () => { for (const s of open.splice(0)) await s.close(); });

const gap = (id: string, kind: string, missing: string): CoverageGap => ({ id, kind, missing, message: `${id} misses ${missing}.` });
const chain = (obligation: string, tests: string[]): TraceChain => ({ obligation, design: [], build: [], tests, files: [], links: [] });
const coverage = (gaps: CoverageGap[]): Coverage => ({ product: 'EX', domain: 'EX-LEND', gaps, obligations: [], tests: { automated: 0, manual: 0, not_automated: 0 }, proved_by: {}, pattern_rules: [], debt: [] });

/** The data set (the complete one unless given) with a run of the checks that found these gaps, tests and problems. */
async function view(run: Omit<CheckRun, 'problems'> & { problems?: Problem[] }, data: Data = complete()): Promise<ReadView> {
  const store = await openStore(writeData(data));
  open.push(store);
  return { schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id), checked: { problems: [], ...run } };
}

describe('LA-TRC-UC10-R06-T01 A product\'s trace rows read gives each use case of its space once, from its outcomes to its acceptance tests, with its status per stage', () => {
  it('reads each use case\'s outcomes, requirements, what it changes and reads, its flows\' steps with their design and technical chain, and its tests', async () => {
    const data = await view({
      chains: [chain('EX-LEND-UC01-R01', ['EX-LEND-UC01-R01-T01']), chain('EX-LEND-INV01', ['EX-LEND-INV01-T01'])],
      coverage: [coverage([gap('EX-V01-R01', 'view_requirement', 'built'), gap('EX-V01-R01', 'view_requirement', 'proved')])],
    });
    const ex = runQuery(data, LIST_TRACED_USE_CASES, { product_id: 'EX' }) as ProductTrace;
    expect(ex.product).toBe('EX');
    expect(ex.outcomes).toEqual(['EX-BO01']);
    expect(ex.rows.map((r) => r.useCase)).toEqual(['EX-LEND-UC01', 'EX-LEND-UC02']);
    const uc1 = ex.rows[0];
    expect(uc1).toMatchObject({
      outcomes: ['EX-BO01'],
      requirements: [{ id: 'EX-LEND-UC01-R01', gaps: [], tests: ['EX-LEND-UC01-R01-T01'] }],
      changes: ['EX-LEND-A1', 'EX-LEND-A2'],
      reads: ['EX-LEND-RM01'],
    });
    // Its flow's steps in path order, each with its operation and its technical chain, and the flow's test; each interface's version is derived.
    const flow = uc1.flow!;
    expect(flow).toMatchObject({ id: 'EX-LEND-UC01-FL', test: 'EX-LEND-UC01-FL-T', proved: true });
    expect(flow.steps.map((s) => s.id)).toEqual(['EX-LEND-UC01-FL-S01', 'EX-LEND-UC01-FL-S02']);
    expect(flow.steps[0]).toEqual({
      id: 'EX-LEND-UC01-FL-S01', path: 'main', position: 1, variantOf: null, fulfills: ['EX-LEND-UC01-R01'], operation: 'EX-LEND-CMD01',
      integrations: [],
      chain: { components: ['EX-UI01'], entries: ['EX-LEND-EP01'], handlers: ['EX-LEND-CMD01-H'], stores: ['EX-LEND-REPO01'], dataStores: ['EX-STORE01'], adapters: [] },
    });
    // The web app's version of the flow: the step is carried out in the view that presents its command, with the view's requirements.
    expect(flow.through).toHaveLength(1);
    expect(flow.through[0]).toMatchObject({ interface: 'EX-IF01', kind: 'web app', actor: 'Member' });
    expect(flow.through[0].steps[0]).toEqual({
      id: 'EX-LEND-UC01-FL-S01',
      views: [{ id: 'EX-V01', requirements: [{ id: 'EX-V01-R01', gaps: ['built', 'proved'], tests: [] }] }],
      endpoints: [], entries: [], unreached: false,
    });
    // A query's reader stands where a command's repository would, and an integration's adapter beside it.
    expect(flow.steps[1].chain).toEqual({ components: ['EX-UI01'], entries: [], handlers: ['EX-LEND-QRY01-H'], stores: ['EX-LEND-RM01-RD'], dataStores: ['EX-STORE01'], adapters: ['EX-INT01-AD'] });
    // What its tests rest on: the view and API requirements of the interfaces that carry its steps (the fixture's only interface is a web app, so no API requirement), its aggregates' invariants and storage requirements.
    expect(uc1.lower.map((o) => o.id)).toEqual(['EX-LEND-A1-SR01', 'EX-LEND-INV01', 'EX-V01-R01']);
    expect(uc1.lower.find((o) => o.id === 'EX-LEND-INV01')!.tests).toEqual(['EX-LEND-INV01-T01']);
    expect(uc1.status).toEqual({ design: { interfaces: 1, integrations: 0, notDesigned: 0 }, technical: { handlers: 2, notBuilt: 1 }, suite: { tests: 2, owed: 2, notProved: 0 } });
    expect(LIST_TRACED_USE_CASES.text(ex).split('\n')[1]).toBe('  EX-LEND-UC01 (EX-BO01): 1 interface, all designed · 2 handlers, 1 not built · 2 tests, all proved');
  });

  it('counts a requirement no step designs and one not proved, and refuses an unknown product and data without the checks\' run', async () => {
    const data = await view({ chains: [], coverage: [coverage([gap('EX-LEND-UC01-R01', 'uc_requirement', 'designed'), gap('EX-LEND-UC01-R01', 'uc_requirement', 'proved')])] });
    const uc1 = (runQuery(data, LIST_TRACED_USE_CASES, { product_id: 'EX' }) as ProductTrace).rows[0];
    expect(uc1.requirements).toEqual([{ id: 'EX-LEND-UC01-R01', gaps: ['designed', 'proved'], tests: [] }]);
    expect(uc1.status.design.notDesigned).toBe(1);
    expect(uc1.status.suite.notProved).toBe(1);
    expect(() => runQuery(data, LIST_TRACED_USE_CASES, { product_id: 'NOPE' })).toThrow(StoreError);
    const store = open[0];
    expect(() => answerQuery(store, LIST_TRACED_USE_CASES, { product_id: 'EX' })).toThrow(/LA-TRC-QRY18 reads the checks' run/);
  });

  it('runs the checks first for `lathe trace list-traced-use-cases`', async () => {
    const root = writeData(complete());
    const out: string[] = [];
    expect(await runAggregateCommand(['trace', 'list-traced-use-cases', '--product_id', 'EX', '--root', root.replace(/\/data$/, '')], { out: (t) => out.push(t), err: (t) => out.push(t) })).toBe(0);
    expect(out[0]).toMatch(/^EX: 2 use cases, 1 outcome\n {2}EX-LEND-UC01 \(EX-BO01\): 1 interface/);
  });
});

describe('LA-TRC-UC22-R01-T01 A journey reads as proved only when its journey test counts and every step is proved', () => {
  const proof = async (run: Omit<CheckRun, 'problems'> & { problems?: Problem[] }, data: Data = withJourney()) => runQuery(await view(run, data), GET_JOURNEY_PROOF, { id: 'EX-JR01' }) as TraceJourney;

  it('rolls a journey up from its steps, each with what it carries out and who acts, and its journey test', async () => {
    const proved = await proof({ chains: [], coverage: [] });
    expect(proved).toEqual({
      id: 'EX-JR01',
      product: 'EX',
      outcomes: ['EX-BO02'],
      steps: [
        { id: 'EX-JR01-S01', path: 'main', position: 1, carriesOut: 'EX-LEND-UC02', kind: 'use_case', actors: ['Librarian'], designed: true, built: true, proved: true },
        { id: 'EX-JR01-S02', path: 'main', position: 2, carriesOut: 'EX-LEND-UC01', kind: 'use_case', actors: ['Member'], designed: true, built: true, proved: true },
        { id: 'EX-JR01-S03', path: 'main', position: 3, carriesOut: 'EX-LEND-PO01', kind: 'policy', actors: [], designed: true, built: true, proved: true },
      ],
      test: 'EX-JR01-T',
      testProved: true,
      proved: true,
      status: { steps: 3, unlinked: 0, stepsProved: 3, designed: 3, built: 3 },
    });
    expect(GET_JOURNEY_PROOF.text(proved).split('\n')).toEqual([
      'EX-JR01 (EX-BO02): proved · 3 steps · 3 proved · journey test proved',
      '  main 1 EX-JR01-S01: EX-LEND-UC02 (Librarian), proved',
      '  main 2 EX-JR01-S02: EX-LEND-UC01 (Member), proved',
      '  main 3 EX-JR01-S03: EX-LEND-PO01 (handoff), proved',
    ]);
    // The use case rows name the journey steps that carry them out, and the product lists its journeys.
    const trace = runQuery(await view({ chains: [], coverage: [] }, withJourney()), LIST_TRACED_USE_CASES, { product_id: 'EX' }) as ProductTrace;
    expect(trace.rows.map((r) => r.journeys)).toEqual([[{ journey: 'EX-JR01', step: 'EX-JR01-S02' }], [{ journey: 'EX-JR01', step: 'EX-JR01-S01' }]]);
    expect(trace.journeys).toEqual([proved]);
  });

  it("is not proved while a handoff's policy, a use case's requirement or flow test, or the journey test falls short, and counts what is", async () => {
    const handoff = await proof({ chains: [], coverage: [coverage([gap('EX-LEND-PO01', 'policy', 'proved')])] });
    expect(handoff.steps.map((s) => s.proved)).toEqual([true, true, false]);
    expect(handoff).toMatchObject({ proved: false, testProved: true, status: { steps: 3, unlinked: 0, stepsProved: 2, designed: 3, built: 3 } });
    const requirement = await proof({ chains: [], coverage: [coverage([gap('EX-LEND-UC01-R01', 'uc_requirement', 'designed'), gap('EX-LEND-UC01-R01', 'uc_requirement', 'proved')])] });
    expect(requirement.steps[1]).toMatchObject({ designed: false, built: true, proved: false });
    // A flow test not automated yet proves nothing.
    const flowTest = await proof({ chains: [], coverage: [] }, changing(withJourney(), 'flow_test', (t) => t.id === 'EX-LEND-UC01-FL-T', { state: 'not automated yet' }));
    expect(flowTest.steps[1].proved).toBe(false);
    // A journey test whose file does not name it, or none at all.
    const unnamed = await proof({ chains: [], coverage: [], problems: [{ severity: 'error', check: 'test-file-missing-id', record: 'EX-JR01-T', message: 'It does not name it.' }] });
    expect(unnamed).toMatchObject({ test: 'EX-JR01-T', testProved: false, proved: false });
    const untested = await proof({ chains: [], coverage: [] }, without(withJourney(), 'journey_test', () => true));
    expect(untested).toMatchObject({ test: null, testProved: false, proved: false });
    expect(GET_JOURNEY_PROOF.text(untested).split('\n')[0]).toBe('EX-JR01 (EX-BO02): not proved · 3 steps · 3 proved · no journey test');
    // A step that carries out nothing yet is counted and never proved.
    const unlinked = await proof({ chains: [], coverage: [] }, without(withJourney(), 'carries_out', (r) => r.source_id === 'EX-JR01-S03'));
    expect(unlinked.steps[2]).toEqual({ id: 'EX-JR01-S03', path: 'main', position: 3, carriesOut: null, kind: null, actors: [], designed: false, built: false, proved: false });
    expect(unlinked).toMatchObject({ proved: false, status: { steps: 3, unlinked: 1, stepsProved: 2, designed: 2, built: 2 } });
  });

  it('lists every journey\'s proof of a product in one read (LA-TRC-QRY21), the same as each journey read on its own', async () => {
    const data = await view({ chains: [], coverage: [] }, withJourney());
    const proof = runQuery(data, GET_JOURNEY_PROOF, { id: 'EX-JR01' }) as TraceJourney;
    expect(runQuery(data, LIST_JOURNEY_PROOFS, { product_id: 'EX' })).toEqual({ product: 'EX', journeys: [proof] });
    expect(LIST_JOURNEY_PROOFS.text({ product: 'EX', journeys: [proof] }).split('\n')).toEqual(['EX: 1 of 1 journey proved', '  EX-JR01: proved · 3 steps · 3 proved · journey test proved']);
    expect(() => runQuery(data, LIST_JOURNEY_PROOFS, { product_id: 'ZZ' })).toThrow(/there is no product ZZ/);
  });

  it('refuses an unknown journey and data without the checks\' run, and runs the checks first for `lathe trace get-journey-proof`', async () => {
    const data = await view({ chains: [], coverage: [] }, withJourney());
    expect(() => runQuery(data, GET_JOURNEY_PROOF, { id: 'EX-JR09' })).toThrow(/there is no journey EX-JR09/);
    expect(() => answerQuery(open[0], GET_JOURNEY_PROOF, { id: 'EX-JR01' })).toThrow(/LA-TRC-QRY19 reads the checks' run/);
    const root = writeData(withJourney());
    const out: string[] = [];
    expect(await runAggregateCommand(['trace', 'get-journey-proof', '--id', 'EX-JR01', '--root', root.replace(/\/data$/, '')], { out: (t) => out.push(t), err: (t) => out.push(t) })).toBe(0);
    expect(out[0]).toMatch(/^EX-JR01 \(EX-BO02\): /);
  });
});
