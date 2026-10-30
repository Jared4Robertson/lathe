// The refusals of the domain model: what the schema's constraints, the integrity queries and the aggregates' rules refuse across columns and
// tables. Each names the rule, the file and the line of the row that breaks it.
import { afterAll, describe, expect, it } from 'vitest';
import { openStore, StoreError, type Row, type StoreProblem } from '../../src/index.ts';
import { everyKind, removeData, writeData, type Data } from './fixture.ts';
import { ADD_COMMAND_HANDLER } from '../../src/authoring/command/commands/add-command-handler.ts';
import { ADD_POLICY_TEST } from '../../src/authoring/command/commands/add-policy-test.ts';
import { ADD_REPOSITORY } from '../../src/authoring/domain/commands/add-repository.ts';
import { runCommand } from '../../src/platform/commands/run.ts';
import { FOLLOW_PATTERN } from '../../src/traceability/pattern-following/commands/follow-pattern.ts';
import { CHANGE_SETTING_VALUES } from '../../src/traceability/pattern-following/commands/change-setting-values.ts';

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
  domain: [{ id: 'TL-CAT', title: 'Catalog', product_id: 'TL', subdomain_type: 'supporting', description: 'The tools the library holds.' }],
  aggregate: [{ id: 'TL-CAT-A1', title: 'Listing', domain_id: 'TL-CAT', identity: 'Listing ID', description: 'How one tool is listed.' }],
  domain_event: [{ id: 'TL-CAT-EV01', title: 'Listing changed', aggregate_id: 'TL-CAT-A1', published: false, description: 'A listing was changed.' }],
  specification: [{ id: 'TL-CAT-SP01', title: 'Listed', statement: 'A tool is listed when it has a listing.' }],
};

const merge = (...parts: Data[]): Data => {
  const out: Data = {};
  for (const part of parts) for (const [table, rows] of Object.entries(part)) out[table] = [...(out[table] ?? []), ...rows];
  return out;
};

describe('LA-STD-PRINCIPLES-R01-T01 refusals across tables: data that breaks the model is refused when it is written', () => {
  it('LA-AUT-INV08-T refuses a step fulfilling another use case\'s requirement', async () => {
    const problems = await refusal(
      adding({
        use_case: [{ id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'A member brings a tool back.' }],
        uc_requirement: [{ id: 'TL-LEND-UC02-R01', title: 'On time', use_case_id: 'TL-LEND-UC02', statement: 'A return MUST be dated.' }],
        fulfills: [{ source_id: 'TL-LEND-UC01-FL01-S01', target_id: 'TL-LEND-UC02-R01' }],
      }),
    );
    expect(problems).toEqual([expect.objectContaining({ rule: 'step-fulfills-own-use-case', file: 'data/fulfills.jsonl', line: 2 })]);
    expect(problems[0].message).toContain('cannot fulfill TL-LEND-UC02-R01, a requirement of TL-LEND-UC02');
  });

  it('LA-AUT-INV104-T refuses a second handler of a command and a second test of a policy from their commands, with command-one-each', async () => {
    const store = await openStore(writeData(everyKind()), { latheDataDir: null });
    try {
      const refused = async (definition: Parameters<typeof runCommand>[1], input: unknown) => {
        try {
          await runCommand(store, definition, input);
        } catch (error) {
          if (error instanceof StoreError) return error.problems.map((p) => ({ rule: p.rule, message: p.message }));
          throw error;
        }
        throw new Error('not refused');
      };
      expect(await refused(ADD_COMMAND_HANDLER, { id: 'TL-LEND-CMD01-H2', title: 'openLoanAgain', command_id: 'TL-LEND-CMD01', description: 'Saves it again.' })).toEqual([
        { rule: 'command-one-each', message: 'command TL-LEND-CMD01 already has its command handler, so TL-LEND-CMD01-H2 cannot be a second: a command has one' },
      ]);
      expect(await refused(ADD_POLICY_TEST, { id: 'TL-LEND-PO01-T2', title: 'Again', policy_id: 'TL-LEND-PO01', level: 'integration', state: 'automated', file: 'test/policies.test.ts', when: 'Opens a loan', then: 'Expects a reminder' })).toEqual([
        { rule: 'command-one-each', message: 'policy TL-LEND-PO01 already has its test, so TL-LEND-PO01-T2 cannot be a second: a policy has one' },
      ]);
    } finally {
      await store.close();
    }
  });

  it('LA-AUT-INV104-T refuses a policy hearing two events', async () => {
    const problems = await refusal(adding({ domain_event: [{ id: 'TL-LEND-EV02', title: 'Loan closed', aggregate_id: 'TL-LEND-A1', published: false, description: 'A tool came back.' }], hears: [{ source_id: 'TL-LEND-PO01', target_id: 'TL-LEND-EV02' }] }));
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
        domain_event: [...catalog.domain_event, { id: 'TL-LEND-EV02', title: 'Tool retired', aggregate_id: 'TL-LEND-A2', published: false, description: 'A tool left the catalog.' }],
        raises: [{ source_id: 'TL-LEND-CMD01', target_id: 'TL-LEND-EV02' }],
      }),
    );
    expect(problems.map((p) => [p.rule, p.table]).sort()).toEqual([
      ['link-scope', 'raises'],
      ['link-scope', 'reads'],
    ]);
  });

  it("refuses a domain's own table stored as a view", async () => {
    await expect(refusal(adding({ table: [{ id: 'TL-LEND-TB02', title: 'Cache', domain_id: 'TL-LEND', name: 'cache', storage: 'view' }] }))).resolves.toEqual([expect.objectContaining({ rule: 'check', table: 'table' })]);
  });

  it('refuses a query and its read model in different domains', async () => {
    const problems = await refusal(adding({ ...catalog, query: [{ id: 'TL-CAT-QRY01', title: 'List listings', read_model_id: 'TL-LEND-RM01', description: 'The listings, by title.' }] }));
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

  it('refuses a second flow for a use case through one interface', async () => {
    const problems = await refusal(adding({ flow: [{ id: 'TL-LEND-UC01-FLB', title: 'Borrow online', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF01' }] }));
    expect(problems).toEqual([expect.objectContaining({ rule: 'unique', file: 'data/flow.jsonl', line: 2 })]);
  });

  it('refuses a second invariant test for one invariant, and a second test of each exactly-one kind', async () => {
    const problems = await refusal(adding({ invariant_test: [{ id: 'TL-LEND-INV01-TB', title: 'Again', invariant_id: 'TL-LEND-INV01', level: 'unit', state: 'not automated yet', when: 'With a tool on loan, lends it again', then: 'It is refused' }] }));
    expect(problems).toEqual([expect.objectContaining({ rule: 'unique', file: 'data/invariant_test.jsonl', line: 2 })]);
    const flowTest = await refusal(adding({ flow_test: [{ id: 'TL-LEND-UC01-FL01-TB', title: 'Again', flow_id: 'TL-LEND-UC01-FL01', level: 'browser', state: 'not automated yet', steps: ['Open the catalog', 'Borrow a tool'], expected_result: 'The loan is listed.' }] }));
    expect(flowTest).toEqual([expect.objectContaining({ rule: 'unique', file: 'data/flow_test.jsonl' })]);
  });

  it('refuses a second pattern rule test for one rule in one domain', async () => {
    const problems = await refusal(adding({ pattern_rule_test: [{ id: 'TL-PAT-ACT-R01-T02', title: 'Again', pattern_rule_id: 'TL-PAT-ACT-R01', domain_id: 'TL-LEND', level: 'unit', state: 'not automated yet', when: 'Saves a record at the desk', then: 'It reads the same everywhere' }] }));
    expect(problems).toEqual([expect.objectContaining({ rule: 'unique', file: 'data/pattern_rule_test.jsonl', line: 2 })]);
  });

  it('refuses a link, or a field reference, across products', async () => {
    const other: Data = {
      product: [{ id: 'LA', title: 'Lathe', description: 'A tool for writing specs.' }],
      domain: [{ id: 'LA-AUT', title: 'Authoring', product_id: 'LA', subdomain_type: 'core', description: 'Writing the records of a spec.' }],
      aggregate: [{ id: 'LA-AUT-A1', title: 'Record', domain_id: 'LA-AUT', identity: 'Record ID', description: 'One record of a spec.' }],
      value_object: [{ id: 'LA-VO01', title: 'Record ID', description: 'The ID a record is known by.' }],
    };
    const link = await refusal(adding(merge(other, { reads: [{ source_id: 'TL-LEND-SP01', target_id: 'LA-AUT-A1' }] })));
    expect(link).toEqual([expect.objectContaining({ rule: 'link-crosses-product', table: 'reads' })]);
    const field = await refusal(adding(merge(other, { entity_field: [{ entity_id: 'TL-LEND-EN01', position: 4, name: 'Record', meaning: 'x', type_value_object_id: 'LA-VO01', required: false }] })));
    expect(field).toEqual([expect.objectContaining({ rule: 'reference-crosses-product', table: 'entity_field', file: 'data/entity_field.jsonl', line: 4 })]);
    expect(field[0].message).toContain('so its type_value_object_id cannot name LA-VO01, which is in product LA');
  });

  it('refuses a record with no owner whose prefix names no product, or no domain', async () => {
    const view = await refusal(adding({ view: [{ id: 'XX-V01', title: 'Lost', description: 'A view of no product.' }] }));
    expect(view).toEqual([expect.objectContaining({ rule: 'id-prefix', file: 'data/view.jsonl', line: 2 })]);
    expect(view[0].message).toBe("XX-V01 is a View, which has no owner: its ID starts with the ID of its product and a hyphen, but no product's ID starts it");
    const spec = await refusal(adding({ specification: [{ id: 'TL-NOPE-SP01', title: 'Lost', statement: 'Nothing.' }] }));
    expect(spec).toEqual([expect.objectContaining({ rule: 'id-prefix', file: 'data/specification.jsonl', line: 2 })]);
    // A link from it would cross products too, so the prefix rule is the one reported for a lone record.
  });

  it("LA-PLT-UC01-R13-T01 refuses an ID that does not start with its parent's or domain's ID", async () => {
    const problems = await refusal(adding({ uc_requirement: [{ id: 'TL-LEND-UC09-R01', title: 'Lost', use_case_id: 'TL-LEND-UC01', statement: 'x' }] }));
    expect(problems).toEqual([expect.objectContaining({ rule: 'id-prefix', message: 'TL-LEND-UC09-R01 is a UC requirement under TL-LEND-UC01, so its ID starts with TL-LEND-UC01-' })]);
  });

  it('refuses a step invoking two operations, or happening in two views', async () => {
    const invokes = await refusal(adding({ invokes: [{ source_id: 'TL-LEND-UC01-FL01-S01', target_id: 'TL-LEND-QRY01' }] }));
    expect(invokes).toEqual([expect.objectContaining({ rule: 'unique', table: 'invokes' })]);
    const views = await refusal(adding({ view: [{ id: 'TL-V02', title: 'Desk', description: 'The desk where tools go out.' }], happens_in: [{ source_id: 'TL-LEND-UC01-FL01-S01', target_id: 'TL-V02' }] }));
    expect(views).toEqual([expect.objectContaining({ rule: 'unique', table: 'happens_in' })]);
  });

  it('LA-VO93-C01-T refuses an entities limit below 1, or one that is not a whole number', async () => {
    const limit = (value: unknown) => {
      const data = everyKind();
      data.product_setting = [{ ...data.product_setting[0], max_entities_per_aggregate: value as Row[string] }];
      return data;
    };
    expect(await refusal(limit(0))).toEqual([expect.objectContaining({ rule: 'check', table: 'product_setting' })]);
    expect(await refusal(limit(2.5))).toEqual([expect.objectContaining({ table: 'product_setting' })]);
    await loads(limit(1));
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

  it('LA-AUT-INV41-T refuses a second repository for one aggregate, a second aggregate for one repository, and a second repository of one identifier', async () => {
    const second = adding({
      repository: [{ id: 'TL-LEND-REPO02', title: 'LoanStore', domain_id: 'TL-LEND', file: 'src/lending/loans.ts', description: 'Keeps loans in a second table.' }],
      persists: [{ source_id: 'TL-LEND-REPO02', target_id: 'TL-LEND-A1' }],
    });
    expect(await refusal(second)).toEqual([
      expect.objectContaining({ rule: 'unique', file: 'data/persists.jsonl', line: 2, message: expect.stringContaining('has the same target_id as persists') }),
    ]);
    // The same identifier in the same file is a second record of one piece of code.
    const same = adding({ repository: [{ id: 'TL-LEND-REPO02', title: 'LoanRepository', domain_id: 'TL-LEND', file: 'src/lending/loans.ts', description: 'Keeps loans in the loans table.' }] });
    expect((await refusal(same)).map((p) => [p.rule, p.key]).sort()).toEqual([
      ['title-unique', 'TL-LEND-REPO01'],
      ['title-unique', 'TL-LEND-REPO02'],
    ]);
    // A repository persists one aggregate, of its domain or another.
    expect(await refusal(adding({ ...catalog, persists: [{ source_id: 'TL-LEND-REPO01', target_id: 'TL-CAT-A1' }] }))).toEqual([
      expect.objectContaining({ rule: 'unique', file: 'data/persists.jsonl', line: 2, message: expect.stringContaining('has the same source_id as persists') }),
    ]);
    // The Domain aggregate's own rule refuses the command that would add a second repository for one aggregate.
    const store = await openStore(writeData(everyKind()));
    try {
      await runCommand(store, ADD_REPOSITORY, { id: 'TL-LEND-REPO02', title: 'LoanStore', domain_id: 'TL-LEND', file: 'src/lending/store.ts', description: 'Keeps loans in a second table.', persists: 'TL-LEND-A1' });
      throw new Error('The second repository was added.');
    } catch (error) {
      if (!(error instanceof StoreError)) throw error;
      expect(error.problems).toEqual([expect.objectContaining({ rule: 'one-repository', table: 'repository', message: 'TL-LEND-REPO01 and TL-LEND-REPO02 both persist TL-LEND-A1: an aggregate has one repository' })]);
    } finally {
      await store.close();
    }
  });

  it('LA-STD-MODELING-R04-T01 refuses a title another record of its kind and product has, or one ending with a period', async () => {
    await loads(everyKind());
    const twice = adding({ aggregate: [{ id: 'TL-LEND-A9', title: ' loan ', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member.' }] });
    const found = await refusal(twice);
    expect(found.map((p) => [p.rule, p.key]).sort()).toEqual([
      ['title-unique', 'TL-LEND-A1'],
      ['title-unique', 'TL-LEND-A9'],
    ]);
    expect(found.find((p) => p.key === 'TL-LEND-A9')?.message).toBe(
      'Aggregate TL-LEND-A9 is titled "loan", as is TL-LEND-A1 in product TL; give each aggregate a title of its own',
    );
    // A record of another kind may share the title: the aggregate Loan's root entity is Loan too.
    expect(everyKind().entity.find((e) => e.id === 'TL-LEND-EN01')?.title).toBe('Loan');
    const period = everyKind();
    period.invariant[0] = { ...period.invariant[0], title: 'One active loan per tool.' };
    expect(await refusal(period)).toEqual([expect.objectContaining({ rule: 'title-period', file: 'data/invariant.jsonl', line: 1 })]);
  });

  it('LA-STD-MODELING-R09-T01 refuses a code-bound title that is not one identifier, and an endpoint not titled by its method and route', async () => {
    const spaced = everyKind();
    spaced.command_handler[0] = { ...spaced.command_handler[0], title: 'the loan opener' };
    spaced.table[1] = { ...spaced.table[1], title: 'Loans by member' };
    const found = await refusal(spaced);
    expect(found.map((p) => [p.rule, p.table])).toEqual([
      ['title-form', 'command_handler'],
      ['title-form', 'table'],
    ]);
    expect(found[0].message).toBe(
      'Command handler TL-LEND-CMD01-H is titled "the loan opener", but a command handler is titled by one identifier exactly as in code, with no whitespace, such as LoanRow; put the explanation in its description',
    );
    const endpoint = everyKind();
    endpoint.endpoint[0] = { ...endpoint.endpoint[0], title: 'Borrow a tool' };
    expect(await refusal(endpoint)).toEqual([expect.objectContaining({ rule: 'check', table: 'endpoint' })]);
    // Code compares exactly: a table and a type may differ only in letter case.
    const cased = everyKind();
    cased.data_model.push({ id: 'TL-LEND-EN02-DM', title: 'loan', entity_id: 'TL-LEND-EN02' });
    await loads(cased);
  });

  it("LA-STD-MODELING-R10-T02 refuses a product kind whose lead text is optional, or which has two", async () => {
    const optional = everyKind();
    optional.product_kind_field.push({ kind: 'cli_command', position: 2, name: 'description', type: 'text', required: false, description: 'What it does.' });
    expect(await refusal(optional)).toEqual([
      expect.objectContaining({ rule: 'product-kind', table: 'product_kind_field', message: expect.stringContaining('The field description of cli_command is its lead text, so it must be required') }),
    ]);
    const two = everyKind();
    two.product_kind_field.push(
      { kind: 'cli_command', position: 2, name: 'description', type: 'text', required: true, description: 'What it does.' },
      { kind: 'cli_command', position: 3, name: 'statement', type: 'text', required: true, description: 'What it must do.' },
    );
    expect(await refusal(two)).toEqual([
      expect.objectContaining({ rule: 'product-kind', table: 'product_kind_field', message: expect.stringContaining('The field statement of cli_command is a second lead text, after description') }),
    ]);
    const one = everyKind();
    one.product_kind_field.push({ kind: 'cli_command', position: 2, name: 'description', type: 'text', required: true, description: 'What it does.' });
    one.cli_command[0] = { ...one.cli_command[0], description: 'Borrows the tool named.' };
    await loads(one);
  });

  it('LA-TRC-INV03-T refuses a setting value for a setting its pattern lacks, or for a pattern its follower does not follow', async () => {
    // Through the Pattern following commands, with setting-value-of-followed-setting, changing nothing.
    const store = await openStore(writeData(everyKind()), { latheDataDir: null });
    try {
      const refused = async (definition: typeof FOLLOW_PATTERN | typeof CHANGE_SETTING_VALUES, input: unknown) => {
        const error = await runCommand(store, definition as never, input).then(() => null, (e: unknown) => e);
        expect(error).toBeInstanceOf(StoreError);
        return (error as StoreError).problems.map((p) => [p.rule, p.message]);
      };
      expect(await refused(CHANGE_SETTING_VALUES, { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT', setting_values: [{ setting: 'record', value: 'Tool' }, { setting: 'colour', value: 'Red' }] })).toEqual([
        ['setting-value-of-followed-setting', 'TL-PAT-ACT has no setting colour, so TL-LEND-UC01 cannot give it a value'],
      ]);
      expect(await refused(FOLLOW_PATTERN, { follower_id: 'TL-LEND', pattern_id: 'TL-PAT-ACT', setting_values: [{ setting: 'size', value: 'Large' }] })).toEqual([
        ['setting-value-of-followed-setting', 'TL-PAT-ACT has no setting size, so TL-LEND cannot give it a value'],
      ]);
      expect(store.rows('follows')).toHaveLength(1);
      expect(store.rows('setting_value')).toHaveLength(1);
    } finally {
      await store.close();
    }
    // Written into the files with its follows link gone, the value is refused when the data loads, by the key under the rule.
    expect(await refusal({ ...everyKind(), follows: [] })).toEqual([expect.objectContaining({ rule: 'foreign-key', file: 'data/setting_value.jsonl', line: 1 })]);
  });
});
