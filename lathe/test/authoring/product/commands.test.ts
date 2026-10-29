// The Product aggregate's commands, queries and refusals (LA-AUT-A1), run on a store as the CLI, the MCP tools and
// the HTTP API run them: each command changes one product through ProductRepository, holds it to its rules before it
// saves, and is refused with its reason, changing nothing. The data starts from the aggregate's own test data set
// (LA-AUT-TD101), built with its own Add commands.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_INTERFACE } from '../../../src/authoring/product/commands/add-interface.ts';
import { ADD_PRODUCT } from '../../../src/authoring/product/commands/add-product.ts';
import { ADD_QUESTION } from '../../../src/authoring/product/commands/add-question.ts';
import { CHANGE_INTERFACE } from '../../../src/authoring/product/commands/change-interface.ts';
import { CHANGE_PRODUCT } from '../../../src/authoring/product/commands/change-product.ts';
import { CHANGE_PRODUCT_KIND } from '../../../src/authoring/product/commands/change-product-kind.ts';
import { CHANGE_PRODUCT_RELATION } from '../../../src/authoring/product/commands/change-product-relation.ts';
import { CHANGE_QUESTION } from '../../../src/authoring/product/commands/change-question.ts';
import { DECLARE_PRODUCT_KIND } from '../../../src/authoring/product/commands/declare-product-kind.ts';
import { DECLARE_PRODUCT_RELATION } from '../../../src/authoring/product/commands/declare-product-relation.ts';
import { MOVE_QUESTION } from '../../../src/authoring/product/commands/move-question.ts';
import { REMOVE_INTERFACE } from '../../../src/authoring/product/commands/remove-interface.ts';
import { REMOVE_PRODUCT_KIND } from '../../../src/authoring/product/commands/remove-product-kind.ts';
import { REMOVE_PRODUCT_RELATION } from '../../../src/authoring/product/commands/remove-product-relation.ts';
import { REMOVE_QUESTION } from '../../../src/authoring/product/commands/remove-question.ts';
import { GET_PRODUCT, LIST_PRODUCTS, LIST_INTERFACES, NEXT_PRODUCT_ID } from '../../../src/authoring/product/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool, tools } from '../../../src/cli/mcp.ts';
import { readSchema } from '../../../src/cli/operations.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { everyKind, type Data } from '../../store/fixture.ts';
import { writeData } from '../../helpers.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

async function storeAt(root: string): Promise<Store> {
  const store = await openStore(root, { latheDataDir: null });
  open.push(store);
  return store;
}

/**
 * The Product aggregate's test data set (LA-AUT-TD101), built with its own Add commands on an empty product repo:
 * product TL with two roles, an interface, an open question about nothing yet, a product kind with two fields and a
 * relation of its own.
 */
async function productDataSet(store: Store): Promise<Store> {
  await runCommand(store, ADD_PRODUCT, {
    id: 'TL',
    title: 'Tool Library',
    description: 'A neighborhood tool library.',
    roles: [
      { name: 'Member', description: 'Someone who borrows tools.' },
      { name: 'Librarian', description: 'Someone who lends tools at the desk.' },
    ],
  });
  await runCommand(store, ADD_INTERFACE, { id: 'TL-IF01', title: 'Web app', product_id: 'TL', kind: 'web app', description: 'The desk app the librarian uses.' });
  await runCommand(store, ADD_QUESTION, { id: 'TL-Q01', title: 'How long is a loan?', product_id: 'TL', owner: 'Librarian', description: 'Two weeks or one.' });
  await runCommand(store, DECLARE_PRODUCT_KIND, {
    name: 'report',
    product_id: 'TL',
    label: 'Report',
    description: 'A script that measures the business outcomes.',
    parent_kind: 'product',
    stage: 'technical-specification',
    obligation: false,
    fields: [
      { name: 'file', type: 'text', required: true, description: 'The script.' },
      { name: 'usage', type: 'text', required: false, description: 'How it is run.' },
    ],
  });
  await runCommand(store, DECLARE_PRODUCT_RELATION, {
    name: 'measured_by',
    source_kind: 'business_outcome',
    target_kind: 'report',
    product_id: 'TL',
    forward_label: 'Measured by',
    reverse_label: 'Measures',
    description: 'The report measures the outcome.',
  });
  return store;
}

/** A store holding the aggregate's own data set and nothing else. */
const ownStore = async (): Promise<Store> => productDataSet(await storeAt(writeData({})));

/** The refusal a command gets, or a failure when it is not refused. */
async function refusal(store: Store, definition: AnyCommand, input: unknown): Promise<StoreError> {
  try {
    await runCommand(store, definition, input);
  } catch (error) {
    if (error instanceof StoreError) return error;
    throw error;
  }
  throw new Error(`${definition.name} was not refused`);
}

const fileOf = (store: Store, table: string) => readFileSync(path.join(store.dataDir, `${table}.jsonl`), 'utf8');

describe('LA-AUT-UC23-R01-T51 each Product command changes one product through ProductRepository, held to its rules', () => {
  it('adds a product whole with its roles and interfaces, writing only its own tables', async () => {
    const store = await ownStore();
    expect(store.rows('role').map((r) => r.name)).toEqual(['Librarian', 'Member']);
    const committed = await runCommand(store, CHANGE_PRODUCT, { id: 'TL', notes: 'Run by volunteers.', roles: [{ name: 'Member', description: 'Someone who borrows tools.' }, { name: 'Librarian', description: 'Someone who lends tools.' }, { name: 'Owner', description: 'Someone who keeps the spec.' }] });
    expect(committed.tables).toEqual(['product', 'role']);
    await runCommand(store, CHANGE_PRODUCT, { id: 'TL', notes: null });
    expect(store.record('TL')?.row).toEqual({ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' });
    expect((await runCommand(store, CHANGE_INTERFACE, { id: 'TL-IF01', kind: 'desktop' })).tables).toEqual(['interface']);
    const whole = runQuery(store, GET_PRODUCT, { id: 'TL-IF01' }) as ReturnType<typeof GET_PRODUCT.run>;
    expect(whole).toMatchObject({ product: { id: 'TL' }, interfaces: [{ id: 'TL-IF01', kind: 'desktop' }], questions: [{ id: 'TL-Q01', about: [] }] });
    expect(whole.roles.map((r) => r.name).sort()).toEqual(['Librarian', 'Member', 'Owner']);
    expect(runQuery(store, LIST_INTERFACES, { product_id: 'TL' })).toEqual([{ id: 'TL-IF01', title: 'Web app', kind: 'desktop' }]);
    expect(runQuery(store, LIST_PRODUCTS, {})).toEqual([{ id: 'TL', title: 'Tool Library' }]);
    expect(runQuery(store, NEXT_PRODUCT_ID, { kind: 'interface', parent: 'TL' })).toBe('TL-IF02');
    expect(runQuery(store, NEXT_PRODUCT_ID, { kind: 'question', parent: 'TL' })).toBe('TL-Q02');
  });

  it('refuses an input that is not the command\'s: an unknown field, a missing one, a wrong type, a part of another shape', async () => {
    const store = await ownStore();
    await expect(runCommand(store, ADD_INTERFACE, { id: 'TL-IF02', title: 'CLI', product_id: 'TL', kind: 'CLI' })).rejects.toThrow(new InputError('add-interface needs description'));
    await expect(runCommand(store, CHANGE_INTERFACE, { id: 'TL-IF01', product_id: 'TL' })).rejects.toThrow(/change-interface takes no product_id/);
    await expect(runCommand(store, CHANGE_INTERFACE, { id: 'TL-IF01', kind: 'phone' })).rejects.toThrow(/kind "phone" is not one of/);
    await expect(runCommand(store, CHANGE_PRODUCT, { id: 'TL', roles: [{ name: 'Member' }] })).rejects.toThrow(/roles .* has an item with no description/);
    await expect(runCommand(store, CHANGE_PRODUCT, { id: 'TL', title: null })).rejects.toThrow(/title cannot be cleared/);
    expect((await refusal(store, CHANGE_PRODUCT, { id: 'XX', title: 'Nothing' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no product XX' });
    expect((await refusal(store, ADD_INTERFACE, { id: 'TL-IF01', title: 'Again', product_id: 'TL', kind: 'CLI', description: 'Twice.' })).problems[0].rule).toBe('primary-key');
  });
});

describe('LA-AUT-UC04-R01-T51 a product kind and relation are declared, changed and removed through the Product aggregate, and the schema follows', () => {
  it('gives a declared kind its table, changes its fields, and removes it once nothing uses it', async () => {
    const store = await ownStore();
    expect(store.schema.tables.report.columns.map((c) => c.name)).toEqual(['id', 'title', 'product_id', 'file', 'usage']);
    expect(store.schema.relations.measured_by).toBeDefined();
    const changed = await runCommand(store, CHANGE_PRODUCT_KIND, { name: 'report', label: 'Outcome report', fields: [{ name: 'file', type: 'text', required: true, description: 'The script.' }] });
    expect(changed.tables).toEqual(['product_kind', 'product_kind_field']);
    expect(store.schema.tables.report.columns.map((c) => c.name)).toEqual(['id', 'title', 'product_id', 'file']);
    await runCommand(store, CHANGE_PRODUCT_RELATION, { name: 'measured_by', source_kind: 'business_outcome', target_kind: 'report', description: 'The report counts the measure.' });
    expect(store.rows('product_relation')).toEqual([expect.objectContaining({ description: 'The report counts the measure.' })]);
    expect((await refusal(store, DECLARE_PRODUCT_KIND, { name: 'report', product_id: 'TL', label: 'Again', description: 'Twice.', parent_kind: 'product', obligation: false })).problems[0]).toMatchObject({ rule: 'primary-key', message: 'product kind report is declared already' });
    await runCommand(store, REMOVE_PRODUCT_RELATION, { name: 'measured_by', source_kind: 'business_outcome', target_kind: 'report' });
    const removed = await runCommand(store, REMOVE_PRODUCT_KIND, { name: 'report' });
    expect(removed.tables).toEqual(['product_kind', 'product_kind_field']);
    expect(store.schema.tables.report).toBeUndefined();
  });

  it('refuses a kind named for a table Lathe has, and removing a kind that still has records', async () => {
    const store = await storeAt(writeData(everyKind()));
    const taken = await refusal(store, DECLARE_PRODUCT_KIND, { name: 'flow', product_id: 'TL', label: 'Flow', description: 'Mine.', parent_kind: 'domain', obligation: false });
    expect(taken.problems[0].message).toContain('The product kind flow has the name of a table Lathe already has');
    const before = fileOf(store, 'product_kind');
    const inUse = await refusal(store, REMOVE_PRODUCT_KIND, { name: 'cli_command' });
    // The relation naming it is refused first, when the schema is built again; so are its records, with no kind left.
    expect(inUse.problems[0]).toMatchObject({ rule: 'product-kind', message: 'The relation documents links cli_command to view, and one of them is not a kind.' });
    expect(fileOf(store, 'product_kind')).toBe(before);
  });
});

describe('LA-AUT-UC23-R02-T51 an open question sits under its product or one of its domains, owned by a role, about records of its product', () => {
  it('adds a question about records, moves it to a domain and back, and removes it with its links', async () => {
    const store = await storeAt(writeData(everyKind()));
    await runCommand(store, ADD_QUESTION, { id: 'TL-Q01', title: 'Who repairs tools?', product_id: 'TL', owner: 'Librarian', description: 'The desk or a volunteer.', about: ['TL-LEND-UC01'] });
    expect(store.rows('about').filter((a) => a.source_id === 'TL-Q01')).toEqual([{ source_id: 'TL-Q01', target_id: 'TL-LEND-UC01' }]);
    expect(runQuery(store, NEXT_PRODUCT_ID, { kind: 'question', parent: 'TL-LEND' })).toBe('TL-LEND-Q02');
    const moved = await runCommand(store, MOVE_QUESTION, { id: 'TL-LEND-Q01', product_id: 'TL' });
    expect(moved.changes).toEqual([expect.objectContaining({ table: 'question', after: expect.objectContaining({ product_id: 'TL' }) })]);
    expect((await refusal(store, MOVE_QUESTION, { id: 'TL-LEND-Q01', product_id: 'TL' })).problems[0].rule).toBe('parent');
    expect((await refusal(store, MOVE_QUESTION, { id: 'TL-LEND-Q01', product_id: 'TL', domain_id: 'TL-LEND' })).problems[0].rule).toBe('parent');
    await runCommand(store, CHANGE_QUESTION, { id: 'TL-Q01', about: [] });
    expect(store.rows('about').filter((a) => a.source_id === 'TL-Q01')).toEqual([]);
    const removed = await runCommand(store, REMOVE_QUESTION, { id: 'TL-LEND-Q01' });
    expect(removed.tables).toEqual(['about', 'question']);
    expect(runQuery(store, GET_PRODUCT, { id: 'TL' })).toMatchObject({ questions: [{ id: 'TL-Q01' }] });
  });
});

describe('LA-AUT-INV50-T an open question is owned by one of its product\'s roles', () => {
  it('refuses a question whose owner is not a role of its product, with its reason, and changes no file', async () => {
    const store = await ownStore();
    const before = fileOf(store, 'question');
    const refused = await refusal(store, CHANGE_QUESTION, { id: 'TL-Q01', owner: 'Mayor' });
    expect(refused.problems).toEqual([expect.objectContaining({ rule: 'question-owner-role', message: 'TL-Q01 is owned by Mayor, which is not a role of TL; its roles are Librarian, Member' })]);
    expect(fileOf(store, 'question')).toBe(before);
    // Dropping the role the question names is refused the same way.
    const dropped = await refusal(store, CHANGE_PRODUCT, { id: 'TL', roles: [{ name: 'Member', description: 'Someone who borrows tools.' }] });
    expect(dropped.problems.map((p) => p.rule)).toEqual(['question-owner-role']);
  });
});

describe('LA-AUT-UC23-R01-T52 a record of a product goes with what it holds, refused while referenced', () => {
  it('refuses removing an interface a flow goes through, naming the flow, and removes one nothing uses', async () => {
    const data: Data = everyKind();
    const store = await storeAt(writeData(data));
    const refused = await refusal(store, REMOVE_INTERFACE, { id: 'TL-IF01' });
    expect(refused.problems[0]).toMatchObject({ rule: 'referenced' });
    expect(refused.problems[0].message).toMatch(/^Interface TL-IF01 is referenced, so it stays: flow TL-LEND-UC01-FL01 \(interface_id\)/);
    await runCommand(store, ADD_INTERFACE, { id: 'TL-IF02', title: 'CLI', product_id: 'TL', kind: 'CLI', description: 'The librarian\'s scripts.' });
    expect((await runCommand(store, REMOVE_INTERFACE, { id: 'TL-IF02' })).tables).toEqual(['interface']);
  });

  it('refuses removing a question or a product kind that is not there', async () => {
    const store = await ownStore();
    expect((await refusal(store, REMOVE_QUESTION, { id: 'TL-Q09' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no open question TL-Q09' });
    expect((await refusal(store, REMOVE_PRODUCT_KIND, { name: 'memo' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no product kind memo' });
  });
});

describe('LA-AUT-UC23-R01-T53 each Product command and query is reached by name from the CLI, the MCP tools and HTTP', () => {
  it('runs `lathe product <command>` with flags or JSON, prints the refusal with its reasons, and helps from the schema', async () => {
    const root = writeData(everyKind());
    const out: string[] = [];
    const err: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => err.push(t), stdin: async () => JSON.stringify({ id: 'TL-IF02', title: 'CLI', product_id: 'TL', kind: 'CLI', description: 'Scripts.' }) };
    expect(await runAggregateCommand(['product', 'add-interface', '--json', '-', '--root', root], io)).toBe(0);
    expect(JSON.parse(out.pop()!)).toMatchObject({ tables: ['interface'] });
    expect(await runAggregateCommand(['product', 'change-product', '--id', 'TL', '--roles', '{"name":"Member","description":"Borrows."}', '--roles', '{"name":"Librarian","description":"Lends."}', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Changed role product_id TL, name Member');
    expect(await runAggregateCommand(['product', 'remove-interface', '--id', 'TL-IF01', '--root', root], io)).toBe(1);
    expect(err.pop()).toMatch(/^Refused; nothing changed:\n {2}Interface TL-IF01 is referenced, so it stays: .* \[referenced\]$/);
    expect(await runAggregateCommand(['product', 'declare-product-kind', '--help', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('--fields');
    expect(await runAggregateCommand(['product', 'next-id', '--kind', 'interface', '--parent', 'TL', '--root', root], io)).toBe(0);
    expect(out.pop()).toBe('TL-IF03');
  });

  it('serves one MCP tool per command and query, each with its own input schema', async () => {
    const root = writeData(everyKind());
    const listed = tools(await readSchema(root));
    const tool = listed.find((t) => t.name === 'product_declare_product_kind')!;
    expect(tool.inputSchema).toMatchObject({ required: ['name', 'product_id', 'label', 'description', 'parent_kind', 'obligation'], additionalProperties: false });
    expect(listed.map((t) => t.name)).toEqual(expect.arrayContaining(['product_move_question', 'product_get_product', 'product_next_id', 'product_list_interfaces']));
    const added = await callTool(root, 'product_add_question', { id: 'TL-Q01', title: 'Who repairs tools?', product_id: 'TL', owner: 'Librarian', description: 'The desk or a volunteer.' });
    expect(added.isError).toBeUndefined();
    const read = await callTool(root, 'product_get_product', { id: 'TL-Q01' });
    expect(read.content[0].text).toContain('Open question TL-Q01: Who repairs tools? (owner Librarian, under TL)');
  });

  it('answers POST /api/product/<command> with the changed rows, 422 with the refusal, and 400 for an input of another shape', async () => {
    const root = writeData(everyKind());
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      const added = await post('/api/product/add-interface', { id: 'TL-IF02', title: 'CLI', product_id: 'TL', kind: 'CLI', description: 'Scripts.' });
      expect(added.status).toBe(200);
      expect(await added.json()).toMatchObject({ ok: true, tables: ['interface'], changes: [{ table: 'interface', key: 'TL-IF02', before: null }] });
      const refused = await post('/api/product/remove-interface', { id: 'TL-IF01' });
      expect(refused.status).toBe(422);
      expect(await refused.json()).toMatchObject({ ok: false, problems: [{ rule: 'referenced' }] });
      expect((await post('/api/product/add-interface', { id: 'TL-IF03' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
