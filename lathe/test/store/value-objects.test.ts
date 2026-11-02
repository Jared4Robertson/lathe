// The constraints of Lathe's value objects (LA-VO01 ... LA-VO17): each loads the fixture through the store with a
// bad value, which is refused, and with the good values, which load. Lathe's checks on column values live in two
// places: the row checks of src/platform/data/rows.ts, made before the database sees a row, and the CHECKs and ENUM types of
// schema/*.sql, which the database enforces.
import { afterAll, describe, expect, it } from 'vitest';
import type { Row, StoreProblem } from '../../src/index.ts';
import { refusals } from '../helpers.ts';
import { everyKind, removeData, type Data } from './fixture.ts';

afterAll(removeData);

/** The fixture with one table's first row changed; a change to undefined leaves the column out. */
function firstRow(table: string, changes: Record<string, Row[string] | undefined>, data: Data = everyKind()): Data {
  const row = Object.fromEntries(Object.entries({ ...data[table][0], ...changes }).filter(([, v]) => v !== undefined)) as Row;
  return { ...data, [table]: [row, ...data[table].slice(1)] };
}

/** The fixture with rows added to some tables. */
function adding(rows: Data): Data {
  const data = everyKind();
  for (const [table, added] of Object.entries(rows)) data[table] = [...(data[table] ?? []), ...added];
  return data;
}

/** The one problem a refusal names, with its rule and table. */
const one = (rule: string, table: string, extra: Partial<StoreProblem> = {}) => [expect.objectContaining({ rule, table, ...extra })];

/** The refusal an enum's column gives a value it does not have. */
const notOneOf = (table: string, column: string, value: string, values: string[]) =>
  one('column', table, { file: `data/${table}.jsonl`, line: 1, message: `${table}.${column} ${JSON.stringify(value)} is not one of ${values.join(', ')}` });

describe("Lathe's value objects", () => {
  it('LA-VO01-C01-T A record ID that does not match the ID pattern is refused by the registry, naming the ID', async () => {
    for (const id of ['TL-v01', 'tl-V01', '1TL-V01', 'TL--V01', 'TL-V01-', 'TL-V 01', 'TL_V01']) {
      const problems = await refusals(firstRow('view', { id }));
      expect(problems, id).toEqual(one('check', 'record_id', { key: id }));
      expect(problems[0].message, id).toContain(`record_id ${id} breaks a rule of its table`);
    }
    // Capitals and digits in parts joined by hyphens, of any number of parts.
    expect(await refusals(adding({ view: [{ id: 'TL-V2B', title: 'Desk', description: 'The desk where tools go out.' }], integration: [{ id: 'TL-INT02', title: 'Payments', description: 'Fees members pay.' }] }))).toEqual([]);
  });

  it('LA-VO02-C01-T An empty or blank title is refused, and a missing one is required', async () => {
    for (const title of ['', ' ', '   \t']) {
      expect(await refusals(firstRow('view', { title })), JSON.stringify(title)).toEqual(
        one('column', 'view', { file: 'data/view.jsonl', line: 1, message: `view.title ${JSON.stringify(title)} is empty; leave the column out instead` }),
      );
    }
    expect(await refusals(firstRow('use_case', { title: undefined }))).toEqual(one('required', 'use_case', { message: 'use_case.title is required' }));
    expect(await refusals(firstRow('view', { title: ' Catalog ' }))).toEqual([]);
  });

  it('LA-VO03-C01-T An empty or blank statement is refused, and a missing one is required', async () => {
    for (const statement of ['', '  ']) {
      expect(await refusals(firstRow('invariant', { statement })), JSON.stringify(statement)).toEqual(
        one('column', 'invariant', { file: 'data/invariant.jsonl', line: 1, message: `invariant.statement ${JSON.stringify(statement)} is empty; leave the column out instead` }),
      );
    }
    expect(await refusals(firstRow('uc_requirement', { statement: undefined }))).toEqual(one('required', 'uc_requirement', { message: 'uc_requirement.statement is required' }));
  });

  it('LA-VO04-C01-T A position that is not a whole number from 1 is refused', async () => {
    for (const position of [1.5, '1', true]) {
      expect(await refusals(firstRow('capability', { position })), JSON.stringify(position)).toEqual(
        one('column', 'capability', { file: 'data/capability.jsonl', line: 1, message: expect.stringContaining('is not a whole number') }),
      );
    }
    for (const position of [0, -1]) {
      const problems = await refusals(firstRow('capability', { position }));
      expect(problems, String(position)).toEqual(one('check', 'capability', { file: 'data/capability.jsonl', line: 1 }));
      expect(problems[0].message).toContain('position" >= 1');
    }
    expect(await refusals(firstRow('flow_step', { position: 0 }))).toEqual(one('check', 'flow_step'));
    expect(await refusals(firstRow('capability', { position: 7 }))).toEqual([]);
  });

  it("LA-VO05-C01-T An empty or blank flow step's path is refused", async () => {
    for (const path of ['', '  ']) {
      expect(await refusals(firstRow('flow_step', { path })), JSON.stringify(path)).toEqual(
        one('column', 'flow_step', { file: 'data/flow_step.jsonl', line: 1, message: `flow_step.path ${JSON.stringify(path)} is empty; leave the column out instead` }),
      );
    }
    expect(await refusals(firstRow('flow_step', { path: 'tool on loan' }))).toEqual([]);
  });

  it('LA-VO06-C01-T An identifier that is not lower-case letters, digits and underscores from a letter is refused', async () => {
    const bad = ['Record', 'record-id', '1record', '_record', 'record id'];
    for (const name of bad) {
      expect(await refusals(withSetting(name)), name).toEqual(
        one('check', 'pattern_setting', { file: 'data/pattern_setting.jsonl', line: 1, message: expect.stringContaining("regexp_full_match") }),
      );
    }
    // A product kind's name, its field's name and a product relation's name are identifiers too.
    const kindless = (): Data => ({ ...everyKind(), cli_command: [], documents: [] });
    // A declaration's bad name is refused by its table's check, or by the meta-model's when the store declares it.
    const byNameCheck = [expect.objectContaining({ message: expect.stringMatching(/CHECK constraint failed .*regexp_full_match\("name", '\[a-z\]\[a-z0-9_\]\*'\)/) })];
    expect(await refusals(firstRow('product_kind_field', { name: 'Usage' }, kindless()))).toEqual(byNameCheck);
    expect(await refusals(firstRow('product_relation', { name: 'Documents' }, kindless()))).toEqual(byNameCheck);
    const renamed = kindless();
    renamed.product_kind = [{ ...renamed.product_kind[0], name: 'CliCommand' }];
    renamed.product_kind_field = [{ ...renamed.product_kind_field[0], kind: 'CliCommand' }];
    renamed.product_relation = [{ ...renamed.product_relation[0], source_kind: 'CliCommand' }];
    expect(await refusals(renamed)).toEqual(byNameCheck);
    expect(await refusals(withSetting('record_2'))).toEqual([]);
  });

  it('LA-VO07-C01-T A subdomain type other than core, supporting or generic is refused', async () => {
    expect(await refusals(firstRow('domain', { subdomain_type: 'Core' }))).toEqual(notOneOf('domain', 'subdomain_type', 'Core', ['core', 'supporting', 'generic']));
    expect(
      await refusals(
        adding({
          domain: [
            { id: 'TL-CAT', title: 'Catalog', product_id: 'TL', position: 2, subdomain_type: 'supporting', description: 'The tools the library holds.' },
            { id: 'TL-MAIL', title: 'Mail', product_id: 'TL', position: 3, subdomain_type: 'generic', description: 'Mail sent to members.' },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("LA-VO08-C01-T An entity's role other than root or child, or none, is refused", async () => {
    expect(await refusals(firstRow('entity', { role: 'leaf' }))).toEqual(notOneOf('entity', 'role', 'leaf', ['root', 'child']));
    expect(await refusals(firstRow('entity', { role: undefined }))).toEqual(one('required', 'entity', { message: 'entity.role is required' }));
    // The fixture's root and child load.
    expect(await refusals(everyKind())).toEqual([]);
  });

  it('LA-VO09-C01-T A basic type other than the seven is refused', async () => {
    const types = ['text', 'whole number', 'decimal', 'date', 'time', 'date and time', 'yes/no'];
    expect(await refusals(firstRow('read_model_field', { type: 'integer' }))).toEqual(notOneOf('read_model_field', 'type', 'integer', types));
    expect(await refusals(firstRow('value_object_field', { type: 'boolean' }))).toEqual(notOneOf('value_object_field', 'type', 'boolean', types));
    const fields = types.map((type, i) => ({ read_model_id: 'TL-LEND-RM01', position: i + 2, name: `Field ${i + 2}`, meaning: `A ${type}.`, type, required: false }));
    expect(await refusals(adding({ read_model_field: fields }))).toEqual([]);
  });

  it('LA-VO10-C01-T A table storage other than the six (table, view, materialized view, browser storage, file, in memory) is refused', async () => {
    const storages = ['table', 'view', 'materialized view', 'browser storage', 'file', 'in memory'];
    expect(await refusals(firstRow('table', { storage: 'index' }))).toEqual(notOneOf('table', 'storage', 'index', storages));
    for (const storage of storages.slice(2)) {
      expect(
        await refusals(
          adding({
            read_model: [{ id: 'TL-LEND-RM02', title: 'Overdue loans', domain_id: 'TL-LEND', description: 'The loans past their due date.' }],
            table: [{ id: 'TL-LEND-RM02-TB', title: 'overdue_loans', read_model_id: 'TL-LEND-RM02', name: 'overdue_loans', storage }],
          }),
        ),
        storage,
      ).toEqual([]);
    }
  });

  it("LA-VO11-C01-T A key type other than primary, unique, foreign or index is refused", async () => {
    expect(await refusals(firstRow('table_key', { type: 'check' }))).toEqual(notOneOf('table_key', 'type', 'check', ['primary', 'unique', 'foreign', 'index']));
    expect(await refusals(adding({ table_key: [{ table_id: 'TL-LEND-EN01-TB', position: 3, type: 'index', columns: ['tool_id'] }] }))).toEqual([]);
  });

  it("LA-VO12-C01-T An endpoint's method that is not an HTTP method is refused", async () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    for (const method of ['post', 'TRACE']) {
      expect(await refusals(firstRow('endpoint', { method })), method).toEqual(notOneOf('endpoint', 'method', method, methods));
    }
    const endpoints = methods.map((method, i) => ({ id: `TL-LEND-EP0${i + 2}`, title: `${method} /loans/${i}`, command_id: 'TL-LEND-CMD01', method, route: `/loans/${i}`, description: `Answers ${method} on a loan.` }));
    expect(await refusals(adding({ endpoint: endpoints }))).toEqual([]);
  });

  it("LA-VO13-C01-T An event type's delivery other than in process or outbox is refused", async () => {
    expect(await refusals(firstRow('event_type', { delivery: 'queue' }))).toEqual(notOneOf('event_type', 'delivery', 'queue', ['in process', 'outbox']));
    expect(
      await refusals(
        adding({
          domain_event: [{ id: 'TL-LEND-EV02', title: 'Loan closed', aggregate_id: 'TL-LEND-A1', published: false, description: 'A tool came back.' }],
          event_type: [{ id: 'TL-LEND-EV02-ET', title: 'LoanClosed', domain_event_id: 'TL-LEND-EV02', delivery: 'in process' }],
        }),
      ),
    ).toEqual([]);
  });

  const levels = ['unit', 'integration', 'service', 'system', 'browser'];
  const states = ['automated', 'manual', 'not automated yet'];

  it("LA-VO14-C01-T A test's level other than the five is refused", async () => {
    // The old names are refused like any other: e2e-ui, manual.
    for (const level of ['e2e-ui', 'manual', 'Browser']) {
      expect(await refusals(firstRow('invariant_test', { level })), level).toEqual(notOneOf('invariant_test', 'level', level, levels));
    }
    const tests = levels.map((level, i) => ({ id: `TL-LEND-UC01-R01-T0${i + 2}`, title: `At ${level}`, uc_requirement_id: 'TL-LEND-UC01-R01', level, state: 'not automated yet', when: 'Borrows a tool on loan', then: 'Expects a refusal' }));
    expect(await refusals(adding({ use_case_test: tests }))).toEqual([]);
  });

  it("LA-VO14-C02-T A test's state other than automated, manual or not automated yet is refused", async () => {
    for (const state of ['skipped', 'Automated']) {
      expect(await refusals(firstRow('invariant_test', { state })), state).toEqual(notOneOf('invariant_test', 'state', state, states));
    }
    const tests: Row[] = [
      { id: 'TL-LEND-UC01-R01-T02', title: 'Automated', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'service', state: 'automated', file: 'test/api.test.ts', when: 'Borrows a tool on loan', then: 'Expects a refusal' },
      { id: 'TL-LEND-UC01-R01-T03', title: 'Manual', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'browser', state: 'manual', manual_reason: 'Done at the desk.', when: 'Borrows a tool on loan', then: 'Expects a refusal' },
      { id: 'TL-LEND-UC01-R01-T04', title: 'Later', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'service', state: 'not automated yet', when: 'Borrows a tool on loan', then: 'Expects a refusal' },
    ];
    expect(await refusals(adding({ use_case_test: tests }))).toEqual([]);
  });

  it("LA-VO15-C01-T A product kind field's type other than text, integer, boolean or date is refused", async () => {
    const types = ['text', 'integer', 'boolean', 'date'];
    for (const type of ['decimal', 'whole number']) {
      expect(await refusals(firstRow('product_kind_field', { type })), type).toEqual(notOneOf('product_kind_field', 'type', type, types));
    }
    const fields = types.slice(1).map((type, i) => ({ kind: 'cli_command', position: i + 2, name: `flag_${i + 2}`, type, required: false, description: `A ${type}.` }));
    expect(await refusals(adding({ product_kind_field: fields }))).toEqual([]);
  });

  it('LA-VO16-C01-T A stage other than the six is refused', async () => {
    const stages = ['discovery', 'domain-model', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan'];
    for (const stage of ['build', 'Test plan']) {
      expect(await refusals(firstRow('product_kind', { stage })), stage).toEqual(notOneOf('product_kind', 'stage', stage, stages));
    }
    const kinds = stages.slice(0, 4).map((stage, i) => ({ name: `note_${i + 1}`, product_id: 'TL', label: `Note ${i + 1}`, description: `A note in ${stage}.`, parent_kind: 'domain', stage, obligation: false, complexity: 'essential' }));
    expect(await refusals(adding({ product_kind: kinds }))).toEqual([]);
    // A kind may sit outside the stages too.
    expect(await refusals(firstRow('product_kind', { stage: undefined }))).toEqual([]);
  });

  it("LA-VO17-C01-T A relation's role other than design, build or proof is refused, and none is allowed", async () => {
    expect(await refusals(firstRow('product_relation', { role: 'evidence' }))).toEqual(notOneOf('product_relation', 'role', 'evidence', ['design', 'build', 'proof']));
    for (const role of ['design', 'build', 'proof']) expect(await refusals(firstRow('product_relation', { role })), role).toEqual([]);
    expect(await refusals(everyKind())).toEqual([]);
  });
});

/** The fixture with its pattern's setting renamed, and the setting value that names it renamed with it. */
function withSetting(name: string): Data {
  const data = everyKind();
  data.pattern_setting = [{ ...data.pattern_setting[0], name }];
  data.setting_value = [{ ...data.setting_value[0], setting: name }];
  return data;
}
