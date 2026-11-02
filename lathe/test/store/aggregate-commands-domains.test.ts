// LA-PAT-AGGREGATE-COMMANDS' store rules, proved in the domains that owe them besides the six stage domains: Traceability, through
// the Slot filling, Provision and Pattern following aggregates, and Checking, through the Product setting aggregate.
// Each runs that domain's own commands on a store, as every interface runs them.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { openStore, type Store } from '../../src/index.ts';
import { refusals, refusedBy, removeData, run, writeData } from '../helpers.ts';

afterAll(removeData);

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

/** A product with a pattern, its setting and slot, three tooling records (TOOL01 generates TOOL02), an integration and a data store. */
const rows = () => ({
  product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }],
  domain: [{ id: 'TL-LEND', title: 'Lending', product_id: 'TL', position: 1, subdomain_type: 'core', description: 'Lending tools to members and getting them back.' }],
  pattern: [{ id: 'TL-PAT-ACT', title: 'Librarian action', product_id: 'TL', description: 'An action the librarian takes at the desk.' }],
  pattern_setting: [
    { pattern_id: 'TL-PAT-ACT', position: 1, name: 'record', meaning: 'The record the action saves.' },
    { pattern_id: 'TL-PAT-ACT', position: 2, name: 'result', meaning: 'What the librarian sees after.' },
  ],
  slot: [{ id: 'TL-PAT-ACT-SL01', title: 'Refusal message', pattern_id: 'TL-PAT-ACT', statement: 'A fill MUST word the refusal for the librarian.' }],
  tooling: [
    { id: 'TL-LEND-TOOL01', title: 'generate.ts', domain_id: 'TL-LEND', file: 'scripts/generate.ts' },
    { id: 'TL-LEND-TOOL02', title: 'routes.generated.ts', domain_id: 'TL-LEND', file: 'src/routes.generated.ts' },
    { id: 'TL-LEND-TOOL03', title: 'refusals.ts', domain_id: 'TL-LEND', file: 'src/refusals.ts' },
  ],
  generates: [{ source_id: 'TL-LEND-TOOL01', target_id: 'TL-LEND-TOOL02' }],
  integration: [{ id: 'TL-INT01', title: 'Database host', system: 'Managed PostgreSQL', description: "The service that runs the library's database." }],
  data_store: [{ id: 'TL-STORE01', title: 'DATABASE_URL', product_id: 'TL', kind: 'database', description: "The library's database." }],
});

async function fresh(): Promise<{ store: Store; root: string }> {
  const root = writeData(rows());
  const store = await openStore(root, { latheDataDir: null });
  open.push(store);
  return { store, root };
}

const files = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).map((f) => [f, readFileSync(path.join(root, 'data', f), 'utf8')]));
const mtimes = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).map((f) => [f, statSync(path.join(root, 'data', f)).mtimeMs]));
const changed = (before: Record<string, number>, after: Record<string, number>) => Object.keys(after).filter((f) => after[f] !== before[f]);

describe('in Traceability', () => {
  it('LA-PAT-AGGREGATE-COMMANDS-R03-T02 a refused fill leaves the data and every file as they were', async () => {
    const { store, root } = await fresh();
    const before = files(root);
    expect(await refusedBy(store, 'slot-filling fill-slot', { record_id: 'TL-LEND-TOOL02', slot_id: 'TL-PAT-ACT-SL01' })).toEqual([expect.objectContaining({ rule: 'fill-is-hand-written' })]);
    expect(store.rows('fills')).toEqual([]);
    expect(files(root)).toEqual(before);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R04-T02 a provider of the wrong kind is refused by the schema\'s own rules before any file changes', async () => {
    const { store, root } = await fresh();
    const before = mtimes(root);
    expect(await refusedBy(store, 'provision name-provider', { record_id: 'TL-STORE01', provider_id: 'TL-LEND-TOOL01' })).toEqual([expect.objectContaining({ rule: 'relation-pair' })]);
    expect(changed(before, mtimes(root))).toEqual([]);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R05-T02 a fill rewrites only the fills file, its rows sorted by key', async () => {
    const { store, root } = await fresh();
    const before = mtimes(root);
    await run(store, 'slot-filling fill-slot', { record_id: 'TL-LEND-TOOL03', slot_id: 'TL-PAT-ACT-SL01' });
    const result = await run(store, 'slot-filling fill-slot', { record_id: 'TL-LEND-TOOL01', slot_id: 'TL-PAT-ACT-SL01' });
    expect(result.files).toEqual(['fills.jsonl']);
    expect(changed(before, mtimes(root))).toEqual(['fills.jsonl']);
    expect(readFileSync(path.join(root, 'data', 'fills.jsonl'), 'utf8')).toBe(
      ['TL-LEND-TOOL01', 'TL-LEND-TOOL03'].map((s) => `{"source_id":"${s}","target_id":"TL-PAT-ACT-SL01"}\n`).join(''),
    );
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R06-T02 two writes at once each land on what the other left', async () => {
    const { store } = await fresh();
    await Promise.all([
      run(store, 'slot-filling fill-slot', { record_id: 'TL-LEND-TOOL03', slot_id: 'TL-PAT-ACT-SL01' }),
      run(store, 'provision name-provider', { record_id: 'TL-STORE01', provider_id: 'TL-INT01' }),
      run(store, 'slot-filling fill-slot', { record_id: 'TL-LEND-TOOL01', slot_id: 'TL-PAT-ACT-SL01' }),
    ]);
    expect(store.rows('fills')).toHaveLength(2);
    expect(store.rows('provided_by')).toEqual([{ source_id: 'TL-STORE01', target_id: 'TL-INT01' }]);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R07-T02 a refused following names every problem, each with its rule, table and row', async () => {
    const { store } = await fresh();
    const problems = await refusedBy(store, 'pattern-following follow-pattern', { follower_id: 'TL-NONE', pattern_id: 'TL-PAT-NONE' });
    expect(problems).toEqual([
      expect.objectContaining({ rule: 'foreign-key', table: 'follows', key: 'source_id TL-NONE, target_id TL-PAT-NONE', message: expect.stringContaining('"TL-NONE" names no follows_source') }),
      expect.objectContaining({ rule: 'foreign-key', table: 'follows', key: 'source_id TL-NONE, target_id TL-PAT-NONE', message: expect.stringContaining('"TL-PAT-NONE" names no pattern') }),
    ]);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R08-T02 a fill without its slot is refused on load, naming the file and line', async () => {
    const problems = await refusals({ ...rows(), fills: [{ source_id: 'TL-LEND-TOOL03' }] });
    expect(problems).toEqual([expect.objectContaining({ rule: 'required', file: 'data/fills.jsonl', line: 1 })]);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R09-T02 a following\'s setting values are rows of their own table under it, in the pattern\'s order', async () => {
    const { store } = await fresh();
    await run(store, 'pattern-following follow-pattern', { follower_id: 'TL-LEND', pattern_id: 'TL-PAT-ACT', setting_values: [{ setting: 'result', value: 'The loan.' }, { setting: 'record', value: 'Loan' }] });
    expect(store.rows('follows')).toEqual([{ source_id: 'TL-LEND', target_id: 'TL-PAT-ACT' }]);
    expect(store.rows('setting_value').map((r) => [r.follower_id, r.setting, r.value])).toEqual([
      ['TL-LEND', 'record', 'Loan'],
      ['TL-LEND', 'result', 'The loan.'],
    ]);
  });
});

describe('in Checking', () => {
  it('LA-PAT-AGGREGATE-COMMANDS-R03-T03 refused limits leave the data and every file as they were', async () => {
    const { store, root } = await fresh();
    const before = files(root);
    expect((await refusedBy(store, 'product-setting set-limits', { product_id: 'TL', max_children: 0, max_entities_per_aggregate: 7 })).length).toBeGreaterThan(0);
    expect(store.rows('product_setting')).toEqual([]);
    expect(files(root)).toEqual(before);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R04-T03 limits for a product that does not exist are refused by the schema\'s own rules before any file changes', async () => {
    const { store, root } = await fresh();
    const before = mtimes(root);
    expect((await refusedBy(store, 'product-setting set-limits', { product_id: 'XX', max_children: 9, max_entities_per_aggregate: 7 })).length).toBeGreaterThan(0);
    expect(changed(before, mtimes(root))).toEqual([]);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R05-T03 setting the limits rewrites only the product settings file', async () => {
    const { store, root } = await fresh();
    const before = mtimes(root);
    const result = await run(store, 'product-setting set-limits', { product_id: 'TL', max_children: 12, max_entities_per_aggregate: 6 });
    expect(result.files).toEqual(['product_setting.jsonl']);
    expect(changed(before, mtimes(root))).toEqual(['product_setting.jsonl']);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R06-T03 the limits and the technology words set at once are both kept', async () => {
    const { store } = await fresh();
    await run(store, 'product-setting set-limits', { product_id: 'TL', max_children: 12, max_entities_per_aggregate: 6 });
    await Promise.all([
      run(store, 'product-setting set-limits', { product_id: 'TL', max_children: 10, max_entities_per_aggregate: 5 }),
      run(store, 'product-setting set-technology-words', { product_id: 'TL', technology_words: ['Hono'] }),
    ]);
    expect(store.rows('product_setting')).toEqual([expect.objectContaining({ product_id: 'TL', max_children: 10, max_entities_per_aggregate: 5, technology_words: ['Hono'] })]);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R07-T03 refused limits name the problem with its rule, table and row', async () => {
    const { store } = await fresh();
    expect(await refusedBy(store, 'product-setting set-limits', { product_id: 'TL', max_children: 0, max_entities_per_aggregate: 7 })).toEqual([
      expect.objectContaining({ rule: 'check', table: 'product_setting', key: 'TL', message: expect.stringContaining('max_children') }),
    ]);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R08-T03 a product setting without its limits is refused on load, naming the file and line', async () => {
    const problems = await refusals({ ...rows(), product_setting: [{ product_id: 'TL', max_entities_per_aggregate: 7, technology_words: [] }] });
    expect(problems).toEqual([expect.objectContaining({ rule: 'required', file: 'data/product_setting.jsonl', line: 1 })]);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R09-T03 a product\'s settings are one row of their own table under it, the words in order', async () => {
    const { store } = await fresh();
    await run(store, 'product-setting set-technology-words', { product_id: 'TL', technology_words: ['Vite', 'Hono', 'Vite'] });
    expect(store.rows('product_setting')).toEqual([{ product_id: 'TL', max_children: 15, max_entities_per_aggregate: 7, technology_words: ['Hono', 'Vite'] }]);
  });
});
