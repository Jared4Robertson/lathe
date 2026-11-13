// The Interface aggregate's commands and refusals (LA-PRD-A24), run on a store as the CLI, the MCP tools and the HTTP
// API run them: each command changes one interface through InterfaceRepository and is refused with its reason,
// changing nothing. The data starts from one record per kind (LA-TST-TD01), whose interface TL-IF01 a flow step names.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_USE_CASE } from '../../../src/use-cases/use-case/commands/add-use-case.ts';
import { ADD_INTERFACE } from '../../../src/product/interface/commands/add-interface.ts';
import { CHANGE_INTERFACE } from '../../../src/product/interface/commands/change-interface.ts';
import { REMOVE_INTERFACE } from '../../../src/product/interface/commands/remove-interface.ts';
import { CHANGE_PRODUCT } from '../../../src/product/product/commands/change-product.ts';
import { GET_PRODUCT, LIST_INTERFACES, NEXT_PRODUCT_ID } from '../../../src/product/product/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool, tools } from '../../../src/cli/mcp.ts';
import { readSchema } from '../../../src/cli/operations.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { everyKind } from '../../store/fixture.ts';
import { writeData } from '../../helpers.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

async function everyKindStore(): Promise<Store> {
  const store = await openStore(writeData(everyKind()), { latheDataDir: null });
  open.push(store);
  return store;
}

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

const CLI = { id: 'TL-IF02', title: 'CLI', product_id: 'TL', kind: 'CLI', description: 'The librarian\'s scripts.', public: false };

describe('LA-PRD-UC23-R01-T54 each Interface command changes one interface through InterfaceRepository', () => {
  it('adds and changes an interface, writing only its own tables, and the product reads it', async () => {
    const store = await everyKindStore();
    expect((await runCommand(store, ADD_INTERFACE, { ...CLI, actors: ['Librarian'], offers: ['TL-LEND-UC01'] })).tables).toEqual(['interface', 'interface_actor', 'offers']);
    expect((await runCommand(store, CHANGE_INTERFACE, { id: 'TL-IF02', kind: 'agent tools' })).tables).toEqual(['interface']);
    expect(runQuery(store, GET_PRODUCT, { id: 'TL-IF02' })).toMatchObject({ product: { id: 'TL' } });
    expect(runQuery(store, LIST_INTERFACES, { product_id: 'TL' })).toEqual([expect.objectContaining({ id: 'TL-IF01' }), { id: 'TL-IF02', title: 'CLI', kind: 'agent tools' }]);
    expect(runQuery(store, NEXT_PRODUCT_ID, { kind: 'interface', parent: 'TL' })).toBe('TL-IF03');
  });

  it('reads an interface with the roles that use it, the patterns it follows and the use cases it offers and does not, by group', async () => {
    const store = await everyKindStore();
    await runCommand(store, ADD_USE_CASE, { id: 'TL-LEND-UC02', title: 'Return a tool', domain_id: 'TL-LEND', goal: 'Bring a borrowed tool back.', result_id: 'TL-LEND-QRY01', actors: ['Member'] });
    await runCommand(store, CHANGE_INTERFACE, { id: 'TL-IF01', actors: ['Member', 'Librarian'] });
    const page = runQuery(store, GET_PRODUCT, { id: 'TL' }) as ReturnType<typeof GET_PRODUCT.run>;
    expect(page.interfaces).toEqual([
      expect.objectContaining({
        id: 'TL-IF01',
        actors: ['Member', 'Librarian'],
        patterns: [],
        offers: [{ group: expect.objectContaining({ id: 'TL-LEND-A1' }), items: [{ id: 'TL-LEND-UC01', title: 'Borrow a tool' }] }],
        missing: [{ group: expect.objectContaining({ id: 'TL-LEND-RM01' }), items: [{ id: 'TL-LEND-UC02', title: 'Return a tool' }] }],
      }),
    ]);
    await runCommand(store, CHANGE_INTERFACE, { id: 'TL-IF01', offers: ['TL-LEND-UC02', 'TL-LEND-UC01'] });
    const offering = (runQuery(store, GET_PRODUCT, { id: 'TL' }) as ReturnType<typeof GET_PRODUCT.run>).interfaces[0];
    expect(offering.offers.map((o) => [o.group.id, o.items.map((u) => u.id)])).toEqual([['TL-LEND-A1', ['TL-LEND-UC01']], ['TL-LEND-RM01', ['TL-LEND-UC02']]]);
    expect(offering.missing).toEqual([]);
  });

  it('refuses an input that is not the command\'s, an ID in use, a product that is not there and an interface that is not', async () => {
    const store = await everyKindStore();
    await expect(runCommand(store, ADD_INTERFACE, { id: 'TL-IF02', title: 'CLI', product_id: 'TL', kind: 'CLI' })).rejects.toThrow(new InputError('add-interface needs description'));
    await expect(runCommand(store, CHANGE_INTERFACE, { id: 'TL-IF01', product_id: 'TL' })).rejects.toThrow(/change-interface takes no product_id/);
    await expect(runCommand(store, CHANGE_INTERFACE, { id: 'TL-IF01', kind: 'phone' })).rejects.toThrow(/kind "phone" is not one of/);
    expect((await refusal(store, ADD_INTERFACE, { ...CLI, id: 'TL-IF01' })).problems[0].rule).toBe('primary-key');
    expect((await refusal(store, ADD_INTERFACE, { ...CLI, product_id: 'XX' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no product XX' });
    expect((await refusal(store, CHANGE_INTERFACE, { id: 'TL-IF09', title: 'Nothing' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no interface TL-IF09' });
  });
});

describe('LA-PRD-UC23-R01-T55 an interface goes with the roles it lists and the use cases it offers, refused while referenced', () => {
  it('refuses removing an interface a flow step is a variant of, naming the step, and removes one with its roles and offers', async () => {
    const store = await everyKindStore();
    const refused = await refusal(store, REMOVE_INTERFACE, { id: 'TL-IF01' });
    expect(refused.problems[0]).toMatchObject({ rule: 'referenced' });
    expect(refused.problems[0].message).toMatch(/^Interface TL-IF01 is referenced, so it stays: flow_step TL-LEND-UC01-FL-S01 \(interface_id\)/);
    await runCommand(store, ADD_INTERFACE, { ...CLI, actors: ['Librarian'], offers: ['TL-LEND-UC01'] });
    expect(store.rows('offers')).toContainEqual({ source_id: 'TL-IF02', target_id: 'TL-LEND-UC01' });
    expect((await runCommand(store, REMOVE_INTERFACE, { id: 'TL-IF02' })).tables).toEqual(['interface', 'interface_actor', 'offers']);
    expect((await refusal(store, REMOVE_INTERFACE, { id: 'TL-IF02' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no interface TL-IF02' });
  });
});

describe('LA-PRD-INV194-T each role that uses an interface is one of its product\'s roles', () => {
  it('refuses an interface listing a role its product lacks, from Add and Change, and dropping a role an interface lists', async () => {
    const store = await everyKindStore();
    expect((await refusal(store, ADD_INTERFACE, { ...CLI, actors: ['Librarian', 'Mayor'] })).problems).toEqual([
      expect.objectContaining({ rule: 'interface-actor-role', message: 'Interface TL-IF02 names Mayor as a role that uses it, which is not a role of TL; its roles are Librarian, Member: name one of them, or add the role to TL' }),
    ]);
    expect((await refusal(store, CHANGE_INTERFACE, { id: 'TL-IF01', actors: ['Mayor'] })).problems.map((p) => p.rule)).toEqual(['interface-actor-role']);
    expect(store.rows('interface_actor')).toEqual([{ interface_id: 'TL-IF01', position: 1, role_name: 'Member' }]);
    // Dropping the role the interface lists, through the product, is refused the same way.
    expect((await refusal(store, CHANGE_PRODUCT, { id: 'TL', roles: [{ name: 'Librarian', description: 'Lends tools.' }] })).problems.map((p) => p.rule)).toContain('interface-actor-role');
  });
});

describe('LA-PRD-UC23-R01-T56 each Interface command is reached by name from the CLI, the MCP tools and HTTP', () => {
  it('runs `lathe interface <command>` with flags or JSON, and prints the refusal with its reasons', async () => {
    const root = writeData(everyKind());
    const out: string[] = [];
    const err: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => err.push(t), stdin: async () => JSON.stringify(CLI) };
    expect(await runAggregateCommand(['interface', 'add-interface', '--json', '-', '--root', root], io)).toBe(0);
    expect(JSON.parse(out.pop()!)).toMatchObject({ tables: ['interface'] });
    expect(await runAggregateCommand(['interface', 'change-interface', '--id', 'TL-IF02', '--actors', 'Librarian', '--root', root], io)).toBe(0);
    expect(await runAggregateCommand(['interface', 'remove-interface', '--id', 'TL-IF01', '--root', root], io)).toBe(1);
    expect(err.pop()).toMatch(/^Refused; nothing changed:\n {2}Interface TL-IF01 is referenced, so it stays: .* \[referenced\]$/);
  });

  it('serves one MCP tool per command', async () => {
    const root = writeData(everyKind());
    expect(tools(await readSchema(root)).map((t) => t.name)).toEqual(expect.arrayContaining(['interface_add_interface', 'interface_change_interface', 'interface_remove_interface']));
    expect((await callTool(root, 'interface_add_interface', CLI)).isError).toBeUndefined();
    expect((await callTool(root, 'interface_remove_interface', { id: 'TL-IF02' })).isError).toBeUndefined();
  });

  it('answers POST /api/interface/<command> with the changed rows, 422 with the refusal, and 400 for an input of another shape', async () => {
    const root = writeData(everyKind());
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      const added = await post('/api/interface/add-interface', CLI);
      expect(added.status).toBe(200);
      expect(await added.json()).toMatchObject({ ok: true, tables: ['interface'], changes: [{ table: 'interface', key: 'TL-IF02', before: null }] });
      const refused = await post('/api/interface/remove-interface', { id: 'TL-IF01' });
      expect(refused.status).toBe(422);
      expect(await refused.json()).toMatchObject({ ok: false, problems: [{ rule: 'referenced' }] });
      expect((await post('/api/interface/add-interface', { id: 'TL-IF03' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
