// Moving records to another domain, and a requirement to another use case: each record moved, and every record under
// it, takes the IDs of where it went, and every record that names one of them names the new ID.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ALL_COMMANDS } from '../../src/commands.ts';
import { runCommand, runCommands } from '../../src/platform/commands/run.ts';
import { StoreError } from '../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../src/platform/data/store.ts';
import { everyKind, type Data } from '../store/fixture.ts';
import { adding, writeData } from '../helpers.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

const command = (name: string) => ALL_COMMANDS.find((c) => `${c.slice.name} ${c.name}` === name)!;

/** TL with a second domain, Catalog, a product kind that sits under a domain, and a second product. */
const data = (): Data =>
  adding(everyKind(), {
    domain: [
      { id: 'TL-CAT', title: 'Catalog', product_id: 'TL', position: 2, subdomain_type: 'supporting', description: 'The tools the library holds.' },
      { id: 'NX-E', title: 'Elsewhere', product_id: 'NX', position: 1, subdomain_type: 'generic', description: 'Work done in the second product.' },
    ],
    product: [{ id: 'NX', title: 'Next product', description: 'A second product beside the first.' }],
    product_kind: [{ name: 'shared_module', product_id: 'TL', label: 'Shared module', description: 'Code several records use.', parent_kind: 'domain', stage: 'technical-specification', obligation: false, complexity: 'accidental', id_pattern: '<P>-<D>-MOD<nn>' }],
    shared_module: [{ id: 'TL-LEND-MOD01', title: 'dates.ts', domain_id: 'TL-LEND' }],
    data_store: [{ id: 'TL-LEND-STORE02', title: 'loanCache', domain_id: 'TL-LEND', kind: 'memory', description: 'Loans kept while the desk app runs.' }],
  });

async function storeOf(): Promise<Store> {
  const store = await openStore(writeData(data()), { latheDataDir: null });
  open.push(store);
  return store;
}

async function refusal(store: Store, name: string, input: unknown): Promise<StoreError> {
  try {
    await runCommand(store, command(name), input);
  } catch (error) {
    if (error instanceof StoreError) return error;
    throw error;
  }
  throw new Error(`${name} was not refused`);
}

/** Every data file's text. */
const files = (store: Store) => readdirSync(store.dataDir).map((f) => readFileSync(path.join(store.dataDir, f), 'utf8')).join('');

describe('LA-UCS-UC13-R02-T01 each record moved to another domain takes its IDs, with everything under it, and nothing names an old ID', () => {
  it('moves the whole of a domain\'s records to another, renaming each and every mention', async () => {
    const store = await storeOf();
    const moves: [string, string][] = [
      ['aggregate move-aggregate', 'TL-LEND-A1'],
      ['aggregate move-aggregate', 'TL-LEND-A2'],
      ['domain move-term', 'TL-LEND-TM01'],
      ['domain move-term', 'TL-LEND-TM02'],
      ['domain move-domain-service', 'TL-LEND-DS01'],
      ['domain move-repository', 'TL-LEND-REPO01'],
      ['read-model move-read-model', 'TL-LEND-RM01'],
      ['specification move-specification', 'TL-LEND-SP01'],
      ['test-data-set move-test-data-set', 'TL-LEND-TD01'],
      ['tooling move-tooling', 'TL-LEND-TOOL01'],
      ['entry-point move-entry-point', 'TL-LEND-ENTRY01'],
      ['data-store move-data-store', 'TL-LEND-STORE02'],
      ['table move-table', 'TL-LEND-TB01'],
      ['extension-record move-extension-record', 'TL-LEND-MOD01'],
    ];
    await runCommands(store, [...moves.map(([name, id]) => [command(name), { id, domain_id: 'TL-CAT' }] as const), [command('product move-question'), { id: 'TL-LEND-Q01', domain_id: 'TL-CAT' }] as const]);
    // Each record and those under it, down to a CLI command under a command and a step's test, take TL-CAT's IDs.
    for (const id of ['TL-CAT-A1', 'TL-CAT-EN01', 'TL-CAT-CMD01', 'TL-CAT-CMD01-CLI', 'TL-CAT-UC01', 'TL-CAT-UC01-R01-T01', 'TL-CAT-TM02', 'TL-CAT-REPO01', 'TL-CAT-RM01-PJ', 'TL-CAT-SP01-PR', 'TL-CAT-TD01', 'TL-CAT-TOOL01', 'TL-CAT-TB01', 'TL-CAT-MOD01', 'TL-CAT-DS01-SV', 'TL-CAT-ENTRY01', 'TL-CAT-STORE02', 'TL-CAT-Q01']) {
      expect(store.record(id), id).toBeDefined();
    }
    // Links, fields and text name the new IDs: nothing anywhere names one that is gone.
    expect(files(store)).not.toMatch(/TL-LEND-/);
    expect(store.rows('builds_on')).toEqual([{ source_id: 'TL-CAT-TM02', target_id: 'TL-CAT-TM01' }]);
    expect(store.rows('starts_from')).toContainEqual({ source_id: 'TL-INT01-T01', target_id: 'TL-CAT-TD01' });
    expect(store.record('TL-CAT-UC01')?.row.domain_id).toBe('TL-CAT');
  });

  it('moves a use case to another domain with that domain\'s IDs and a result there, so none is left outside its domain', async () => {
    const other = adding(data(), {
      aggregate: [{ id: 'TL-CAT-A9', title: 'Listing', domain_id: 'TL-CAT', identity: 'Listing ID', description: 'A tool on the shelf.' }],
      entity: [{ id: 'TL-CAT-EN09', title: 'Listing', aggregate_id: 'TL-CAT-A9', role: 'root', description: 'The listing itself.' }],
      command: [{ id: 'TL-CAT-CMD09', title: 'List a tool', entity_id: 'TL-CAT-EN09', description: 'Puts a tool on the shelf.' }],
    });
    const store = await openStore(writeData(other), { latheDataDir: null });
    open.push(store);
    expect((await refusal(store, 'use-case move-use-case', { id: 'TL-LEND-UC01', domain_id: 'TL-CAT' })).problems[0]).toMatchObject({ rule: 'use-case-result-in-domain' });
    await runCommand(store, command('use-case move-use-case'), { id: 'TL-LEND-UC01', domain_id: 'TL-CAT', result_id: 'TL-CAT-CMD09' });
    for (const id of ['TL-CAT-UC01', 'TL-CAT-UC01-FL', 'TL-CAT-UC01-FL-S01', 'TL-CAT-UC01-FL-T', 'TL-CAT-UC01-R01', 'TL-CAT-UC01-R01-T01']) expect(store.record(id), id).toBeDefined();
    expect(files(store)).not.toMatch(/TL-LEND-UC01/);
  });

  it('refuses a domain of another product and a new ID another record has, changing nothing', async () => {
    const store = await storeOf();
    const before = files(store);
    expect((await refusal(store, 'domain move-term', { id: 'TL-LEND-TM01', domain_id: 'NX-E' })).problems[0]).toMatchObject({ rule: 'parent' });
    await runCommand(store, command('domain add-term'), { id: 'TL-CAT-TM01', title: 'Listing', domain_id: 'TL-CAT', meaning: 'A tool on the shelf.' });
    const taken = await refusal(store, 'domain move-term', { id: 'TL-LEND-TM01', domain_id: 'TL-CAT' });
    expect(taken.problems[0]).toMatchObject({ rule: 'id-taken', message: 'TL-LEND-TM01 cannot become TL-CAT-TM01: Term TL-CAT-TM01 already has that ID' });
    expect((await refusal(store, 'aggregate move-aggregate', { id: 'TL-LEND-A1', domain_id: 'TL-LEND' })).problems[0]).toMatchObject({ rule: 'parent' });
    expect((await refusal(store, 'data-store move-data-store', { id: 'TL-STORE01', domain_id: 'TL-CAT' })).problems[0]).toMatchObject({ rule: 'parent' });
    expect(files(store).replace(/\{"id":"TL-CAT-TM01"[^\n]*\n/, '')).toBe(before);
  });
});

describe('LA-UCS-UC14-R01-T01 a requirement moved to another use case takes its next number, its tests follow, and one a step fulfills stays', () => {
  it('renumbers the requirement under its new use case, with its tests, and refuses one a step fulfills', async () => {
    const store = await storeOf();
    await runCommand(store, command('use-case add-use-case'), { id: 'TL-LEND-UC02', title: 'List a tool', domain_id: 'TL-LEND', goal: 'Put a tool on the shelf.', result_id: 'TL-LEND-CMD01', actors: ['Librarian'] });
    await runCommand(store, command('use-case add-uc-requirement'), { id: 'TL-LEND-UC01-R09', title: 'Tool has a name', use_case_id: 'TL-LEND-UC01', statement: 'A tool MUST have a name; see TL-LEND-UC01-R09.' });
    await runCommand(store, command('use-case add-use-case-test'), { id: 'TL-LEND-UC01-R09-T01', title: 'A tool with no name is refused', uc_requirement_id: 'TL-LEND-UC01-R09', level: 'unit', state: 'not automated yet', when: 'Adds a tool.', then: 'Expects a refusal.' });
    await runCommand(store, command('use-case move-uc-requirement'), { id: 'TL-LEND-UC01-R09', use_case_id: 'TL-LEND-UC02' });
    expect(store.record('TL-LEND-UC02-R01')?.row).toMatchObject({ use_case_id: 'TL-LEND-UC02', statement: 'A tool MUST have a name; see TL-LEND-UC02-R01.' });
    expect(store.record('TL-LEND-UC02-R01-T01')?.row.uc_requirement_id).toBe('TL-LEND-UC02-R01');
    expect(files(store)).not.toMatch(/TL-LEND-UC01-R09/);
    const fulfilled = await refusal(store, 'use-case move-uc-requirement', { id: 'TL-LEND-UC01-R01', use_case_id: 'TL-LEND-UC02' });
    expect(fulfilled.problems[0]).toMatchObject({ rule: 'fulfilled' });
  });
});
