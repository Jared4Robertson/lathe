// The Use case aggregate's commands, queries and refusals (LA-AUT-A11), run on a store as the CLI, the MCP tools and
// the HTTP API run them: each command changes one use case through UseCaseRepository, holds it to its rules before it
// saves, and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_FLOW } from '../../src/authoring/use-case/commands/add-flow.ts';
import { ADD_FLOW_STEP } from '../../src/authoring/use-case/commands/add-flow-step.ts';
import { ADD_UC_REQUIREMENT } from '../../src/authoring/use-case/commands/add-uc-requirement.ts';
import { ADD_USE_CASE } from '../../src/authoring/use-case/commands/add-use-case.ts';
import { CHANGE_FLOW_STEP } from '../../src/authoring/use-case/commands/change-flow-step.ts';
import { CHANGE_USE_CASE } from '../../src/authoring/use-case/commands/change-use-case.ts';
import { CHANGE_USE_CASE_TEST } from '../../src/authoring/use-case/commands/change-use-case-test.ts';
import { MOVE_USE_CASE } from '../../src/authoring/use-case/commands/move-use-case.ts';
import { REMOVE_FLOW } from '../../src/authoring/use-case/commands/remove-flow.ts';
import { REMOVE_UC_REQUIREMENT } from '../../src/authoring/use-case/commands/remove-uc-requirement.ts';
import { REMOVE_USE_CASE } from '../../src/authoring/use-case/commands/remove-use-case.ts';
import { REMOVE_USE_CASE_TEST } from '../../src/authoring/use-case/commands/remove-use-case-test.ts';
import { GET_USE_CASE, LIST_USE_CASES, NEXT_USE_CASE_ID } from '../../src/authoring/use-case/queries.ts';
import { UseCaseRepository } from '../../src/authoring/use-case/repository.ts';
import { runAggregateCommand } from '../../src/cli/aggregates.ts';
import { callTool, tools } from '../../src/cli/mcp.ts';
import { readSchema } from '../../src/cli/operations.ts';
import { closeStores, handleApi } from '../../src/server/api.ts';
import { InputError, type AnyCommand } from '../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../src/platform/commands/run.ts';
import { DataFiles } from '../../src/platform/data/data-files.ts';
import { StoreError } from '../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../src/platform/data/store.ts';
import { everyKind, type Data } from '../store/fixture.ts';
import { writeData } from '../helpers.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

/** A store on the data, with a second use case, UC02, that nothing outside it references. */
async function storeOf(data: Data = everyKind()): Promise<Store> {
  const store = await openStore(writeData(data), { latheDataDir: null });
  open.push(store);
  await runCommand(store, ADD_USE_CASE, { id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'Bring a borrowed tool back.', actors: ['Member'] });
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

const fileOf = (store: Store, table: string) => readFileSync(path.join(store.dataDir, `${table}.jsonl`), 'utf8');

describe('LA-AUT-UC06-R12-T01 each Use case command (LA-AUT-A11) changes one use case through UseCaseRepository, held to its rules', () => {
  it('adds a use case whole with its actors, and writes only its own tables', async () => {
    const store = await storeOf();
    const committed = await runCommand(store, CHANGE_USE_CASE, { id: 'TL-LEND-UC02', notes: 'Late returns are fined.', actors: ['Member', 'Librarian'] });
    expect(committed.tables).toEqual(['use_case', 'use_case_actor']);
    expect(store.rows('use_case_actor').filter((a) => a.use_case_id === 'TL-LEND-UC02')).toEqual([
      { use_case_id: 'TL-LEND-UC02', position: 1, role_name: 'Member' },
      { use_case_id: 'TL-LEND-UC02', position: 2, role_name: 'Librarian' },
    ]);
    // null clears an optional column; a field left out keeps its value.
    await runCommand(store, CHANGE_USE_CASE, { id: 'TL-LEND-UC02', notes: null });
    expect(store.record('TL-LEND-UC02')?.row).toEqual({ id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'Bring a borrowed tool back.' });
  });

  it('adds a requirement, a flow and a step with its links, and reads the use case whole by any record in it', async () => {
    const store = await storeOf();
    await runCommand(store, ADD_UC_REQUIREMENT, { id: 'TL-LEND-UC02-R01', title: 'Tool is on loan', use_case_id: 'TL-LEND-UC02', statement: 'The library MUST refuse a tool not on loan.' });
    await runCommand(store, ADD_FLOW, { id: 'TL-LEND-UC02-FL01', title: 'Return a tool at the desk', use_case_id: 'TL-LEND-UC02', interface_id: 'TL-IF01' });
    const step = { id: 'TL-LEND-UC02-FL01-S01', title: 'Scan the tool', flow_id: 'TL-LEND-UC02-FL01', path: 'main', position: 1, fulfills: ['TL-LEND-UC02-R01'], happens_in: 'TL-V01' };
    const committed = await runCommand(store, ADD_FLOW_STEP, step);
    expect(committed.tables).toEqual(['flow_step', 'fulfills', 'happens_in']);
    const whole = runQuery(store, GET_USE_CASE, { id: 'TL-LEND-UC02-FL01-S01' }) as ReturnType<typeof GET_USE_CASE.run>;
    expect(whole.root).toBe('TL-LEND-UC02');
    expect(whole.steps).toEqual([{ row: { id: step.id, title: step.title, flow_id: step.flow_id, path: 'main', position: 1 }, fulfills: ['TL-LEND-UC02-R01'], invokes: null, happensIn: 'TL-V01', exchangesWith: [] }]);
    expect(runQuery(store, LIST_USE_CASES, { capability_id: 'TL-LEND-CAP01' })).toEqual([
      { id: 'TL-LEND-UC01', title: 'Borrow a tool' },
      { id: 'TL-LEND-UC02', title: 'Return a tool' },
    ]);
    expect(runQuery(store, NEXT_USE_CASE_ID, { kind: 'flow_step', parent: 'TL-LEND-UC02-FL01' })).toBe('TL-LEND-UC02-FL01-S02');
    expect(runQuery(store, NEXT_USE_CASE_ID, { kind: 'use_case', parent: 'TL-LEND-CAP01' })).toBe('TL-LEND-UC03');
    expect(runQuery(store, NEXT_USE_CASE_ID, { kind: 'flow_test', parent: 'TL-LEND-UC02-FL01' })).toBe('TL-LEND-UC02-FL01-T');
    expect(() => runQuery(store, NEXT_USE_CASE_ID, { kind: 'flow', parent: 'TL-LEND-UC02' })).toThrow(/a flow through every interface of TL/);
  });

  it('changes a step\'s links: a list replaces the list, null clears a single link', async () => {
    const store = await storeOf();
    await runCommand(store, CHANGE_FLOW_STEP, { id: 'TL-LEND-UC01-FL01-S01', happens_in: null, exchanges_with: [], position: 1 });
    const step = (runQuery(store, GET_USE_CASE, { id: 'TL-LEND-UC01' }) as ReturnType<typeof GET_USE_CASE.run>).steps[0];
    expect(step).toMatchObject({ happensIn: null, exchangesWith: [], invokes: 'TL-LEND-CMD01', fulfills: ['TL-LEND-UC01-R01'] });
  });

  it('refuses a step fulfilling another use case\'s requirement, with its reason, and changes no file', async () => {
    const store = await storeOf();
    const before = fileOf(store, 'fulfills');
    await runCommand(store, ADD_UC_REQUIREMENT, { id: 'TL-LEND-UC02-R01', title: 'Tool is on loan', use_case_id: 'TL-LEND-UC02', statement: 'The library MUST refuse a tool not on loan.' });
    const refused = await refusal(store, CHANGE_FLOW_STEP, { id: 'TL-LEND-UC01-FL01-S01', fulfills: ['TL-LEND-UC01-R01', 'TL-LEND-UC02-R01'] });
    expect(refused.problems).toEqual([
      expect.objectContaining({ rule: 'step-fulfills-own-use-case', message: 'TL-LEND-UC01-FL01-S01 is a step of the flow of TL-LEND-UC01, so it cannot fulfill TL-LEND-UC02-R01, a requirement of TL-LEND-UC02' }),
    ]);
    expect(fileOf(store, 'fulfills')).toBe(before);
  });

  it('LA-AUT-INV42-T refuses a flow whose ID does not end in its interface\'s number', async () => {
    const store = await storeOf();
    const refused = await refusal(store, ADD_FLOW, { id: 'TL-LEND-UC02-FL02', title: 'Return a tool at the desk', use_case_id: 'TL-LEND-UC02', interface_id: 'TL-IF01' });
    expect(refused.problems).toEqual([expect.objectContaining({ rule: 'flow-id-interface', message: 'TL-LEND-UC02-FL02 goes through TL-IF01, so its ID is TL-LEND-UC02-FL01' })]);
  });

  it('LA-AUT-INV43-T refuses a view for a step of a flow through a CLI', async () => {
    const data = everyKind();
    data.interface = data.interface.map((i) => ({ ...i, kind: 'CLI' }));
    data.happens_in = [];
    const store = await storeOf(data);
    const refused = await refusal(store, CHANGE_FLOW_STEP, { id: 'TL-LEND-UC01-FL01-S01', happens_in: 'TL-V01' });
    expect(refused.problems.map((p) => p.rule)).toEqual(['step-fits-interface']);
  });

  it('moves a use case under another capability, with what is in it', async () => {
    const data = everyKind();
    data.capability = [...data.capability, { id: 'TL-LEND-CAP02', title: 'Returns', domain_id: 'TL-LEND', position: 2, description: 'Taking tools back.' }];
    const store = await storeOf(data);
    const committed = await runCommand(store, MOVE_USE_CASE, { id: 'TL-LEND-UC02', capability_id: 'TL-LEND-CAP02' });
    expect(committed.changes).toEqual([expect.objectContaining({ table: 'use_case', key: 'TL-LEND-UC02', after: expect.objectContaining({ capability_id: 'TL-LEND-CAP02' }) })]);
    expect((await refusal(store, MOVE_USE_CASE, { id: 'TL-LEND-UC02', capability_id: 'TL-LEND-CAP02' })).problems[0].rule).toBe('parent');
  });

  it('refuses an input that is not the command\'s: an unknown field, a missing one, a wrong type, or a field that cannot be cleared', async () => {
    const store = await storeOf();
    await expect(runCommand(store, ADD_UC_REQUIREMENT, { id: 'TL-LEND-UC02-R01', title: 'x', use_case_id: 'TL-LEND-UC02' })).rejects.toThrow(new InputError('add-uc-requirement needs statement'));
    await expect(runCommand(store, CHANGE_USE_CASE, { id: 'TL-LEND-UC02', capability_id: 'TL-LEND-CAP01' })).rejects.toThrow(/change-use-case takes no capability_id/);
    await expect(runCommand(store, CHANGE_USE_CASE_TEST, { id: 'TL-LEND-UC01-R01-T01', level: 'sometimes' })).rejects.toThrow(/level "sometimes" is not one of/);
    await expect(runCommand(store, CHANGE_USE_CASE, { id: 'TL-LEND-UC02', goal: null })).rejects.toThrow(/goal cannot be cleared/);
    expect((await refusal(store, CHANGE_USE_CASE, { id: 'TL-LEND-UC09', title: 'Nothing' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no use case TL-LEND-UC09' });
    expect((await refusal(store, ADD_USE_CASE, { id: 'TL-LEND-UC02', title: 'Again', capability_id: 'TL-LEND-CAP01', goal: 'Twice.' })).problems[0].rule).toBe('primary-key');
  });

  it('refuses a repository\'s write to a table it does not own, when it is made', async () => {
    const store = await storeOf();
    const refused = await store
      .transact((tx) => {
        new UseCaseRepository(tx).load('TL-LEND-UC01');
        new DataFiles(tx, 'UseCaseRepository', ['use_case']).put('domain', { id: 'TL-X', title: 'X', product_id: 'TL', subdomain_type: 'core', description: 'X.' });
      })
      .catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(StoreError);
    expect((refused as StoreError).problems[0]).toMatchObject({ rule: 'repository-scope', message: 'UseCaseRepository loads and saves only its own tables (use_case); domain is not one of them' });
  });
});

describe('LA-AUT-UC06-R13-T01 LA-STD-CODE-R07-T01 a use case, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
  it('removes a use case whole, and refuses one while another aggregate references what is in it', async () => {
    const store = await storeOf();
    await runCommand(store, ADD_UC_REQUIREMENT, { id: 'TL-LEND-UC02-R01', title: 'Tool is on loan', use_case_id: 'TL-LEND-UC02', statement: 'The library MUST refuse a tool not on loan.' });
    await runCommand(store, ADD_FLOW, { id: 'TL-LEND-UC02-FL01', title: 'Return a tool at the desk', use_case_id: 'TL-LEND-UC02', interface_id: 'TL-IF01' });
    await runCommand(store, ADD_FLOW_STEP, { id: 'TL-LEND-UC02-FL01-S01', title: 'Scan the tool', flow_id: 'TL-LEND-UC02-FL01', path: 'main', position: 1, fulfills: ['TL-LEND-UC02-R01'] });
    const removed = await runCommand(store, REMOVE_USE_CASE, { id: 'TL-LEND-UC02' });
    expect(removed.changes.filter((c) => c.after === null).map((c) => `${c.table} ${c.key}`).sort()).toEqual([
      'flow TL-LEND-UC02-FL01',
      'flow_step TL-LEND-UC02-FL01-S01',
      'fulfills source_id TL-LEND-UC02-FL01-S01, target_id TL-LEND-UC02-R01',
      'uc_requirement TL-LEND-UC02-R01',
      'use_case TL-LEND-UC02',
      'use_case_actor use_case_id TL-LEND-UC02, position 1',
    ]);
    // UC01 is followed (TRC-A3's link) and asked about (A1's question): it stays, and the refusal names both.
    const refused = await refusal(store, REMOVE_USE_CASE, { id: 'TL-LEND-UC01' });
    expect(refused.problems).toEqual([expect.objectContaining({ rule: 'referenced' })]);
    expect(refused.problems[0].message).toMatch(/^Use case TL-LEND-UC01 is referenced, so it stays: /);
    expect(refused.problems[0].message).toContain('TL-LEND-UC01 follows TL-PAT-ACT');
    expect(refused.problems[0].message).toContain('TL-LEND-Q01 about TL-LEND-UC01');
  });

  it('refuses removing a requirement a step fulfills, and removes a flow with its steps and test', async () => {
    const store = await storeOf();
    const refused = await refusal(store, REMOVE_UC_REQUIREMENT, { id: 'TL-LEND-UC01-R01' });
    expect(refused.problems[0]).toMatchObject({ rule: 'referenced', message: 'UC requirement TL-LEND-UC01-R01 is referenced, so it stays: TL-LEND-UC01-FL01-S01 fulfills TL-LEND-UC01-R01' });
    const removed = await runCommand(store, REMOVE_FLOW, { id: 'TL-LEND-UC01-FL01' });
    expect(removed.changes.filter((c) => c.after === null).map((c) => c.table).sort()).toEqual(['exchanges_with', 'flow', 'flow_step', 'flow_test', 'fulfills', 'happens_in', 'invokes']);
  });

  it('refuses removing a use case test a business outcome is measured by', async () => {
    const data = everyKind();
    data.measured_by = [...data.measured_by, { source_id: 'TL-BO01', target_id: 'TL-LEND-UC01-R01-T01' }];
    const store = await storeOf(data);
    const refused = await refusal(store, REMOVE_USE_CASE_TEST, { id: 'TL-LEND-UC01-R01-T01' });
    expect(refused.problems[0].message).toBe('Use case test TL-LEND-UC01-R01-T01 is referenced, so it stays: TL-BO01 measured by TL-LEND-UC01-R01-T01');
  });
});

describe('LA-AUT-UC06-R14-T01 each Use case command and query is reached by name from the CLI, the MCP tools and HTTP', () => {
  it('runs `lathe use-case <command>` with flags or JSON, prints the refusal with its reasons, and helps from the schema', async () => {
    const root = writeData(everyKind());
    const out: string[] = [];
    const err: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => err.push(t), stdin: async () => JSON.stringify({ id: 'TL-LEND-UC01-R02', title: 'Member known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' }) };
    expect(await runAggregateCommand(['use-case', 'add-uc-requirement', '--json', '-', '--root', root], io)).toBe(0);
    expect(JSON.parse(out.pop()!)).toMatchObject({ tables: ['uc_requirement'] });
    expect(await runAggregateCommand(['use-case', 'change-flow-step', '--id', 'TL-LEND-UC01-FL01-S01', '--fulfills', 'TL-LEND-UC01-R01', '--fulfills', 'TL-LEND-UC01-R02', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added fulfills source_id TL-LEND-UC01-FL01-S01, target_id TL-LEND-UC01-R02');
    expect(await runAggregateCommand(['use-case', 'remove-uc-requirement', '--id', 'TL-LEND-UC01-R02', '--root', root], io)).toBe(1);
    expect(err.pop()).toMatch(/^Refused; nothing changed:\n {2}UC requirement TL-LEND-UC01-R02 is referenced, so it stays: .* \[referenced\]$/);
    expect(await runAggregateCommand(['use-case', 'add-flow-step', '--help', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('--position                 integer, required. The step\'s place on its path, from 1.');
    expect(await runAggregateCommand(['use-case', 'next-id', '--kind', 'uc_requirement', '--parent', 'TL-LEND-UC01', '--root', root], io)).toBe(0);
    expect(out.pop()).toBe('TL-LEND-UC01-R03');
    expect(await runAggregateCommand(['use-case', 'add-flow-step', '--colour', 'red', '--root', root], io)).toBe(2);
    expect(err.pop()).toContain('lathe use-case add-flow-step has no field colour');
  });

  it('serves one MCP tool per command and query, each with its own input schema', async () => {
    const root = writeData(everyKind());
    const listed = tools(await readSchema(root));
    const tool = listed.find((t) => t.name === 'use_case_add_flow_step')!;
    expect(tool.inputSchema).toMatchObject({ required: ['id', 'title', 'flow_id', 'path', 'position'], additionalProperties: false });
    expect(listed.map((t) => t.name)).toEqual(expect.arrayContaining(['use_case_move_use_case', 'use_case_get_use_case', 'use_case_next_id']));
    const added = await callTool(root, 'use_case_add_uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'Member known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' });
    expect(added.isError).toBeUndefined();
    const refused = await callTool(root, 'use_case_add_flow', { id: 'TL-LEND-UC01-FL01', title: 'Again', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF01', extra: 1 });
    expect(refused).toMatchObject({ isError: true, structuredContent: { refused: true, problems: [{ rule: 'input' }] } });
    const read = await callTool(root, 'use_case_get_use_case', { id: 'TL-LEND-UC01-R02' });
    expect(read.content[0].text).toContain('UC requirement TL-LEND-UC01-R02: Member known');
  });

  it('answers POST /api/use-case/<command> with the changed rows, 422 with the refusal, and 400 for an input of another shape', async () => {
    const root = writeData(everyKind());
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      const added = await post('/api/use-case/add-uc-requirement', { id: 'TL-LEND-UC01-R02', title: 'Member known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' });
      expect(added.status).toBe(200);
      expect(await added.json()).toMatchObject({ ok: true, tables: ['uc_requirement'], changes: [{ table: 'uc_requirement', key: 'TL-LEND-UC01-R02', before: null }] });
      const refused = await post('/api/use-case/remove-uc-requirement', { id: 'TL-LEND-UC01-R01' });
      expect(refused.status).toBe(422);
      expect(await refused.json()).toMatchObject({ ok: false, problems: [{ rule: 'referenced' }] });
      expect((await post('/api/use-case/add-flow', { id: 'TL-LEND-UC01-FL02' })).status).toBe(400);
      expect((await fetch(`${base}/api/use-case/add-flow`)).status).toBe(405);
    } finally {
      await closeStores(root);
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
