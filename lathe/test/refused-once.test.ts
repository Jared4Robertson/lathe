// What the store refuses that checking and traceability rely on: each mistake refused once, naming its rule, file and
// line, and nothing that only follows from it; and the value objects, invariants and run by of checks and tests.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ADD_CHECK } from '../src/checking/check/commands/add-check.ts';
import { CHANGE_CHECK } from '../src/checking/check/commands/change-check.ts';
import { REMOVE_CHECK } from '../src/checking/check/commands/remove-check.ts';
import { productSettingRules } from '../src/checking/product-setting/rules.ts';
import { CHANGE_SETTING_VALUES } from '../src/traceability/pattern-following/commands/change-setting-values.ts';
import { LATHE_DATA_DIR, openStore, StoreError } from '../src/index.ts';
import type { ReadView } from '../src/platform/data/rules.ts';
import { InputError, type AnyCommand } from '../src/platform/commands/definition.ts';
import { runCommand } from '../src/platform/commands/run.ts';
import type { Store } from '../src/platform/data/store.ts';
import { adding, build, changing, complete, refusals, removeData, type Data } from './helpers.ts';

afterAll(removeData);

/** The rules and messages a command is refused with; a failure when it is not refused. */
async function commandRefusal(store: Store, definition: AnyCommand, input: unknown): Promise<[string, string][]> {
  const error = await runCommand(store, definition, input).then(() => null, (e: unknown) => e);
  if (!(error instanceof StoreError)) throw new Error(`${definition.name} was not refused`);
  return error.problems.map((p) => [p.rule, p.message]);
}

/** The complete product with one use case test changed. */
const test = (changes: Record<string, string | undefined>) => changing(complete(), 'use_case_test', (r) => r.id === 'EX-LEND-UC01-R01-T01', changes);

/** A product check row, valid unless changed. */
const check = (changes: Record<string, string | number> = {}): Data => ({
  check: [{ name: 'house-rule', product_id: 'EX', domain_id: 'LA-CHK', position: 1, severity: 'warning', summary: 'A house rule.', explanation: 'Made for this test. Fix what it reports.', query: "SELECT 'EX' AS record, 'Seen.' AS message", ...changes }],
});

describe('one problem per mistake', () => {
  it('LA-PRD-UC04-R05-T01 A product relation declared twice is refused once, naming its file and line', async () => {
    const relation = { name: 'enforces', source_kind: 'ui_component', target_kind: 'uc_requirement', product_id: 'EX', forward_label: 'Enforces', reverse_label: 'Enforced by', description: 'It enforces it.' };
    expect(await refusals(adding(complete(), { product_relation: [relation, relation] }))).toEqual([
      expect.objectContaining({ rule: 'primary-key', file: 'data/product_relation.jsonl', line: 2, message: expect.stringContaining('is already on line 1') }),
    ]);
  });

  it('LA-STD-MODELING-R17-T04 A row taking another record\'s ID is refused once, as unique-id naming that record\'s file and line, and the links to the ID are not', async () => {
    // EX-LEND-SP01 is the target of a checks link and the source of a reads link.
    const twin = { id: 'EX-LEND-SP01', title: 'Twin', uc_requirement_id: 'EX-LEND-UC01-R01', level: 'service', state: 'not automated yet', when: 'A member asks for a tool on loan.', then: 'The library refuses.' };
    expect(await refusals(adding(complete(), { use_case_test: [twin] }))).toEqual([
      expect.objectContaining({ rule: 'unique-id', file: 'data/use_case_test.jsonl', line: 3, message: expect.stringContaining('already a specification (data/specification.jsonl:1)') }),
    ]);
  });

  it('LA-STD-MODELING-R17-T01 A parent that names no record is refused once, as a foreign key naming the record and the kind it must be', async () => {
    const lost = { id: 'EX-LEND-UC03', title: 'Lost', domain_id: 'EX-LEND9', goal: 'A member finds a lost tool.', result_id: 'EX-LEND-CMD01' };
    const actor = { use_case_id: 'EX-LEND-UC03', position: 1, role_name: 'Member' };
    expect(await refusals(adding(complete(), { use_case: [lost], use_case_actor: [actor] }))).toEqual([
      expect.objectContaining({ rule: 'foreign-key', file: 'data/use_case.jsonl', line: 3, message: 'use_case EX-LEND-UC03: domain_id "EX-LEND9" names no domain' }),
    ]);
  });

  it('LA-STD-MODELING-R18-T01 A link between kinds its relation does not allow, and a parent column its kind lacks, are each refused once', async () => {
    expect(await refusals(adding(complete(), { renders: [{ source_id: 'EX-UI01', target_id: 'EX-LEND-UC01-R01' }] }))).toEqual([
      expect.objectContaining({ file: 'data/renders.jsonl', line: 2, message: expect.stringContaining('names no view') }),
    ]);
    const term = { id: 'EX-LEND-TM02', title: 'Tool', domain_id: 'EX-LEND', meaning: 'A thing lent.', aggregate_id: 'EX-LEND-A1' };
    expect(await refusals(adding(complete(), { term: [term] }))).toEqual([
      expect.objectContaining({ rule: 'column', file: 'data/term.jsonl', line: 2, message: expect.stringContaining('term has no column "aggregate_id"') }),
    ]);
  });
});

describe("a test's run by", () => {
  it('LA-UCS-UC03-R02-T01 A state other than automated, manual and not automated yet, in any letter case, or none, is refused', async () => {
    for (const state of ['someday', 'Manual']) {
      expect(await refusals(test({ state })), state).toEqual([
        expect.objectContaining({ rule: 'column', file: 'data/use_case_test.jsonl', message: `use_case_test.state "${state}" is not one of automated, manual, not automated yet` }),
      ]);
    }
    expect(await refusals(test({ state: undefined }))).toEqual([expect.objectContaining({ rule: 'required', message: 'use_case_test.state is required' })]);
  });

  it('LA-UCS-UC03-R06-T01 A level outside the five, or none, is refused', async () => {
    expect(await refusals(test({ level: 'smoke' }))).toEqual([
      expect.objectContaining({ rule: 'column', message: 'use_case_test.level "smoke" is not one of unit, integration, service, system, browser' }),
    ]);
    expect(await refusals(test({ level: undefined }))).toEqual([expect.objectContaining({ rule: 'required', message: 'use_case_test.level is required' })]);
  });
});

describe('pattern settings and product kinds', () => {
  it('LA-TRC-INV01-T A setting value gives a value, never none and never an empty one', async () => {
    expect(await refusals(changing(complete(), 'setting_value', () => true, { value: undefined }))).toEqual([
      expect.objectContaining({ table: 'setting_value', file: 'data/setting_value.jsonl', line: 1, message: expect.stringContaining('value') }),
    ]);
    expect(await refusals(changing(complete(), 'setting_value', () => true, { value: '' }))).toEqual([
      expect.objectContaining({ table: 'setting_value', file: 'data/setting_value.jsonl', line: 1 }),
    ]);
    expect(await refusals(complete())).toEqual([]);
    // The Pattern following aggregate's command refuses a blank value at its input, and nothing changes.
    const store = await openStore(await build(complete()));
    try {
      const before = store.rows('setting_value');
      const blank = { follower_id: 'EX-LEND-UC02', pattern_id: 'EX-PAT-ACT', setting_values: [{ setting: 'record', value: '  ' }] };
      await expect(runCommand(store, CHANGE_SETTING_VALUES, blank)).rejects.toThrow(InputError);
      expect(store.rows('setting_value')).toEqual(before);
    } finally {
      await store.close();
    }
  });

  it("LA-TRC-UC07-R06-T01 A product kind named like one of Lathe's tables is refused", async () => {
    const kind = { name: 'pattern_rule', product_id: 'EX', label: 'Rule', description: 'A rule of ours.', parent_kind: 'domain', obligation: true, complexity: 'essential' };
    expect(await refusals(adding(complete(), { product_kind: [kind] }))).toEqual([
      expect.objectContaining({ rule: 'product-kind-declared', message: 'The product kind pattern_rule has the name of a table Lathe already has; give it another name.' }),
    ]);
  });
});

describe('checks and product settings', () => {
  it('LA-VO41-C01-T A check name is lower-case words joined by single hyphens', async () => {
    expect(await refusals(adding(complete(), check()))).toEqual([]);
    for (const name of ['Too_Many', 'too--many', '-too-many', 'too many']) {
      expect(await refusals(adding(complete(), check({ name }))), name).toEqual([expect.objectContaining({ rule: 'check', table: 'check', file: 'data/check.jsonl' })]);
    }
  });

  it('LA-VO42-C01-T A check severity is error, warning or error_or_warning', async () => {
    for (const severity of ['error', 'warning']) expect(await refusals(adding(complete(), check({ severity }))), severity).toEqual([]);
    expect(await refusals(adding(complete(), check({ severity: 'info' })))).toEqual([
      expect.objectContaining({ rule: 'column', message: 'check.severity "info" is not one of error, warning, error_or_warning' }),
    ]);
  });

  it('LA-VO43-C01-T A children limit is a whole number of at least 1', async () => {
    const limit = (max_children: unknown) => refusals(adding(complete(), { product_setting: [{ product_id: 'EX', max_children: max_children as number, max_entities_per_aggregate: 7, technology_words: [] }] }));
    expect(await limit(1)).toEqual([]);
    expect(await limit(0)).toEqual([expect.objectContaining({ rule: 'check', table: 'product_setting', file: 'data/product_setting.jsonl' })]);
    expect(await limit('two')).toEqual([expect.objectContaining({ rule: 'column', message: 'product_setting.max_children "two" is not a whole number' })]);
    expect(await limit(2.5)).toEqual([expect.objectContaining({ rule: 'column', message: 'product_setting.max_children 2.5 is not a whole number' })]);
  });

  it('LA-CHK-INV05-T A product has at most one settings row: the Product setting rule refuses a second, and so does the key under it', async () => {
    const rows = [{ product_id: 'EX', max_children: 3, max_entities_per_aggregate: 7, technology_words: [] }, { product_id: 'EX', max_children: 4, max_entities_per_aggregate: 7, technology_words: [] }, { product_id: 'OT', max_children: 4, max_entities_per_aggregate: 7, technology_words: [] }];
    const view = { rows: (table: string) => (table === 'product_setting' ? rows : []) } as unknown as ReadView;
    expect(productSettingRules.check(view)).toEqual([
      { rule: 'product-setting-one', table: 'product_setting', row: rows[1], message: 'product EX already has its settings row, so it cannot have a second: a product has one' },
    ]);
    // Written into the file, the second row is refused when the data loads, before the rule is reached.
    const two = adding(complete(), { product_setting: rows.slice(0, 2) });
    expect(await refusals(two)).toEqual([expect.objectContaining({ rule: 'primary-key', file: 'data/product_setting.jsonl', line: 2, message: 'product_setting EX is already on line 1' })]);
  });

  it("LA-CHK-INV02-T Lathe's own check rows are read-only: a write to a product never changes or removes them", async () => {
    const before = readFileSync(path.join(LATHE_DATA_DIR, 'check.jsonl'), 'utf8');
    const root = await build(complete());
    const store = await openStore(root);
    try {
      const builtIn = store.rows('check').find((r) => r.name === 'too-many-children')!;
      expect(store.isBuiltIn(builtIn)).toBe(true);
      // The Check aggregate's commands are refused by its rule check-read-only.
      const readOnly = "check too-many-children is Lathe's own (lathe/data/check.jsonl), so it cannot change or be removed";
      expect(await commandRefusal(store, CHANGE_CHECK, { name: 'too-many-children', severity: 'error' })).toEqual([['check-read-only', readOnly]]);
      expect(await commandRefusal(store, REMOVE_CHECK, { name: 'too-many-children' })).toEqual([['check-read-only', readOnly]]);
      // A write of the product's own leaves them where they are, and writes none of them into the product's folder.
      await runCommand(store, ADD_CHECK, check().check[0]);
      expect(store.rows('check').filter((r) => store.isBuiltIn(r)).length).toBe(before.trim().split('\n').length);
    } finally {
      await store.close();
    }
    expect(readFileSync(path.join(LATHE_DATA_DIR, 'check.jsonl'), 'utf8')).toBe(before);
    expect(readFileSync(path.join(root, 'data', 'check.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
  });
});
