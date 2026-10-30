// `lathe upgrade` (LA-PLT-UC17, upgradeProduct in src/upgrade.ts): converters run in order from the product's schema
// version to the target on the raw rows, the converted data must load under the new schema, and only then is the
// config's schema raised. What they cannot convert is a to-do; a working tree with changes is refused.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { PACKAGE_DIR, readConfig, readConverters, SCHEMA_VERSION, UPGRADES_DIR, upgradeProduct, type ConverterStep } from '../src/index.ts';
import { removeData, writeData } from './helpers.ts';

const temps: string[] = [];
const temp = (prefix: string) => {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
};
afterAll(() => {
  removeData();
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

const git = (root: string, ...args: string[]) => {
  const result = spawnSync('git', ['-c', 'user.name=Lathe Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], { cwd: root, encoding: 'utf8' });
  expect(result.status, `git ${args.join(' ')}: ${result.stderr}`).toBe(0);
  return result.stdout;
};

/** A product repo under git, all committed, whose config names schema 1 and whose product row has the given columns. */
function committedProduct(product: Record<string, unknown>): string {
  const root = writeData({});
  writeFileSync(path.join(root, 'data', 'product.jsonl'), `${JSON.stringify(product)}\n`);
  writeFileSync(path.join(root, 'lathe.config.json'), `${JSON.stringify({ schema: 1, data: 'data' }, null, 2)}\n`);
  git(root, 'init', '-q');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'Before the upgrade');
  return root;
}

const productFile = (root: string) => readFileSync(path.join(root, 'data', 'product.jsonl'), 'utf8');

describe('lathe upgrade', () => {
  it('LA-PLT-UC17-R02-T01 runs the converters in order on the raw rows, checks the data loads, and raises the schema', async () => {
    // "blurb" is a column the current schema does not have: only a converter can move it.
    const root = committedProduct({ title: 'Tool Library', id: 'TL', blurb: 'Lends tools to members.' });
    const ran: string[] = [];
    const converters: ConverterStep[] = [
      {
        from: 2, to: 3, name: '2-to-3',
        converter: {
          files: (data, notes) => {
            ran.push('2-to-3');
            data.write('product', data.read('product').map((row) => ({ color: '#2E6A88', ...row })));
            notes.changed('TL takes the color #2E6A88');
          },
        },
      },
      {
        from: 1, to: 2, name: '1-to-2',
        converter: {
          files: (data, notes) => {
            ran.push('1-to-2');
            data.write('product', data.read('product').map(({ blurb, ...row }) => ({ ...row, description: blurb })));
            notes.changed('product.blurb is now product.description');
          },
        },
      },
    ];
    const result = await upgradeProduct(root, { converters, target: 3 });
    expect(ran).toEqual(['1-to-2', '2-to-3']);
    expect(result).toEqual({
      from: 1,
      to: 3,
      done: true,
      todos: [],
      steps: [
        { name: '1-to-2', changes: ['product.blurb is now product.description'] },
        { name: '2-to-3', changes: ['TL takes the color #2E6A88'] },
      ],
    });
    // The raw rewrite takes the store's order and line format.
    expect(productFile(root)).toBe('{"id":"TL","title":"Tool Library","description":"Lends tools to members.","color":"#2E6A88"}\n');
    expect(readConfig(root).schema).toBe(3);
    expect(JSON.parse(readFileSync(path.join(root, 'lathe.config.json'), 'utf8'))).toEqual({ schema: 3, data: 'data' });
    // At the target already: nothing to do. Past it: a newer Lathe is needed.
    expect(await upgradeProduct(root, { converters, target: 3 })).toEqual({ from: 3, to: 3, steps: [], todos: [], done: true });
    await expect(upgradeProduct(root, { converters, target: 2 })).rejects.toThrow('It needs a newer Lathe: update @jaredrob/lathe.');
  });

  it('LA-PLT-UC17-R03-T01 lists what a converter cannot convert, and stops without raising the schema when the data no longer loads', async () => {
    const root = committedProduct({ id: 'TL', title: 'Tool Library', description: 'Lends tools to members.', notes: 'Delivered weekly.' });
    const todo: ConverterStep = {
      from: 1, to: 2, name: '1-to-2',
      converter: { files: (data, notes) => { for (const row of data.read('product')) if (row.notes) notes.todo(`${String(row.id)}: move its notes into a flow by hand`); } },
    };
    const kept = await upgradeProduct(root, { converters: [todo], target: 2 });
    expect(kept.done).toBe(true);
    expect(kept.todos).toEqual(['1-to-2: TL: move its notes into a flow by hand']);
    expect(readConfig(root).schema).toBe(2);

    // A converter that leaves data the schema refuses: the refusals are the to-dos, and the schema stays.
    const again = committedProduct({ id: 'TL', title: 'Tool Library', description: 'Lends tools to members.' });
    const breaks: ConverterStep = { from: 1, to: 2, name: '1-to-2', converter: { files: (data) => data.write('product', [{ id: 'TL', title: 'Tool Library', description: 'Lends tools to members.', tagline: 'Lend' }]) } };
    const stopped = await upgradeProduct(again, { converters: [breaks], target: 2 });
    expect(stopped.done).toBe(false);
    expect(stopped.to).toBe(1);
    expect(stopped.todos).toEqual([expect.stringMatching(/^The data does not load under schema 2: data\/product\.jsonl:1: product has no column "tagline"/)]);
    expect(readConfig(again).schema).toBe(1);

    // A missing converter is Lathe's own mistake, refused before anything changes.
    const gap = committedProduct({ id: 'TL', title: 'Tool Library', description: 'Lends tools to members.' });
    await expect(upgradeProduct(gap, { converters: [todo], target: 3 })).rejects.toThrow('This Lathe has no converter from schema 2 to schema 3 (upgrades/2-to-3.ts).');
    expect(git(gap, 'status', '--porcelain')).toBe('');
  });

  it('LA-PLT-UC17-R04-T01 refuses a working tree with changes, or no git', async () => {
    const converters: ConverterStep[] = [{ from: 1, to: 2, name: '1-to-2', converter: { files: () => {} } }];
    const root = committedProduct({ id: 'TL', title: 'Tool Library', description: 'Lends tools to members.' });
    writeFileSync(path.join(root, 'notes.md'), 'Unsaved work\n');
    await expect(upgradeProduct(root, { converters, target: 2 })).rejects.toThrow(/The git working tree has changes, so the upgrade would not be one reviewable commit\. Commit or stash them first:\n\?\? notes\.md/);
    expect(readConfig(root).schema).toBe(1);
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'Commit the notes');
    expect((await upgradeProduct(root, { converters, target: 2 })).to).toBe(2);

    const outside = temp('lathe-no-git-');
    writeFileSync(path.join(outside, 'lathe.config.json'), '{ "schema": 1 }\n');
    await expect(upgradeProduct(outside, { converters, target: 2 })).rejects.toThrow(/is not in a git repository, so the upgrade could not be reviewed as one commit\. Put it under git first\./);
  });
});

describe('the schema version', () => {
  it('LA-AUT-UC03-R08-T01 is one whole number in schema/version.json, and each converter moves the data forward one version', async () => {
    expect(JSON.parse(readFileSync(path.join(PACKAGE_DIR, 'schema', 'version.json'), 'utf8'))).toEqual({ schema: SCHEMA_VERSION });
    // Lathe's own converters chain from schema 1 to this one, one version each.
    const own = await readConverters(UPGRADES_DIR);
    expect(own.map((c) => [c.from, c.to])).toEqual(Array.from({ length: SCHEMA_VERSION - 1 }, (_, i) => [i + 1, i + 2]));

    const dir = temp('lathe-upgrades-');
    writeFileSync(path.join(dir, '1-to-2.ts'), 'export default { files: () => {} };\n');
    writeFileSync(path.join(dir, 'notes.txt'), 'Not a converter.\n');
    expect((await readConverters(dir)).map((c) => c.name)).toEqual(['1-to-2']);
    writeFileSync(path.join(dir, '2-to-4.ts'), 'export default { files: () => {} };\n');
    await expect(readConverters(dir)).rejects.toThrow('a converter moves the data forward one version, such as 1-to-2.ts.');
  });
  it("LA-AUT-UC03-R08-T02 1-to-2 puts every flow through its product's one new interface, renaming its flows, steps and tests wherever they are named", async () => {
    const line = (row: object) => `${JSON.stringify(row)}\n`;
    const root = committedProduct({ id: 'TL', title: 'Tool Library' });
    const files: Record<string, object[]> = {
      domain: [{ id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core' }],
      capability: [{ id: 'TL-LEND-CAP01', title: 'Lending', domain_id: 'TL-LEND', position: 1 }],
      use_case: [{ id: 'TL-LEND-UC01', title: 'Borrow a tool', capability_id: 'TL-LEND-CAP01' }],
      uc_requirement: [{ id: 'TL-LEND-UC01-R01', title: 'Refused', use_case_id: 'TL-LEND-UC01', statement: 'A tool on loan MUST be refused, as TL-LEND-UC01-FL-S01 shows.' }],
      flow: [{ id: 'TL-LEND-UC01-FL', title: 'Borrow', use_case_id: 'TL-LEND-UC01' }],
      flow_step: [{ id: 'TL-LEND-UC01-FL-S01', title: 'Borrow', flow_id: 'TL-LEND-UC01-FL', path: 'main', position: 1 }],
      flow_test: [{ id: 'TL-LEND-UC01-FL-T', title: 'Borrow end to end', flow_id: 'TL-LEND-UC01-FL', level: 'e2e-api', state: 'not automated yet', steps: ['Run TL-LEND-UC01-FL-S01'] }],
      fulfills: [{ source_id: 'TL-LEND-UC01-FL-S01', target_id: 'TL-LEND-UC01-R01' }],
    };
    for (const [table, rows] of Object.entries(files)) writeFileSync(path.join(root, 'data', `${table}.jsonl`), rows.map(line).join(''));
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'A flow before interfaces');
    const result = await upgradeProduct(root, { converters: (await readConverters(UPGRADES_DIR)).filter((c) => c.from === 1), target: 2 });
    expect(result.done).toBe(true);
    expect(result.todos).toEqual([
      expect.stringMatching(/^1-to-2: TL-IF01 stands for every interface TL's flows went through/),
      expect.stringMatching(/^1-to-2: Rename the flow, step and flow test IDs your code names/),
      expect.stringMatching(/^1-to-2: Write each text that starts "To write:" from the code/),
    ]);
    const read = (table: string) => readFileSync(path.join(root, 'data', `${table}.jsonl`), 'utf8');
    expect(read('interface')).toBe(line({ id: 'TL-IF01', title: 'Interface', product_id: 'TL', kind: 'other', description: 'Every flow written before interfaces were declared goes through this one.' }));
    expect(read('flow')).toBe(line({ id: 'TL-LEND-UC01-FL01', title: 'Borrow', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF01' }));
    expect(read('flow_step')).toContain('"id":"TL-LEND-UC01-FL01-S01"');
    expect(read('flow_test')).toContain('"id":"TL-LEND-UC01-FL01-T","title":"Borrow end to end","flow_id":"TL-LEND-UC01-FL01"');
    expect(read('flow_test')).toContain('"steps":["Run TL-LEND-UC01-FL01-S01"]');
    expect(read('flow_test')).toContain('"level":"system"');
    expect(read('fulfills')).toBe(line({ source_id: 'TL-LEND-UC01-FL01-S01', target_id: 'TL-LEND-UC01-R01' }));
    expect(read('uc_requirement')).toContain('as TL-LEND-UC01-FL01-S01 shows.');
    expect(readConfig(root).schema).toBe(2);
  });
  it('LA-AUT-UC03-R08-T03 1-to-2 gives every test one of the five levels, and a manual test the level that fits its kind', async () => {
    const [step] = (await readConverters(UPGRADES_DIR)).filter((c) => c.from === 1);
    const manual = { state: 'manual', manual_reason: 'By hand.' };
    const tables: Record<string, Record<string, unknown>[]> = {
      constraint_test: [{ id: 'C1', level: 'database' }, { id: 'C2', level: 'unit' }],
      endpoint_test: [{ id: 'E1', level: 'api' }, { id: 'E2', level: 'contract' }],
      use_case_test: [{ id: 'U1', level: 'e2e-api' }, { id: 'U2', level: 'e2e-ui' }, { id: 'U3', level: 'manual', ...manual }],
      flow_test: [{ id: 'F1', level: 'manual', ...manual }],
      view_test: [{ id: 'V1', level: 'manual', ...manual }],
      policy_test: [{ id: 'P1', level: 'manual', ...manual }],
      integration_test: [{ id: 'I1', level: 'manual', ...manual }],
      standard_rule_test: [{ id: 'S1', level: 'manual', ...manual }],
    };
    const changes: string[] = [];
    const todos: string[] = [];
    await step!.converter.files!(
      { tables: () => Object.keys(tables), read: (table) => tables[table] ?? [], write: (table, rows) => void (tables[table] = rows) },
      { changed: (text) => changes.push(text), todo: (text) => todos.push(text) },
    );
    const levels = Object.fromEntries(Object.values(tables).flat().map((row) => [row.id, row.level]));
    expect(levels).toEqual({
      C1: 'integration', C2: 'unit', E1: 'service', E2: 'service', U1: 'system', U2: 'browser', U3: 'browser',
      F1: 'browser', V1: 'browser', P1: 'browser', I1: 'integration', S1: 'unit',
    });
    expect(tables.use_case_test![2]).toEqual({ id: 'U3', level: 'browser', ...manual, when: 'To write: what the test does.', then: 'To write: what the test expects.' });
    expect(changes).toEqual([
      'Every test runs at one of the five levels: 1 database to integration, 4 manual to browser, 1 e2e-api to system, 1 e2e-ui to browser, 1 api to service, 1 contract to service, 1 manual to integration, 1 manual to unit.',
      expect.stringMatching(/^Each required text a record lacked stands in as "To write: …": \d+ written\.$/),
    ]);
    expect(todos).toEqual([expect.stringMatching(/^Each manual test now names the level a person exercises/), expect.stringMatching(/^Write each text that starts "To write:"/)]);
  });
  it("LA-AUT-UC03-R08-T04 1-to-2 puts every repository under its aggregate's domain, persisting that aggregate, renamed wherever it is named", async () => {
    const [step] = (await readConverters(UPGRADES_DIR)).filter((c) => c.from === 1);
    const tables: Record<string, Record<string, unknown>[]> = {
      aggregate: [
        { id: 'TL-LEND-A1', title: 'Member', domain_id: 'TL-LEND' },
        { id: 'TL-LEND-A10', title: 'Fine', domain_id: 'TL-LEND' },
        { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND' },
        { id: 'TL-CAT-A1', title: 'Listing', domain_id: 'TL-CAT' },
      ],
      repository: [
        { id: 'TL-LEND-A10-REPO', title: 'Fines', aggregate_id: 'TL-LEND-A10', file: 'src/store.ts' },
        { id: 'TL-LEND-A1-REPO', title: 'Members', aggregate_id: 'TL-LEND-A1', file: 'src/store.ts', description: 'Unlike TL-LEND-A10-REPO, it keeps no history.' },
        { id: 'TL-LEND-A2-REPO', title: 'Tools', aggregate_id: 'TL-LEND-A2', file: 'src/store.ts' },
        { id: 'TL-CAT-A1-REPO', title: 'Listings', aggregate_id: 'TL-CAT-A1', file: 'src/catalog.ts' },
      ],
      meets: [{ source_id: 'TL-LEND-A1-REPO', target_id: 'TL-STD-CODE-R01' }],
      package_use: [{ record_id: 'TL-CAT-A1-REPO', package: 'better-sqlite3' }],
    };
    const changes: string[] = [];
    const todos: string[] = [];
    await step!.converter.files!(
      { tables: () => Object.keys(tables), read: (table) => tables[table] ?? [], write: (table, rows) => void (tables[table] = rows) },
      { changed: (text) => changes.push(text), todo: (text) => todos.push(text) },
    );
    expect(tables.repository).toEqual([
      { id: 'TL-CAT-REPO01', title: 'Listings', domain_id: 'TL-CAT', file: 'src/catalog.ts', description: 'To write: how it keeps its aggregate.' },
      { id: 'TL-LEND-REPO01', title: 'Members', domain_id: 'TL-LEND', file: 'src/store.ts', description: 'Unlike TL-LEND-REPO03, it keeps no history.' },
      { id: 'TL-LEND-REPO02', title: 'Tools', domain_id: 'TL-LEND', file: 'src/store.ts', description: 'To write: how it keeps its aggregate.' },
      { id: 'TL-LEND-REPO03', title: 'Fines', domain_id: 'TL-LEND', file: 'src/store.ts', description: 'To write: how it keeps its aggregate.' },
    ]);
    expect(tables.persists).toEqual([
      { source_id: 'TL-CAT-REPO01', target_id: 'TL-CAT-A1' },
      { source_id: 'TL-LEND-REPO01', target_id: 'TL-LEND-A1' },
      { source_id: 'TL-LEND-REPO02', target_id: 'TL-LEND-A2' },
      { source_id: 'TL-LEND-REPO03', target_id: 'TL-LEND-A10' },
    ]);
    expect(tables.meets).toEqual([{ source_id: 'TL-LEND-REPO01', target_id: 'TL-STD-CODE-R01' }]);
    expect(tables.package_use).toEqual([{ record_id: 'TL-CAT-REPO01', package: 'better-sqlite3' }]);
    expect(changes).toEqual([
      "Every repository sits under its aggregate's domain and persists its aggregate: 4 renamed from <aggregate>-REPO to <domain>-REPO<nn>.",
      'Each required text a record lacked stands in as "To write: …": 11 written.',
    ]);
    expect(todos).toEqual([
      expect.stringMatching(/^A repository persists one aggregate: .* split the class into one repository per aggregate/),
      'Rename the repository IDs your code names: <aggregate>-REPO is now <domain>-REPO<nn>.',
      expect.stringMatching(/^Write each text that starts "To write:"/),
    ]);
  });
  it('LA-AUT-UC03-R08-T05 1-to-2 drops the descriptions that are gone, opens each When with its Given, and stands in for each required text a record lacks', async () => {
    const [step] = (await readConverters(UPGRADES_DIR)).filter((c) => c.from === 1);
    const tables: Record<string, Record<string, unknown>[]> = {
      command: [
        { id: 'TL-LEND-CMD01', title: 'Open a loan', entity_id: 'TL-LEND-EN01', description: 'Lends a free tool to a member.' },
        { id: 'TL-LEND-CMD02', title: 'Close a loan', entity_id: 'TL-LEND-EN01' },
      ],
      data_model: [{ id: 'TL-LEND-EN01-DM', title: 'Loan', entity_id: 'TL-LEND-EN01', description: 'The Loan interface.' }],
      flow_step: [{ id: 'TL-LEND-UC01-FL01-S01', title: 'Borrow', flow_id: 'TL-LEND-UC01-FL01', path: 'main', position: 1 }],
      invariant_test: [
        { id: 'TL-LEND-INV01-T', title: 'A second loan is refused', given: 'A tool on loan.', when: 'Lends it again.', then: 'Expects a refusal.' },
        { id: 'TL-LEND-INV02-T', title: 'A loan has a due date', given: 'An empty library', then: 'Expects a due date.' },
      ],
    };
    const changes: string[] = [];
    const todos: string[] = [];
    await step!.converter.files!(
      { tables: () => Object.keys(tables), read: (table) => tables[table] ?? [], write: (table, rows) => void (tables[table] = rows) },
      { changed: (text) => changes.push(text), todo: (text) => todos.push(text) },
    );
    expect(tables.data_model).toEqual([{ id: 'TL-LEND-EN01-DM', title: 'Loan', entity_id: 'TL-LEND-EN01' }]);
    expect(tables.flow_step![0]).not.toHaveProperty('description');
    expect(tables.invariant_test).toEqual([
      { id: 'TL-LEND-INV01-T', title: 'A second loan is refused', when: 'With a tool on loan: Lends it again.', then: 'Expects a refusal.' },
      { id: 'TL-LEND-INV02-T', title: 'A loan has a due date', when: 'An empty library.', then: 'Expects a due date.' },
    ]);
    expect(tables.command![0]!.description).toBe('Lends a free tool to a member.');
    expect(tables.command![1]!.description).toBe('To write: what it changes and when it is refused.');
    expect(changes).toEqual([
      'The descriptions of flows, flow steps, data models, value types, predicates, event types, services and tables are gone, since the record each implements, its title or its steps say it: 1 removed.',
      "Each test's Given opens its When: 2 folded.",
      'Each required text a record lacked stands in as "To write: …": 1 written.',
    ]);
    expect(todos).toEqual(['Write each text that starts "To write:" from the code, saying what the title, parent and links cannot (1: TL-LEND-CMD02 description).']);
  });
  it('LA-AUT-UC03-R08-T06 1-to-2 puts each command under its aggregate\'s root entity, and leaves a to-do for an aggregate with none', async () => {
    const [step] = (await readConverters(UPGRADES_DIR)).filter((c) => c.from === 1);
    const tables: Record<string, Record<string, unknown>[]> = {
      entity: [
        { id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' },
        { id: 'TL-LEND-EN02', title: 'Return', aggregate_id: 'TL-LEND-A1', role: 'child', description: 'The tool coming back.' },
      ],
      command: [
        { id: 'TL-LEND-CMD01', title: 'Open a loan', aggregate_id: 'TL-LEND-A1', description: 'Lends a free tool to a member.' },
        { id: 'TL-LEND-CMD02', title: 'Add a tool', aggregate_id: 'TL-LEND-A2', description: 'Puts a tool in the catalog.' },
      ],
    };
    const changes: string[] = [];
    const todos: string[] = [];
    await step!.converter.files!(
      { tables: () => Object.keys(tables), read: (table) => tables[table] ?? [], write: (table, rows) => void (tables[table] = rows) },
      { changed: (text) => changes.push(text), todo: (text) => todos.push(text) },
    );
    expect(tables.command).toEqual([
      { id: 'TL-LEND-CMD01', title: 'Open a loan', entity_id: 'TL-LEND-EN01', description: 'Lends a free tool to a member.' },
      { id: 'TL-LEND-CMD02', title: 'Add a tool', aggregate_id: 'TL-LEND-A2', description: 'Puts a tool in the catalog.' },
    ]);
    expect(changes).toContain('Every command sits under the entity it changes: 1 moved from their aggregate to its root entity.');
    expect(todos).toEqual([
      'Command TL-LEND-CMD02 changes aggregate TL-LEND-A2, which has no root entity: give the aggregate its root and put the command under the entity it changes (entity_id).',
      expect.stringMatching(/^A command that changes a child entity/),
    ]);
  });

  it('LA-AUT-UC03-R08-T07 1-to-2 drops every recorded exception and waiver, and leaves a to-do to change the model', async () => {
    const [step] = (await readConverters(UPGRADES_DIR)).filter((c) => c.from === 1);
    const tables: Record<string, Record<string, unknown>[]> = {
      command_change: [{ command_id: 'TL-LEND-CMD01', aggregate_id: 'TL-LEND-A2', reason: 'Both at once.' }],
      repository_share: [{ repository_id: 'TL-LEND-REPO01', aggregate_id: 'TL-LEND-A2', reason: 'One store.' }],
      pattern_rule: [{ id: 'TL-PAT-ACT-R01', title: 'Saved', pattern_id: 'TL-PAT-ACT', statement: 'A tool MUST read the same.', setting: 'record', applies_when_setting: 'record', applies_when_negated: false, applies_when_value: 'Tool' }],
      setting_value: [{ follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT', setting: 'record', not_applicable: 'Nothing is saved.' }],
    };
    const changes: string[] = [];
    const todos: string[] = [];
    await step!.converter.files!(
      { tables: () => Object.keys(tables), read: (table) => tables[table] ?? [], write: (table, rows) => void (tables[table] = rows) },
      { changed: (text) => changes.push(text), todo: (text) => todos.push(text) },
    );
    expect(tables.command_change).toEqual([]);
    expect(tables.repository_share).toEqual([]);
    expect(tables.pattern_rule).toEqual([{ id: 'TL-PAT-ACT-R01', title: 'Saved', pattern_id: 'TL-PAT-ACT', statement: 'A tool MUST read the same.' }]);
    expect(tables.setting_value).toEqual([{ follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT', setting: 'record', value: 'Not applicable: Nothing is saved.' }]);
    expect(changes).toContain('Recorded exceptions are gone: 1 command changes and 1 repository shares removed.');
    expect(todos).toEqual([
      expect.stringContaining('TL-LEND-CMD01 changed TL-LEND-A2; TL-LEND-REPO01 persisted TL-LEND-A2'),
      expect.stringContaining('move TL-PAT-ACT-R01'),
      expect.stringContaining('TL-LEND-UC01 record'),
    ]);
  });
});
