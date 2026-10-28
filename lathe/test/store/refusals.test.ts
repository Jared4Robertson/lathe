// The refusals of the domain model: what the schema's constraints and the validation queries refuse across columns and
// tables. Each names the rule, the file and the line of the row that breaks it.
import { afterAll, describe, expect, it } from 'vitest';
import { openStore, StoreError, type Row, type StoreProblem } from '../../src/index.ts';
import { everyKind, removeData, writeData, type Data } from './fixture.ts';

afterAll(removeData);

// Loads the data and returns the problems it is refused with.
async function refusal(data: Data): Promise<StoreProblem[]> {
  try {
    const opened = await openStore(writeData(data));
    await opened.close();
  } catch (error) {
    if (error instanceof StoreError) return error.problems;
    throw error;
  }
  throw new Error('The data loaded, but it should have been refused.');
}

async function loads(data: Data): Promise<void> {
  const opened = await openStore(writeData(data));
  await opened.close();
}

// The fixture with rows added to some tables.
function adding(rows: Data): Data {
  const data = everyKind();
  for (const [table, added] of Object.entries(rows)) data[table] = [...(data[table] ?? []), ...added];
  return data;
}

// A second domain of the same product, with an aggregate, an unpublished event and a specification.
const catalog: Data = {
  domain: [{ id: 'TL-CAT', title: 'Catalog', product_id: 'TL', subdomain_type: 'supporting' }],
  aggregate: [{ id: 'TL-CAT-A1', title: 'Listing', domain_id: 'TL-CAT' }],
  domain_event: [{ id: 'TL-CAT-EV01', title: 'Listing changed', aggregate_id: 'TL-CAT-A1', published: false }],
  specification: [{ id: 'TL-CAT-SP01', title: 'Listed', statement: 'A tool is listed when it has a listing.' }],
};

const merge = (...parts: Data[]): Data => {
  const out: Data = {};
  for (const part of parts) for (const [table, rows] of Object.entries(part)) out[table] = [...(out[table] ?? []), ...rows];
  return out;
};

describe('refusals across tables', () => {
  it('LA-AUT-INV08-T refuses a step fulfilling another use case\'s requirement', async () => {
    const problems = await refusal(
      adding({
        use_case: [{ id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01' }],
        uc_requirement: [{ id: 'TL-LEND-UC02-R01', title: 'On time', use_case_id: 'TL-LEND-UC02', statement: 'A return MUST be dated.' }],
        fulfills: [{ source_id: 'TL-LEND-UC01-FL-S01', target_id: 'TL-LEND-UC02-R01' }],
      }),
    );
    expect(problems).toEqual([expect.objectContaining({ rule: 'step-fulfills-own-use-case', file: 'data/fulfills.jsonl', line: 2 })]);
    expect(problems[0].message).toContain('cannot fulfill TL-LEND-UC02-R01, a requirement of TL-LEND-UC02');
  });

  it("LA-AUT-SP10-T refuses a policy hearing another domain's unpublished event, and lets it hear a published one", async () => {
    const data = adding(catalog);
    data.hears = [{ source_id: 'TL-LEND-PO01', target_id: 'TL-CAT-EV01' }];
    const problems = await refusal(data);
    expect(problems).toEqual([expect.objectContaining({ rule: 'policy-hears-published', file: 'data/hears.jsonl', line: 1 })]);
    expect(problems[0].message).toContain('an event of domain TL-CAT that is not published');
    data.domain_event = data.domain_event.map((e) => (e.id === 'TL-CAT-EV01' ? { ...e, published: true } : e));
    await loads(data);
  });

  it('LA-AUT-INV10-T refuses a policy hearing two events', async () => {
    const problems = await refusal(adding({ domain_event: [{ id: 'TL-LEND-EV02', title: 'Loan closed', aggregate_id: 'TL-LEND-A1', published: false }], hears: [{ source_id: 'TL-LEND-PO01', target_id: 'TL-LEND-EV02' }] }));
    expect(problems).toEqual([expect.objectContaining({ rule: 'unique', file: 'data/hears.jsonl' })]);
  });

  it('LA-AUT-SP09-T refuses a command and a specification in different domains', async () => {
    const problems = await refusal(adding(merge(catalog, { reads: [{ source_id: 'TL-CAT-SP01', target_id: 'TL-CAT-A1' }], checks: [{ source_id: 'TL-LEND-CMD01', target_id: 'TL-CAT-SP01' }] })));
    expect(problems).toEqual([expect.objectContaining({ rule: 'link-scope', file: 'data/checks.jsonl', line: 2 })]);
    expect(problems[0].message).toBe('TL-LEND-CMD01 is in domain TL-LEND, so it cannot checks TL-CAT-SP01, which is in domain TL-CAT: checks links records of one domain');
  });

  it("refuses a specification reading another domain's aggregate, and a command raising another aggregate's event", async () => {
    const problems = await refusal(
      adding({
        ...catalog,
        reads: [{ source_id: 'TL-LEND-SP01', target_id: 'TL-CAT-A1' }],
        domain_event: [...catalog.domain_event, { id: 'TL-LEND-EV02', title: 'Tool retired', aggregate_id: 'TL-LEND-A2', published: false }],
        raises: [{ source_id: 'TL-LEND-CMD01', target_id: 'TL-LEND-EV02' }],
      }),
    );
    expect(problems.map((p) => [p.rule, p.table]).sort()).toEqual([
      ['link-scope', 'raises'],
      ['link-scope', 'reads'],
    ]);
  });

  it("LA-AUT-INV11-T records another aggregate of the command's domain, and refuses its own aggregate or another domain's", async () => {
    const reason = 'The tool must never show as lent without its loan.';
    await loads(everyKind());
    const problems = await refusal(
      adding({
        ...catalog,
        command_change: [
          { command_id: 'TL-LEND-CMD01', aggregate_id: 'TL-LEND-A1', reason },
          { command_id: 'TL-LEND-CMD01', aggregate_id: 'TL-CAT-A1', reason },
        ],
      }),
    );
    expect(problems.map((p) => p.rule)).toEqual(['command-change-in-domain', 'command-change-in-domain']);
  });

  it("refuses a read model fed by another domain's unpublished event, and a domain's table stored as a view", async () => {
    const problems = await refusal(
      adding({
        ...catalog,
        fed_by: [{ source_id: 'TL-LEND-RM01', target_id: 'TL-CAT-EV01' }],
      }),
    );
    expect(problems.map((p) => p.rule)).toEqual(['read-model-fed-by-published']);
    await expect(refusal(adding({ table: [{ id: 'TL-LEND-TB02', title: 'Cache', domain_id: 'TL-LEND', name: 'cache', storage: 'view' }] }))).resolves.not.toEqual([]);
  });

  it('refuses a query and its read model in different domains', async () => {
    const problems = await refusal(adding({ ...catalog, query: [{ id: 'TL-CAT-QRY01', title: 'List listings', read_model_id: 'TL-LEND-RM01' }] }));
    expect(problems).toEqual([expect.objectContaining({ rule: 'id-prefix', file: 'data/query.jsonl', line: 2, key: 'TL-CAT-QRY01' })]);
    expect(problems[0].message).toBe('TL-CAT-QRY01 is a Query in domain TL-LEND, so its ID starts with TL-LEND-');
  });

  it('refuses an endpoint or a table with both parents or neither', async () => {
    // The endpoint is under its command, and the read model's table (row 2) under its read model.
    for (const [table, at, parent, both] of [
      ['endpoint', 0, 'command_id', { query_id: 'TL-LEND-QRY01' }],
      ['table', 1, 'read_model_id', { entity_id: 'TL-LEND-EN02' }],
    ] as const) {
      const data = everyKind();
      data[table][at] = { ...data[table][at], ...both };
      expect(await refusal(data), `${table} with both`).toEqual([expect.objectContaining({ rule: 'check', file: `data/${table}.jsonl`, line: at + 1 })]);
      const { [parent]: _dropped, ...neither } = everyKind()[table][at];
      data[table][at] = neither;
      expect(await refusal(data), `${table} with neither`).toEqual([expect.objectContaining({ rule: 'check', file: `data/${table}.jsonl`, line: at + 1 })]);
    }
  });

  it('refuses a second flow for a use case', async () => {
    const problems = await refusal(adding({ flow: [{ id: 'TL-LEND-UC01-FLB', title: 'Borrow online', use_case_id: 'TL-LEND-UC01' }] }));
    expect(problems).toEqual([expect.objectContaining({ rule: 'unique', file: 'data/flow.jsonl', line: 2 })]);
  });

  it('refuses a second invariant test for one invariant, and a second test of each exactly-one kind', async () => {
    const problems = await refusal(adding({ invariant_test: [{ id: 'TL-LEND-INV01-TB', title: 'Again', invariant_id: 'TL-LEND-INV01', level: 'unit', state: 'not automated yet' }] }));
    expect(problems).toEqual([expect.objectContaining({ rule: 'unique', file: 'data/invariant_test.jsonl', line: 2 })]);
    const flowTest = await refusal(adding({ flow_test: [{ id: 'TL-LEND-UC01-FL-TB', title: 'Again', flow_id: 'TL-LEND-UC01-FL', level: 'e2e-ui', state: 'not automated yet' }] }));
    expect(flowTest).toEqual([expect.objectContaining({ rule: 'unique', file: 'data/flow_test.jsonl' })]);
  });

  it('refuses a second pattern rule test for one rule in one domain', async () => {
    const problems = await refusal(adding({ pattern_rule_test: [{ id: 'TL-PAT-ACT-R01-T02', title: 'Again', pattern_rule_id: 'TL-PAT-ACT-R01', domain_id: 'TL-LEND', level: 'unit', state: 'not automated yet' }] }));
    expect(problems).toEqual([expect.objectContaining({ rule: 'unique', file: 'data/pattern_rule_test.jsonl', line: 2 })]);
  });

  it('LA-AUT-INV15-T refuses a field with two types, or none', async () => {
    for (const table of ['entity_field', 'value_object_field', 'event_field', 'read_model_field']) {
      const data = everyKind();
      const { type: _t, type_value_object_id: _v, type_aggregate_id: _a, ...bare } = data[table][0];
      data[table][0] = { ...bare, type: 'text', type_aggregate_id: 'TL-LEND-A2' };
      expect(await refusal(data), table).toEqual([expect.objectContaining({ rule: 'check', table })]);
      data[table][0] = bare;
      expect(await refusal(data), `${table} with none`).toEqual([expect.objectContaining({ rule: 'check', table })]);
    }
  });

  it('refuses a link, or a field reference, across products', async () => {
    const other: Data = {
      product: [{ id: 'LA', title: 'Lathe' }],
      domain: [{ id: 'LA-AUT', title: 'Authoring', product_id: 'LA', subdomain_type: 'core' }],
      aggregate: [{ id: 'LA-AUT-A1', title: 'Record', domain_id: 'LA-AUT' }],
      value_object: [{ id: 'LA-VO01', title: 'Record ID' }],
    };
    const link = await refusal(adding(merge(other, { reads: [{ source_id: 'TL-LEND-SP01', target_id: 'LA-AUT-A1' }] })));
    expect(link).toEqual([expect.objectContaining({ rule: 'link-crosses-product', table: 'reads' })]);
    const field = await refusal(adding(merge(other, { entity_field: [{ entity_id: 'TL-LEND-EN01', position: 4, name: 'Record', meaning: 'x', type_value_object_id: 'LA-VO01', required: false }] })));
    expect(field).toEqual([expect.objectContaining({ rule: 'reference-crosses-product', table: 'entity_field', file: 'data/entity_field.jsonl', line: 4 })]);
    expect(field[0].message).toContain('so its type_value_object_id cannot name LA-VO01, which is in product LA');
  });

  it('refuses a record with no owner whose prefix names no product, or no domain', async () => {
    const view = await refusal(adding({ view: [{ id: 'XX-V01', title: 'Lost' }] }));
    expect(view).toEqual([expect.objectContaining({ rule: 'id-prefix', file: 'data/view.jsonl', line: 2 })]);
    expect(view[0].message).toBe("XX-V01 is a View, which has no owner: its ID starts with the ID of its product and a hyphen, but no product's ID starts it");
    const spec = await refusal(adding({ specification: [{ id: 'TL-NOPE-SP01', title: 'Lost', statement: 'Nothing.' }] }));
    expect(spec).toEqual([expect.objectContaining({ rule: 'id-prefix', file: 'data/specification.jsonl', line: 2 })]);
    // A link from it would cross products too, so the prefix rule is the one reported for a lone record.
  });

  it("LA-AUT-SP06-T refuses an ID that does not start with its parent's or domain's ID", async () => {
    const problems = await refusal(adding({ uc_requirement: [{ id: 'TL-LEND-UC09-R01', title: 'Lost', use_case_id: 'TL-LEND-UC01', statement: 'x' }] }));
    expect(problems).toEqual([expect.objectContaining({ rule: 'id-prefix', message: 'TL-LEND-UC09-R01 is a UC requirement under TL-LEND-UC01, so its ID starts with TL-LEND-UC01-' })]);
  });

  it('LA-AUT-INV12-T refuses an aggregate with two roots, but not one with none', async () => {
    const data = everyKind();
    data.entity[1] = { id: 'TL-LEND-EN02', title: 'Return', aggregate_id: 'TL-LEND-A1', role: 'root' };
    expect(await refusal(data)).toEqual([expect.objectContaining({ rule: 'aggregate-root', key: 'TL-LEND-A1' })]);
    await loads(adding({ entity: [{ id: 'TL-LEND-EN03', title: 'Repair', aggregate_id: 'TL-LEND-A2', role: 'child' }] }));
  });

  it("LA-AUT-INV13-T refuses a table for an entity stored in its root's table, a root stored in a root table, and an entity's table that is a view", async () => {
    const own = await refusal(adding({ table: [{ id: 'TL-LEND-EN02-TB', title: 'Returns', entity_id: 'TL-LEND-EN02', name: 'returns', storage: 'table' }] }));
    expect(own).toEqual([expect.objectContaining({ rule: 'entity-table', key: 'TL-LEND-EN02-TB' })]);
    const data = everyKind();
    data.entity[0] = { ...data.entity[0], in_root_table: true };
    expect(await refusal(data)).toEqual([expect.objectContaining({ rule: 'check', table: 'entity' })]);
    const view = everyKind();
    view.table[0] = { ...view.table[0], storage: 'view' };
    expect(await refusal(view)).toEqual([expect.objectContaining({ rule: 'check', table: 'table' })]);
  });

  it("LA-AUT-INV14-T refuses a table's second primary key, a foreign key to another domain's table, and a key's misplaced parts", async () => {
    const two = await refusal(adding({ table_key: [{ table_id: 'TL-LEND-EN01-TB', position: 3, type: 'primary', columns: ['tool_id'] }] }));
    expect(two).toEqual([expect.objectContaining({ rule: 'one-primary-key', key: 'TL-LEND-EN01-TB' })]);
    const crossing = await refusal(
      adding({
        ...catalog,
        entity: [{ id: 'TL-CAT-EN01', title: 'Listing', aggregate_id: 'TL-CAT-A1', role: 'root' }],
        table: [{ id: 'TL-CAT-EN01-TB', title: 'Listings', entity_id: 'TL-CAT-EN01', name: 'listings', storage: 'table' }],
        table_key: [{ table_id: 'TL-CAT-EN01-TB', position: 1, type: 'foreign', columns: ['loan_id'], target_table_id: 'TL-LEND-EN01-TB' }],
      }),
    );
    expect(crossing).toEqual([expect.objectContaining({ rule: 'foreign-key-crosses-domain', table: 'table_key' })]);
    for (const bad of [
      { type: 'index', columns: ['id'], condition: 'x IS NULL' },
      { type: 'primary', columns: ['id'], invariant_id: 'TL-LEND-INV01' },
      { type: 'foreign', columns: ['id'] },
      { type: 'index', columns: ['id'], target_table_id: 'TL-LEND-RM01-TB' },
    ] as Row[]) {
      const data = everyKind();
      data.table_key[0] = { table_id: 'TL-LEND-EN01-TB', position: 1, ...bad };
      expect(await refusal(data), JSON.stringify(bad)).toEqual([expect.objectContaining({ rule: 'check', table: 'table_key' })]);
    }
  });

  it('refuses a step invoking two operations, or happening in two views', async () => {
    const invokes = await refusal(adding({ invokes: [{ source_id: 'TL-LEND-UC01-FL-S01', target_id: 'TL-LEND-QRY01' }] }));
    expect(invokes).toEqual([expect.objectContaining({ rule: 'unique', table: 'invokes' })]);
    const views = await refusal(adding({ view: [{ id: 'TL-V02', title: 'Desk' }], happens_in: [{ source_id: 'TL-LEND-UC01-FL-S01', target_id: 'TL-V02' }] }));
    expect(views).toEqual([expect.objectContaining({ rule: 'unique', table: 'happens_in' })]);
  });

  it('LA-VO14-C03-T refuses an automated test with no file', async () => {
    const data = everyKind();
    const { file: _file, ...noFile } = data.invariant_test[0];
    data.invariant_test[0] = noFile;
    expect(await refusal(data)).toEqual([expect.objectContaining({ rule: 'check', table: 'invariant_test' })]);
  });

  it('LA-VO14-C04-T refuses a manual test with no reason, and a reason on a test that is not manual', async () => {
    const manual = everyKind();
    const { manual_reason: _reason, ...noReason } = manual.integration_test[0];
    manual.integration_test[0] = noReason;
    expect(await refusal(manual)).toEqual([expect.objectContaining({ rule: 'check', table: 'integration_test' })]);
    const reason = everyKind();
    reason.invariant_test[0] = { ...reason.invariant_test[0], manual_reason: 'Why not.' };
    expect(await refusal(reason)).toEqual([expect.objectContaining({ rule: 'check', table: 'invariant_test' })]);
  });

  it('refuses a question under both its product and a domain', async () => {
    const data = everyKind();
    data.question[0] = { ...data.question[0], product_id: 'TL' };
    expect(await refusal(data)).toEqual([expect.objectContaining({ rule: 'check', table: 'question' })]);
  });

  it('LA-TRC-UC04-R06-T02 refuses a pattern rule naming a setting its pattern lacks', async () => {
    const data = everyKind();
    data.pattern_rule[0] = { ...data.pattern_rule[0], setting: 'tone' };
    expect(await refusal(data)).toEqual([expect.objectContaining({ rule: 'foreign-key', file: 'data/pattern_rule.jsonl', line: 1 })]);
  });

  it('LA-TRC-INV03-T refuses a setting value for a pattern its follower does not follow', async () => {
    expect(await refusal({ ...everyKind(), follows: [] })).toEqual([expect.objectContaining({ rule: 'foreign-key', file: 'data/setting_value.jsonl', line: 1 })]);
  });
});
