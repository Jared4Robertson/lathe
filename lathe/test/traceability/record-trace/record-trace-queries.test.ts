// The Record trace read (LA-TRC-RM06, LA-TRC-QRY05): one record's traceability, as the Record page pattern's
// Traceability section shows it, read from the checks' run (chains, coverage, problems) and the rows through the read
// model's reader: an obligation's chain and how each owing domain stands on it; a use case's requirements, judged; a
// test's run by; a record's other links by relation, with their words.
import { afterEach, describe, expect, it } from 'vitest';
import { GET_RECORD_TRACE } from '../../../src/traceability/record-trace/queries.ts';
import type { RecordTrace } from '../../../src/traceability/record-trace/read-model.ts';
import { runQuery } from '../../../src/platform/commands/run.ts';
import type { CheckRun, ReadView } from '../../../src/platform/data/rules.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Coverage } from '../../../src/types.ts';
import { writeData } from '../../helpers.ts';
import { TWO_PRODUCTS } from '../../checking/problems/data-set.ts';

const open: Store[] = [];
afterEach(async () => { for (const s of open.splice(0)) await s.close(); });

const coverage = (product: string, domain: string | null, provedBy: Record<string, string[]>, gaps: Coverage['gaps'] = []): Coverage => ({
  product, domain, gaps, obligations: [], tests: { automated: 0, manual: 0, not_automated: 0 }, proved_by: provedBy, pattern_rules: [], debt: [],
});

/** The two products with a test of EX's invariant, a use case with a requirement, and a test data set; and a run of the checks. */
async function data(run: Partial<CheckRun> = {}): Promise<ReadView> {
  const store = await openStore(writeData({
    ...TWO_PRODUCTS,
    capability: [{ id: 'EX-LEND-CAP01', title: 'Lending', domain_id: 'EX-LEND', position: 1, description: 'Lend tools.' }],
    use_case: [{ id: 'EX-LEND-UC01', title: 'Lend a tool', capability_id: 'EX-LEND-CAP01', goal: 'A member takes a tool home.' }],
    uc_requirement: [
      { id: 'EX-LEND-UC01-R01', title: 'A lent tool is out', use_case_id: 'EX-LEND-UC01', statement: 'A lent tool MUST read as out.', group_name: 'Lending' },
    ],
    invariant_test: [{ id: 'EX-LEND-INV01-T', title: 'Two loans are refused', invariant_id: 'EX-LEND-INV01', level: 'unit', state: 'automated', file: 'test/loan.test.ts', when: 'A second loan of a tool is made.', then: 'It is refused.' }],
    test_data_set: [{ id: 'EX-LEND-TD01', title: 'One tool', domain_id: 'EX-LEND', environment: 'Memory.', records: 'One tool.', prepare: 'Seed it.', reset: 'Drop it.', description: 'One tool to lend.' }],
  }));
  open.push(store);
  return {
    schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id),
    checked: { problems: [], coverage: [], chains: [], ...run },
  };
}

describe('LA-TRC-UC14-R07-T02 A record\'s trace gives an obligation\'s chain and its standing where it is owed, a use case\'s requirements judged, a test\'s run by, and its other links', () => {
  it('reads an obligation: its chain, the built mark, and its standing in its domain as coverage says', async () => {
    const view = await data({
      chains: [{ obligation: 'EX-LEND-INV01', design: ['EX-LEND-A1'], build: ['EX-LEND-EN01'], tests: ['EX-LEND-INV01-T'], files: [], links: [] }],
      coverage: [coverage('EX', 'EX-LEND', { 'EX-LEND-INV01': ['EX-LEND-INV01-T'] }, [{ id: 'EX-LEND-INV01', kind: 'invariant', missing: 'built', message: 'not built' }])],
    });
    const trace = runQuery(view, GET_RECORD_TRACE, { id: 'EX-LEND-INV01' }) as RecordTrace;
    expect(trace.chain).toEqual([
      { role: 'design', label: 'Designed by', ids: ['EX-LEND-A1'] },
      { role: 'build', label: 'Built by', ids: ['EX-LEND-EN01'] },
      { role: 'proof', label: 'Proved by', ids: ['EX-LEND-INV01-T'] },
    ]);
    // The entity names no file, so it is not built.
    expect(trace.built).toEqual([]);
    expect(trace.judgments).toEqual([{
      domain: 'EX-LEND', needsDesign: true, designedBy: ['EX-LEND-A1'], builtBy: [], provedBy: ['EX-LEND-INV01-T'], notAutomatedBy: [],
      gaps: [{ kind: 'not-built', check: 'not-built' }],
    }]);
    // What its chain holds is not repeated among its links.
    expect(trace.links.flatMap((g) => g.ids)).not.toContain('EX-LEND-INV01-T');
  });

  it('LA-TRC-UC14-R08-T01 LA-TRC-UC14-R10-T01 reads a use case\'s requirements, a test\'s run by, and a test data set as no test', async () => {
    const view = await data({ coverage: [coverage('EX', 'EX-LEND', {})] });
    const useCase = runQuery(view, GET_RECORD_TRACE, { id: 'EX-LEND-UC01' }) as RecordTrace;
    expect(useCase.requirements.map((r) => [r.id, r.group, r.judgment?.gaps.map((g) => g.kind)])).toEqual([['EX-LEND-UC01-R01', 'Lending', ['not-proved']]]);
    const test = runQuery(view, GET_RECORD_TRACE, { id: 'EX-LEND-INV01-T' }) as RecordTrace;
    expect(test.proves).toBe('EX-LEND-INV01');
    expect(test.runBy).toEqual({ level: 'unit', state: 'automated', file: 'test/loan.test.ts', missing: false, manualReason: null, size: 'small', markers: [] });
    const set = runQuery(view, GET_RECORD_TRACE, { id: 'EX-LEND-TD01' }) as RecordTrace;
    expect(set.runBy).toBeNull();
    expect(() => runQuery(view, GET_RECORD_TRACE, { id: 'EX-NOPE' })).toThrow(StoreError);
  });
});
