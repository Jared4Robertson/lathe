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
  it('LA-PRD-UC03-R08-T01 is one whole number in schema/version.json, and each converter moves the data forward one version', async () => {
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
  it("LA-PRD-UC03-R08-T02 1-to-2 puts every flow through its product's one new interface, renaming its flows, steps and tests wherever they are named", async () => {
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
    // The data must load under this Lathe's schema, so every later converter runs too: 3-to-4 makes the interface internal
    // and merges the use case's flows back into its one flow, offered through the interface.
    const result = await upgradeProduct(root, { converters: await readConverters(UPGRADES_DIR) });
    expect(result.done).toBe(true);
    expect(result.todos).toEqual([
      expect.stringMatching(/^1-to-2: TL-IF01 stands for every interface TL's flows went through/),
      expect.stringMatching(/^1-to-2: Rename the flow, step and flow test IDs your code names/),
      expect.stringMatching(/^1-to-2: Write each text that starts "To write:" from the code/),
      expect.stringMatching(/^3-to-4: An interface that people or programs outside the product build on is public/),
      expect.stringMatching(/^3-to-4: List the roles that use each interface/),
      expect.stringMatching(/^4-to-5: Journeys arrive in Discovery/),
    ]);
    const read =(table: string) => readFileSync(path.join(root, 'data', `${table}.jsonl`), 'utf8');
    expect(read('interface')).toBe(line({ id: 'TL-IF01', title: 'Interface', product_id: 'TL', kind: 'other', description: 'Every flow written before interfaces were declared goes through this one.', public: false }));
    expect(read('flow')).toBe(line({ id: 'TL-LEND-UC01-FL', title: 'Borrow a tool', use_case_id: 'TL-LEND-UC01' }));
    expect(read('offers')).toBe(line({ source_id: 'TL-IF01', target_id: 'TL-LEND-UC01' }));
    expect(read('flow_step')).toContain('"id":"TL-LEND-UC01-FL-S01"');
    expect(read('flow_test')).toContain('"id":"TL-LEND-UC01-FL-T","title":"Borrow end to end","flow_id":"TL-LEND-UC01-FL"');
    expect(read('flow_test')).toContain('"steps":["Run TL-LEND-UC01-FL-S01"]');
    expect(read('flow_test')).toContain('"level":"system"');
    expect(read('fulfills')).toBe(line({ source_id: 'TL-LEND-UC01-FL-S01', target_id: 'TL-LEND-UC01-R01' }));
    expect(read('uc_requirement')).toContain('as TL-LEND-UC01-FL-S01 shows.');
    expect(readConfig(root).schema).toBe(SCHEMA_VERSION);
  });
  it('LA-PRD-UC03-R08-T03 1-to-2 gives every test one of the five levels, and a manual test the level that fits its kind', async () => {
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
  it("LA-PRD-UC03-R08-T04 1-to-2 puts every repository under its aggregate's domain, persisting that aggregate, renamed wherever it is named", async () => {
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
  it('LA-PRD-UC03-R08-T05 1-to-2 drops the descriptions that are gone, opens each When with its Given, and stands in for each required text a record lacks', async () => {
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
  it('LA-PRD-UC03-R08-T06 1-to-2 puts each command under its aggregate\'s root entity, and leaves a to-do for an aggregate with none', async () => {
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

  it('LA-PRD-UC03-R08-T07 1-to-2 drops every recorded exception and waiver, and leaves a to-do to change the model', async () => {
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
  const run2to3 = async (tables: Record<string, Record<string, unknown>[]>) => {
    const [step] = (await readConverters(UPGRADES_DIR)).filter((c) => c.from === 2);
    const changes: string[] = [];
    const todos: string[] = [];
    await step!.converter.files!(
      { tables: () => Object.keys(tables), read: (table) => tables[table] ?? [], write: (table, rows) => void (tables[table] = rows) },
      { changed: (text) => changes.push(text), todo: (text) => todos.push(text) },
    );
    return { changes, todos };
  };
  const houseCheck = { name: 'tool-without-photo', product_id: 'TL', position: 1, severity: 'warning', summary: 'A tool with no photo.', explanation: 'Add one.', query: 'SELECT 1' };

  it("LA-PRD-UC03-R08-T08 2-to-3 gives each check the domain of its check_row record, removes the check_row records and kind, and leaves a to-do for a check no record names", async () => {
    const tables: Record<string, Record<string, unknown>[]> = {
      check: [houseCheck, { ...houseCheck, name: 'loan-without-due-date' }],
      check_row: [{ id: 'TL-LEND-CK01', title: 'tool-without-photo', domain_id: 'TL-LEND', file: 'data/check.jsonl' }],
      product_kind: [{ name: 'check_row', product_id: 'TL' }, { name: 'skill', product_id: 'TL' }],
      product_kind_field: [{ kind: 'check_row', name: 'file' }, { kind: 'skill', name: 'file' }],
    };
    const { changes, todos } = await run2to3(tables);
    expect(tables.check![0]).toEqual({ name: 'tool-without-photo', product_id: 'TL', domain_id: 'TL-LEND', position: 1, severity: 'warning', summary: 'A tool with no photo.', explanation: 'Add one.', query: 'SELECT 1' });
    expect(tables.check![1]!.domain_id).toBeUndefined();
    expect(tables.check_row).toEqual([]);
    expect(tables.product_kind).toEqual([{ name: 'skill', product_id: 'TL' }]);
    expect(tables.product_kind_field).toEqual([{ kind: 'skill', name: 'file' }]);
    expect(changes).toHaveLength(3);
    expect(todos).toEqual([expect.stringContaining('add `domain_id` with the domain that owns the check, to loan-without-due-date')]);
  });

  it('LA-PRD-UC03-R08-T09 2-to-3 leaves a to-do for every check of a product with no check_row records', async () => {
    const tables: Record<string, Record<string, unknown>[]> = { check: [houseCheck] };
    const { changes, todos } = await run2to3(tables);
    expect(tables.check).toEqual([houseCheck]);
    expect(changes).toEqual([]);
    expect(todos).toEqual([expect.stringContaining('tool-without-photo')]);
  });

  it('LA-PRD-UC03-R08-T10 2-to-3 does nothing to data that is already upgraded', async () => {
    const upgraded = { ...houseCheck, domain_id: 'TL-LEND' };
    const tables: Record<string, Record<string, unknown>[]> = { check: [upgraded], product_kind: [{ name: 'skill', product_id: 'TL' }] };
    const { changes, todos } = await run2to3(tables);
    expect(tables).toEqual({ check: [upgraded], product_kind: [{ name: 'skill', product_id: 'TL' }] });
    expect(changes).toEqual([]);
    expect(todos).toEqual([]);
  });

  const run3to4 = async (tables: Record<string, Record<string, unknown>[]>) => {
    const [step] = (await readConverters(UPGRADES_DIR)).filter((c) => c.from === 3);
    const changes: string[] = [];
    const todos: string[] = [];
    await step!.converter.files!(
      { tables: () => Object.keys(tables), read: (table) => tables[table] ?? [], write: (table, rows) => void (tables[table] = rows) },
      { changed: (text) => changes.push(text), todo: (text) => todos.push(text) },
    );
    return { changes, todos };
  };

  it('LA-PRD-UC03-R08-T11 3-to-4 gives each product kind its complexity from its stage, makes each standard engineering with a to-do to review it, gives each product setting no technology words, and makes each interface internal with a to-do to mark the public ones', async () => {
    const tables: Record<string, Record<string, unknown>[]> = {
      product_kind: [
        { name: 'report', product_id: 'TL', stage: 'technical-specification' },
        { name: 'drill', product_id: 'TL', stage: 'test-plan' },
        { name: 'skill', product_id: 'TL', stage: 'interaction-design' },
        { name: 'note', product_id: 'TL' },
      ],
      standard: [{ id: 'TL-STD-CODE', title: 'Code', product_id: 'TL', description: 'How the code is written.' }],
      product_setting: [{ product_id: 'TL', max_children: 15, max_entities_per_aggregate: 7 }],
      interface: [{ id: 'TL-IF01', title: 'Lending API', product_id: 'TL', kind: 'API', description: 'Other libraries lend through it.' }],
    };
    const { changes, todos } = await run3to4(tables);
    expect(tables.product_kind!.map((k) => [k.name, k.complexity])).toEqual([['report', 'accidental'], ['drill', 'as-parent'], ['skill', 'essential'], ['note', 'essential']]);
    expect(tables.standard).toEqual([{ id: 'TL-STD-CODE', title: 'Code', product_id: 'TL', description: 'How the code is written.', type: 'engineering' }]);
    expect(tables.product_setting).toEqual([{ product_id: 'TL', max_children: 15, max_entities_per_aggregate: 7, technology_words: [] }]);
    expect(tables.interface).toEqual([{ id: 'TL-IF01', title: 'Lending API', product_id: 'TL', kind: 'API', description: 'Other libraries lend through it.', public: false }]);
    expect(changes).toHaveLength(4);
    expect(todos).toEqual([
      expect.stringContaining('change its type to quality where it is one, among TL-STD-CODE'),
      expect.stringContaining('change public to true where it is one, among TL-IF01'),
    ]);
  });

  it('LA-PRD-UC03-R08-T13 3-to-4 drops a product\'s declaration of a provided_by, fills or generates pair its own kind now has, as Lathe\'s kinds have them, and keeps every other', async () => {
    const tables: Record<string, Record<string, unknown>[]> = {
      product_kind: [
        { name: 'report', product_id: 'TL', stage: 'technical-specification', obligation: false, complexity: 'accidental' },
        { name: 'promise', product_id: 'TL', stage: 'use-cases', obligation: true, complexity: 'essential' },
      ],
      product_relation: [
        { name: 'fills', source_kind: 'report', target_kind: 'slot', product_id: 'TL' },
        { name: 'generates', source_kind: 'tooling', target_kind: 'report', product_id: 'TL' },
        { name: 'provided_by', source_kind: 'promise', target_kind: 'integration', product_id: 'TL' },
        { name: 'provided_by', source_kind: 'view', target_kind: 'report', product_id: 'TL' },
        { name: 'measured_by', source_kind: 'business_outcome', target_kind: 'report', product_id: 'TL' },
      ],
    };
    const { changes } = await run3to4(tables);
    expect(tables.product_relation!.map((r) => `${String(r.name)} ${String(r.source_kind)} ${String(r.target_kind)}`)).toEqual(['provided_by view report', 'measured_by business_outcome report']);
    expect(changes).toEqual([expect.stringContaining('fills from report to slot, generates from tooling to report, provided_by from promise to integration were dropped')]);
  });

  it("LA-PRD-UC03-R08-T14 3-to-4 merges a use case's flows into one, keeping the union of their steps, marking variants, and reports what it cannot merge", async () => {
    const tables: Record<string, Record<string, unknown>[]> = {
      interface: [
        { id: 'TL-IF01', title: 'Web app', product_id: 'TL', kind: 'web app', description: 'The desk.', public: false },
        { id: 'TL-IF02', title: 'CLI', product_id: 'TL', kind: 'CLI', description: 'The terminal.', public: false },
      ],
      use_case: [{ id: 'TL-LEND-UC01', title: 'Borrow a tool', capability_id: 'TL-LEND-CAP01', goal: 'A member borrows a tool.' }],
      flow: [
        { id: 'TL-LEND-UC01-FL01', title: 'Borrow a tool in the web app', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF01' },
        { id: 'TL-LEND-UC01-FL02', title: 'Borrow a tool through the CLI', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF02' },
      ],
      flow_step: [
        { id: 'TL-LEND-UC01-FL01-S01', title: 'On its page, the librarian opens the desk', flow_id: 'TL-LEND-UC01-FL01', path: 'main', position: 1 },
        { id: 'TL-LEND-UC01-FL01-S02', title: 'On its page, the librarian lends the tool', flow_id: 'TL-LEND-UC01-FL01', path: 'main', position: 2 },
        { id: 'TL-LEND-UC01-FL02-S01', title: 'The librarian lends the tool', flow_id: 'TL-LEND-UC01-FL02', path: 'main', position: 1 },
        { id: 'TL-LEND-UC01-FL02-S02', title: 'A tool on loan is refused', flow_id: 'TL-LEND-UC01-FL02', path: 'refused', position: 1 },
      ],
      invokes: [
        { source_id: 'TL-LEND-UC01-FL01-S02', target_id: 'TL-LEND-CMD01' },
        { source_id: 'TL-LEND-UC01-FL02-S01', target_id: 'TL-LEND-CMD01' },
      ],
      happens_in: [
        { source_id: 'TL-LEND-UC01-FL01-S01', target_id: 'TL-V01' },
        { source_id: 'TL-LEND-UC01-FL01-S02', target_id: 'TL-V01' },
      ],
      fulfills: [
        { source_id: 'TL-LEND-UC01-FL01-S02', target_id: 'TL-LEND-UC01-R01' },
        { source_id: 'TL-LEND-UC01-FL02-S01', target_id: 'TL-LEND-UC01-R02' },
      ],
      flow_test: [
        { id: 'TL-LEND-UC01-FL01-T', title: 'Borrow in a browser', flow_id: 'TL-LEND-UC01-FL01', level: 'browser', state: 'automated', file: 'e2e/borrow.spec.ts' },
        { id: 'TL-LEND-UC01-FL02-T', title: 'Borrow from the terminal', flow_id: 'TL-LEND-UC01-FL02', level: 'system', state: 'automated', file: 'test/borrow.test.ts' },
      ],
      starts_from: [{ source_id: 'TL-LEND-UC01-FL01-T', target_id: 'TL-LEND-TD01' }],
      measured_by: [{ source_id: 'TL-BO01', target_id: 'TL-LEND-UC01-FL01-T' }],
    };
    const { changes, todos } = await run3to4(tables);
    expect(tables.flow).toEqual([{ id: 'TL-LEND-UC01-FL', title: 'Borrow a tool', use_case_id: 'TL-LEND-UC01' }]);
    // The step both flows invoke the command in is one, with both requirements; the desk is the web app's alone.
    expect(tables.flow_step).toEqual([
      { id: 'TL-LEND-UC01-FL-S01', title: 'On its page, the librarian opens the desk', flow_id: 'TL-LEND-UC01-FL', path: 'main', position: 1, interface_id: 'TL-IF01' },
      { id: 'TL-LEND-UC01-FL-S02', title: 'On its page, the librarian lends the tool', flow_id: 'TL-LEND-UC01-FL', path: 'main', position: 2 },
      { id: 'TL-LEND-UC01-FL-S03', title: 'A tool on loan is refused', flow_id: 'TL-LEND-UC01-FL', path: 'refused', position: 1, interface_id: 'TL-IF02' },
    ]);
    expect(tables.invokes).toEqual([{ source_id: 'TL-LEND-UC01-FL-S02', target_id: 'TL-LEND-CMD01' }]);
    expect(tables.fulfills).toEqual([{ source_id: 'TL-LEND-UC01-FL-S02', target_id: 'TL-LEND-UC01-R01' }, { source_id: 'TL-LEND-UC01-FL-S02', target_id: 'TL-LEND-UC01-R02' }]);
    expect(tables.happens_in).toEqual([]);
    expect(tables.presents).toEqual([{ source_id: 'TL-V01', target_id: 'TL-LEND-CMD01' }]);
    expect(tables.offers).toEqual([{ source_id: 'TL-IF01', target_id: 'TL-LEND-UC01' }, { source_id: 'TL-IF02', target_id: 'TL-LEND-UC01' }]);
    // The automated test at the cheapest level stays, as the flow's; the other goes, and what named it names the one kept.
    expect(tables.flow_test).toEqual([{ id: 'TL-LEND-UC01-FL-T', title: 'Borrow from the terminal', flow_id: 'TL-LEND-UC01-FL', level: 'system', state: 'automated', file: 'test/borrow.test.ts' }]);
    expect(tables.starts_from).toEqual([]);
    expect(tables.measured_by).toEqual([{ source_id: 'TL-BO01', target_id: 'TL-LEND-UC01-FL-T' }]);
    expect(changes.at(-1)).toMatch(/^Each use case has one flow, the same whatever the interface: 2 flows merged into 1, with 3 steps \(2 variants of one interface\)/);
    expect(todos).toEqual([
      expect.stringContaining('now gone: TL-LEND-UC01-FL01-T (TL-IF01, e2e/borrow.spec.ts)'),
      expect.stringContaining('TL-LEND-UC01-FL-S01 (TL-IF01), TL-LEND-UC01-FL-S03 (TL-IF02)'),
      expect.stringContaining('TL-LEND-UC01-FL-S01 happened in TL-V01'),
      expect.stringContaining('List the roles that use each interface'),
    ]);
  });

  it('LA-PRD-UC03-R08-T12 3-to-4 does nothing to data that is already upgraded', async () => {
    const tables: Record<string, Record<string, unknown>[]> = {
      product_kind: [{ name: 'report', product_id: 'TL', stage: 'technical-specification', complexity: 'essential' }],
      standard: [{ id: 'TL-STD-MONEY', title: 'Money', product_id: 'TL', type: 'quality', description: 'Amounts are exact.' }],
      product_setting: [{ product_id: 'TL', max_children: 15, max_entities_per_aggregate: 7, technology_words: ['Postgres'] }],
      interface: [{ id: 'TL-IF01', title: 'Lending API', product_id: 'TL', kind: 'API', description: 'Other libraries lend through it.', public: true }],
    };
    const before = structuredClone(tables);
    const { changes, todos } = await run3to4(tables);
    expect(tables).toEqual(before);
    expect(changes).toEqual([]);
    expect(todos).toEqual([]);
  });

  const run4to5 = async (tables: Record<string, Record<string, unknown>[]>) => {
    const [step] = (await readConverters(UPGRADES_DIR)).filter((c) => c.from === 4);
    const changes: string[] = [];
    const todos: string[] = [];
    await step!.converter.files!(
      { tables: () => Object.keys(tables), read: (table) => tables[table] ?? [], write: (table, rows) => void (tables[table] = rows) },
      { changed: (text) => changes.push(text), todo: (text) => todos.push(text) },
    );
    return { changes, todos };
  };

  const run5to6 = async (tables: Record<string, Record<string, unknown>[]>) => {
    const [step] = (await readConverters(UPGRADES_DIR)).filter((c) => c.from === 5);
    const changes: string[] = [];
    const todos: string[] = [];
    await step!.converter.files!(
      { tables: () => Object.keys(tables), read: (table) => tables[table] ?? [], write: (table, rows) => void (tables[table] = rows) },
      { changed: (text) => changes.push(text), todo: (text) => todos.push(text) },
    );
    return { changes, todos };
  };

  const run6to7 = async (tables: Record<string, Record<string, unknown>[]>) => {
    const [step] = (await readConverters(UPGRADES_DIR)).filter((c) => c.from === 6);
    const changes: string[] = [];
    const todos: string[] = [];
    await step!.converter.files!(
      { tables: () => Object.keys(tables), read: (table) => tables[table] ?? [], write: (table, rows) => void (tables[table] = rows) },
      { changed: (text) => changes.push(text), todo: (text) => todos.push(text) },
    );
    return { changes, todos };
  };

  it("LA-PRD-UC03-R08-T15 4-to-5 changes no row, asks to rename a product's own kind or relation that clashes with a new table, and to write the journey each duration outcome times", async () => {
    const tables: Record<string, Record<string, unknown>[]> = {
      product_kind: [{ name: 'journey', product_id: 'TL' }, { name: 'report', product_id: 'TL' }],
      product_relation: [
        { name: 'carries_out', source_kind: 'report', target_kind: 'use_case', product_id: 'TL' },
        { name: 'carries_out', source_kind: 'report', target_kind: 'policy', product_id: 'TL' },
        { name: 'measured_by', source_kind: 'business_outcome', target_kind: 'report', product_id: 'TL' },
      ],
      business_outcome: [
        { id: 'TL-BO01', measure: 'Share of members with a loan in the last 90 days.' },
        { id: 'TL-BO05', measure: 'Median days from a damage report to its repair.' },
        { id: 'TL-BO06', measure: 'How long a new member waits for a first loan.' },
      ],
    };
    const before = structuredClone(tables);
    const { changes, todos } = await run4to5(tables);
    expect(tables).toEqual(before);
    expect(changes).toEqual([]);
    expect(todos).toEqual([
      expect.stringContaining('rename your own kind journey, relation carries_out'),
      expect.stringContaining('link it to the outcome (serves): TL-BO05, TL-BO06.'),
    ]);
  });

  it('LA-PRD-UC03-R08-T16 4-to-5 tells a product with no journeys where they go, and says nothing to one that has them', async () => {
    const none: Record<string, Record<string, unknown>[]> = { business_outcome: [{ id: 'TL-BO01', measure: 'Share of members with a loan.' }] };
    expect((await run4to5(none)).todos).toEqual([expect.stringContaining('Journeys arrive in Discovery')]);
    const some: Record<string, Record<string, unknown>[]> = { ...none, journey: [{ id: 'TL-JR01', product_id: 'TL' }] };
    const before = structuredClone(some);
    const { changes, todos } = await run4to5(some);
    expect(some).toEqual(before);
    expect(changes).toEqual([]);
    expect(todos).toEqual([]);
  });

  it("LA-PRD-UC03-R08-T17 5-to-6 numbers each product's domains from 1 in ID order, with the numbers inside IDs compared by value, and changes nothing else", async () => {
    const tables: Record<string, Record<string, unknown>[]> = {
      domain: [
        { id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core' },
        { id: 'XX-D10', title: 'Tenth', product_id: 'XX', subdomain_type: 'core' },
        { id: 'XX-D2', title: 'Second', product_id: 'XX', subdomain_type: 'core' },
        { id: 'TL-CAT', title: 'Catalog', product_id: 'TL', subdomain_type: 'supporting', notes: 'Kept.' },
      ],
      capability: [{ id: 'TL-LEND-CAP01', domain_id: 'TL-LEND', position: 1 }],
    };
    const { changes, todos } = await run5to6(tables);
    expect(tables.domain.map((d) => `${d.id} ${d.position}`)).toEqual(['TL-LEND 2', 'XX-D10 2', 'XX-D2 1', 'TL-CAT 1']);
    expect(Object.keys(tables.domain[3])).toEqual(['id', 'title', 'product_id', 'position', 'subdomain_type', 'notes']);
    expect(tables.capability).toEqual([{ id: 'TL-LEND-CAP01', domain_id: 'TL-LEND', position: 1 }]);
    expect(changes).toEqual(['Each domain has a position: 4 numbered from 1 within their product, in ID order.']);
    expect(todos).toEqual([]);
    expect((await run5to6({})).changes).toEqual([]);
  });

  it('LA-PRD-UC03-R08-T18 6-to-7 moves each product kind in interaction-design to interface-design, keeps its other fields and every other kind, and does nothing to data already upgraded', async () => {
    const tables: Record<string, Record<string, unknown>[]> = {
      product_kind: [
        { name: 'cli_command', product_id: 'TL', label: 'CLI command', stage: 'interaction-design', obligation: false },
        { name: 'runbook', product_id: 'TL', label: 'Runbook', stage: 'technical-specification', obligation: false },
      ],
    };
    const { changes, todos } = await run6to7(tables);
    expect(tables.product_kind).toEqual([
      { name: 'cli_command', product_id: 'TL', label: 'CLI command', stage: 'interface-design', obligation: false },
      { name: 'runbook', product_id: 'TL', label: 'Runbook', stage: 'technical-specification', obligation: false },
    ]);
    expect(changes).toEqual(["Interaction design is interface design: 1 of the product's own kinds (cli_command) moved to stage interface-design."]);
    expect(todos).toEqual([]);
    const before = structuredClone(tables);
    expect((await run6to7(tables)).changes).toEqual([]);
    expect(tables).toEqual(before);
  });
});
