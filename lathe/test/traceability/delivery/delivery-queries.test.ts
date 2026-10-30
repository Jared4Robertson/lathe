// The Delivery read (LA-TRC-RM13, LA-TRC-QRY18): each use case of a product's space once, from the outcomes its
// capability serves to its acceptance tests, with its requirements, flows, steps, technical chains, flow tests and
// status per stage, read from the rows and the checks' run through the read model's reader, as the CLI, the MCP tools
// and the HTTP API read it.
import { afterEach, describe, expect, it } from 'vitest';
import { LIST_DELIVERY } from '../../../src/traceability/delivery/queries.ts';
import type { ProductDelivery } from '../../../src/traceability/delivery/read-model.ts';
import { answerQuery, runQuery } from '../../../src/platform/commands/run.ts';
import type { CheckRun, ReadView } from '../../../src/platform/data/rules.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Coverage, CoverageGap, TraceChain } from '../../../src/types.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { complete, writeData } from '../../helpers.ts';

const open: Store[] = [];
afterEach(async () => { for (const s of open.splice(0)) await s.close(); });

const gap = (id: string, kind: string, missing: string): CoverageGap => ({ id, kind, missing, message: `${id} misses ${missing}.` });
const chain = (obligation: string, tests: string[]): TraceChain => ({ obligation, design: [], build: [], tests, files: [], links: [] });
const coverage = (gaps: CoverageGap[]): Coverage => ({ product: 'EX', domain: 'EX-LEND', gaps, obligations: [], tests: { automated: 0, manual: 0, not_automated: 0 }, proved_by: {}, pattern_rules: [] });

/** The complete data set with a run of the checks that found these gaps and these tests. */
async function view(run: Omit<CheckRun, 'problems'>): Promise<ReadView> {
  const store = await openStore(writeData(complete()));
  open.push(store);
  return { schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id), checked: { problems: [], ...run } };
}

describe('LA-TRC-UC10-R06-T01 A product\'s Delivery read gives each use case of its space once, from its outcomes to its acceptance tests, with its status per stage', () => {
  it('reads each use case\'s outcomes, requirements, what it changes and reads, its flows\' steps with their design and technical chain, and its tests', async () => {
    const data = await view({
      chains: [chain('EX-LEND-UC01-R01', ['EX-LEND-UC01-R01-T01']), chain('EX-LEND-INV01', ['EX-LEND-INV01-T01'])],
      coverage: [coverage([gap('EX-V01-R01', 'view_requirement', 'built'), gap('EX-V01-R01', 'view_requirement', 'proved')])],
    });
    const ex = runQuery(data, LIST_DELIVERY, { product_id: 'EX' }) as ProductDelivery;
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
    // Its flow's steps in path order, each with its design and its technical chain, and the flow's test.
    const [flow] = uc1.flows;
    expect(flow).toMatchObject({ id: 'EX-LEND-UC01-FL01', interface: 'EX-IF01', test: 'EX-LEND-UC01-FL01-T', proved: true });
    expect(flow.steps.map((s) => s.id)).toEqual(['EX-LEND-UC01-FL01-S01', 'EX-LEND-UC01-FL01-S02']);
    expect(flow.steps[0]).toEqual({
      id: 'EX-LEND-UC01-FL01-S01', path: 'main', position: 1, fulfills: ['EX-LEND-UC01-R01'], operation: 'EX-LEND-CMD01', view: 'EX-V01',
      viewRequirements: [{ id: 'EX-V01-R01', gaps: ['built', 'proved'], tests: [] }],
      endpoints: [{ id: 'EX-LEND-EP01', apiRequirements: [{ id: 'EX-LEND-EP01-R01', gaps: [], tests: [] }] }],
      integrations: [],
      chain: { components: ['EX-UI01'], entries: ['EX-LEND-EP01'], handlers: ['EX-LEND-CMD01-H'], stores: ['EX-LEND-REPO01'], dataStores: ['EX-STORE01'], adapters: [] },
    });
    // A query's reader stands where a command's repository would, and an integration's adapter beside it.
    expect(flow.steps[1].chain).toEqual({ components: [], entries: [], handlers: ['EX-LEND-QRY01-H'], stores: ['EX-LEND-RM01-RD'], dataStores: ['EX-STORE01'], adapters: ['EX-INT01-AD'] });
    // What its tests rest on: its steps' view and API requirements, its aggregates' invariants and storage requirements.
    expect(uc1.lower.map((o) => o.id)).toEqual(['EX-LEND-A1-SR01', 'EX-LEND-EP01-R01', 'EX-LEND-INV01', 'EX-V01-R01']);
    expect(uc1.lower.find((o) => o.id === 'EX-LEND-INV01')!.tests).toEqual(['EX-LEND-INV01-T01']);
    expect(uc1.status).toEqual({ design: { flows: 1, notDesigned: 0 }, technical: { handlers: 2, notBuilt: 1 }, suite: { tests: 2, owed: 2, notProved: 0 } });
    expect(LIST_DELIVERY.text(ex).split('\n')[1]).toBe('  EX-LEND-UC01 (EX-BO01): 1 flow, all designed · 2 handlers, 1 not built · 2 tests, all proved');
  });

  it('counts a requirement no step designs and one not proved, and refuses an unknown product and data without the checks\' run', async () => {
    const data = await view({ chains: [], coverage: [coverage([gap('EX-LEND-UC01-R01', 'uc_requirement', 'designed'), gap('EX-LEND-UC01-R01', 'uc_requirement', 'proved')])] });
    const uc1 = (runQuery(data, LIST_DELIVERY, { product_id: 'EX' }) as ProductDelivery).rows[0];
    expect(uc1.requirements).toEqual([{ id: 'EX-LEND-UC01-R01', gaps: ['designed', 'proved'], tests: [] }]);
    expect(uc1.status.design.notDesigned).toBe(1);
    expect(uc1.status.suite.notProved).toBe(1);
    expect(() => runQuery(data, LIST_DELIVERY, { product_id: 'NOPE' })).toThrow(StoreError);
    const store = open[0];
    expect(() => answerQuery(store, LIST_DELIVERY, { product_id: 'EX' })).toThrow(/LA-TRC-QRY18 reads the checks' run/);
  });

  it('runs the checks first for `lathe delivery list-delivery`', async () => {
    const root = writeData(complete());
    const out: string[] = [];
    expect(await runAggregateCommand(['delivery', 'list-delivery', '--product_id', 'EX', '--root', root.replace(/\/data$/, '')], { out: (t) => out.push(t), err: (t) => out.push(t) })).toBe(0);
    expect(out[0]).toMatch(/^EX: 2 use cases, 1 outcome\n {2}EX-LEND-UC01 \(EX-BO01\): 1 flow/);
  });
});
