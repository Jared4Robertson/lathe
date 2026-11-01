// Essential and accidental complexity (LA-STD-PRINCIPLES-R05, R06), beyond the checks that report them (in each
// domain's checks.test.ts): every kind says which it is, a provided obligation is built and proved through its
// provider, and the store refuses a generated fill. Each starts from the complete product and changes one thing.
import { afterAll, describe, expect, it } from 'vitest';
import { adding, changing, complete, loadData, obligation, ofCheck, records, refusals, removeData, without } from '../helpers.ts';

afterAll(removeData);

describe('essential and accidental complexity', () => {
  it("LA-STD-PRINCIPLES-R05-T01 Each kind is essential or accidental by kind, never by record: a test follows what it proves, a standard its type, an API requirement its product's interfaces", async () => {
    const ws = await loadData(complete());
    const of = (kind: string) => ws.kinds.find((k) => k.kind === kind)?.complexity;
    for (const kind of ['product', 'business_outcome', 'aggregate', 'use_case', 'pattern', 'slot', 'flow_step', 'view_requirement', 'test_data_set']) expect(of(kind), kind).toBe('essential');
    for (const kind of ['endpoint', 'endpoint_handler', 'command_handler', 'table', 'ui_component', 'data_store', 'tooling']) expect(of(kind), kind).toBe('accidental');
    for (const kind of ['use_case_test', 'standard_rule', 'standard_rule_test']) expect(of(kind), kind).toBe('as-parent');
    expect(of('standard')).toBe('by-type');
    expect(of('api_requirement')).toBe('by-interface');
    expect(of('question')).toBeNull();
    // An API requirement is accidental on an internal API (the complete product's platform provides its one), so it
    // must be accounted for like any other accidental record; on a public API it is the product's contract with the
    // outside world, essential, and nothing need account for it.
    const unprovided = without(complete(), 'provided_by', (r) => r.source_id === 'EX-LEND-EP01-R01');
    expect(records(ofCheck(await loadData(unprovided), 'accidental-not-accounted-for'))).toEqual(['EX-LEND-EP01-R01']);
    const publicApi = changing(without(unprovided, 'happens_in', () => true), 'interface', () => true, { kind: 'API', public: true });
    expect(ofCheck(await loadData(publicApi), 'accidental-not-accounted-for')).toEqual([]);
    // Every kind of a stage says which it is; only the open question, outside the stages, says none.
    expect(ws.kinds.filter((k) => k.complexity === null).map((k) => k.kind)).toEqual(['question']);
  });

  it('LA-STD-PRINCIPLES-R06-T03 An obligation something outside the product provides is built and proved through its provider', async () => {
    let data = without(complete(), 'fills', (r) => r.source_id === 'EX-LEND-INV01-RL');
    data = without(data, 'rule', () => true);
    data = without(data, 'starts_from', (r) => r.source_id === 'EX-LEND-INV01-T');
    data = without(data, 'invariant_test', () => true);
    const bare = await loadData(data);
    expect(obligation(bare, 'EX-LEND', 'invariant')).toMatchObject({ total: 1, built: 0, proved: 0 });
    const provided = await loadData(adding(data, { provided_by: [{ source_id: 'EX-LEND-INV01', target_id: 'EX-INT02' }] }));
    expect(obligation(provided, 'EX-LEND', 'invariant')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 1 });
    expect(provided.coverage.find((c) => c.domain === 'EX-LEND')?.proved_by['EX-LEND-INV01']).toEqual(['EX-INT02']);
    expect(provided.chains.find((c) => c.obligation === 'EX-LEND-INV01')?.build).toEqual(['EX-INT02']);
  });

  it('LA-STD-PRINCIPLES-R06-T04 The store refuses a fill of a record a tooling record generates: a fill is written by hand', async () => {
    const problems = await refusals(adding(complete(), { generates: [{ source_id: 'EX-LEND-TOOL01', target_id: 'EX-LEND-CMD01-H' }] }));
    expect(problems).toEqual([
      expect.objectContaining({
        rule: 'fill-is-hand-written',
        message: expect.stringContaining('EX-LEND-CMD01-H cannot fill EX-PAT-ACT-SL01: EX-LEND-TOOL01 generates it'),
      }),
    ]);
  });
});
