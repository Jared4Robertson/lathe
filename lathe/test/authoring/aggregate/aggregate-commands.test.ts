// The Aggregate aggregate's commands, queries and refusals (LA-AUT-A6), run on a store as the CLI, the MCP tools and
// the HTTP API run them: each command changes one aggregate through AggregateRepository, holds it to its rules before
// it saves, and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_ENTITY } from '../../../src/authoring/aggregate/commands/add-entity.ts';
import { ADD_INVARIANT } from '../../../src/authoring/aggregate/commands/add-invariant.ts';
import { CHANGE_AGGREGATE } from '../../../src/authoring/aggregate/commands/change-aggregate.ts';
import { CHANGE_DATA_MODEL } from '../../../src/authoring/aggregate/commands/change-data-model.ts';
import { CHANGE_ENTITY } from '../../../src/authoring/aggregate/commands/change-entity.ts';
import { CHANGE_INVARIANT } from '../../../src/authoring/aggregate/commands/change-invariant.ts';
import { CHANGE_INVARIANT_TEST } from '../../../src/authoring/aggregate/commands/change-invariant-test.ts';
import { GET_AGGREGATE, LIST_AGGREGATES, NEXT_AGGREGATE_ID } from '../../../src/authoring/aggregate/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';
import { closeOpenStores, domainModelBase } from '../domain-model-base.ts';
import { commandCommandCases } from '../command/command-commands.cases.ts';
import { dataStoreCommandCases } from '../data-store/data-store-commands.cases.ts';
import { domainEventCommandCases } from '../domain-event/domain-event-commands.cases.ts';
import { endpointCommandCases } from '../endpoint/endpoint-commands.cases.ts';
import { integrationCommandCases } from '../integration/integration-commands.cases.ts';
import { readModelCommandCases } from '../read-model/read-model-commands.cases.ts';
import { specificationCommandCases } from '../specification/specification-commands.cases.ts';
import { storageRequirementCommandCases } from '../storage-requirement/storage-requirement-commands.cases.ts';
import { tableCommandCases } from '../table/table-commands.cases.ts';
import { uiComponentCommandCases } from '../ui-component/ui-component-commands.cases.ts';
import { valueObjectCommandCases } from '../value-object/value-object-commands.cases.ts';
import { viewCommandCases } from '../view/view-commands.cases.ts';
import { aggregateDataSet } from './data-set.ts';

afterEach(closeOpenStores);

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
type Whole = ReturnType<typeof GET_AGGREGATE.run>;

describe('LA-PAT-AGGREGATE-COMMANDS-R10-T01 each Aggregate command (LA-AUT-A6) changes one aggregate through AggregateRepository, held to its rules, and is reached by name from the CLI, the MCP tools and HTTP', () => {
  commandCommandCases();
  dataStoreCommandCases();
  domainEventCommandCases();
  endpointCommandCases();
  integrationCommandCases();
  readModelCommandCases();
  specificationCommandCases();
  storageRequirementCommandCases();
  tableCommandCases();
  uiComponentCommandCases();
  valueObjectCommandCases();
  viewCommandCases();

  it('LA-PAT-AGGREGATE-TESTS-R03-T01 builds the data set with its own Add commands, and reads an aggregate whole by any record in it', async () => {
    const store = await aggregateDataSet();
    const whole = runQuery(store, GET_AGGREGATE, { id: 'TL-LEND-INV01-T' }) as Whole;
    expect(whole.record).toEqual({ id: 'TL-LEND-INV01-T', kind: 'invariant_test' });
    expect(whole.aggregate.id).toBe('TL-LEND-A1');
    expect(whole.entities.map((e) => [e.entity.id, e.fields.length, e.hasOne])).toEqual([
      ['TL-LEND-EN01', 3, ['TL-LEND-EN02']],
      ['TL-LEND-EN02', 1, []],
    ]);
    expect(whole.entities[0].fields[1]).toEqual({ entity_id: 'TL-LEND-EN01', position: 2, name: 'Tool', meaning: 'The tool lent.', type_aggregate_id: 'TL-LEND-A2', required: true, column_name: 'tool_id' });
    expect(whole.entities[0].dataModel).toEqual({ dataModel: { id: 'TL-LEND-EN01-DM', title: 'Loan', entity_id: 'TL-LEND-EN01', file: 'src/lending/loan.ts' }, meets: ['TL-STD-CODE-R01'], packages: [] });
    expect(whole.invariants[0].test?.startsFrom).toEqual(['TL-LEND-TD01']);
    expect(runQuery(store, LIST_AGGREGATES, { domain_id: 'TL-LEND' })).toEqual([
      { id: 'TL-LEND-A1', title: 'Loan' },
      { id: 'TL-LEND-A2', title: 'Tool' },
    ]);
    expect(runQuery(store, NEXT_AGGREGATE_ID, { kind: 'aggregate', parent: 'TL-LEND' })).toBe('TL-LEND-A3');
    expect(runQuery(store, NEXT_AGGREGATE_ID, { kind: 'entity', parent: 'TL-LEND-A2' })).toBe('TL-LEND-EN04');
    expect(runQuery(store, NEXT_AGGREGATE_ID, { kind: 'invariant', parent: 'TL-LEND-A2' })).toBe('TL-LEND-INV02');
    expect(runQuery(store, NEXT_AGGREGATE_ID, { kind: 'data_model', parent: 'TL-LEND-EN03' })).toBe('TL-LEND-EN03-DM');
    expect(() => runQuery(store, NEXT_AGGREGATE_ID, { kind: 'invariant_test', parent: 'TL-LEND-INV01' })).toThrow(/already has its invariant test, TL-LEND-INV01-T/);
  });

  it('changes each kind, writing only its own tables: a list given replaces its list, null clears an optional column', async () => {
    const store = await aggregateDataSet();
    expect((await runCommand(store, CHANGE_AGGREGATE, { id: 'TL-LEND-A2', notes: 'Tools are lent one at a time.' })).tables).toEqual(['aggregate']);
    await runCommand(store, CHANGE_AGGREGATE, { id: 'TL-LEND-A2', notes: null });
    expect(store.record('TL-LEND-A2')?.row).toEqual({ id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', description: 'A tool the library holds.', identity: 'Tool ID' });
    const fields = await runCommand(store, CHANGE_ENTITY, { id: 'TL-LEND-EN03', fields: [{ name: 'Tool ID', meaning: 'Which tool.', type: 'text', required: true }, { name: 'Name', meaning: 'What it is called.', type: 'text', required: true }] });
    expect(fields.tables).toEqual(['entity_field']);
    expect((await runCommand(store, CHANGE_ENTITY, { id: 'TL-LEND-EN01', has_one: [], has_many: ['TL-LEND-EN02'] })).tables).toEqual(['has_many', 'has_one']);
    expect((await runCommand(store, CHANGE_INVARIANT, { id: 'TL-LEND-INV01', title: 'One open loan per tool' })).tables).toEqual(['invariant']);
    expect((await runCommand(store, CHANGE_DATA_MODEL, { id: 'TL-LEND-EN01-DM', file: null, meets: [], packages: ['zod'] })).tables).toEqual(['data_model', 'meets', 'package_use']);
    expect((await runCommand(store, CHANGE_INVARIANT_TEST, { id: 'TL-LEND-INV01-T', starts_from: [] })).tables).toEqual(['starts_from']);
  });

  it('refuses an input that is not the command\'s: an unknown field, a missing one, a parent column, or a field item of another shape', async () => {
    const store = await aggregateDataSet();
    await expect(runCommand(store, ADD_INVARIANT, { id: 'TL-LEND-INV02', title: 'x', aggregate_id: 'TL-LEND-A2' })).rejects.toThrow(new InputError('add-invariant needs statement'));
    await expect(runCommand(store, CHANGE_ENTITY, { id: 'TL-LEND-EN03', aggregate_id: 'TL-LEND-A1' })).rejects.toThrow(/change-entity takes no aggregate_id/);
    await expect(runCommand(store, CHANGE_ENTITY, { id: 'TL-LEND-EN03', fields: [{ name: 'Tool ID', type: 'text', required: true }] })).rejects.toThrow(/has an item with no meaning/);
    await expect(runCommand(store, CHANGE_ENTITY, { id: 'TL-LEND-EN03', fields: [{ name: 'Tool ID', meaning: 'x', type: 'text', required: true, position: 2 }] })).rejects.toThrow(/has an item with position; an item takes/);
    expect((await refusal(store, ADD_ENTITY, { id: 'TL-LEND-EN09', title: 'x', aggregate_id: 'TL-LEND-A9', role: 'child', description: 'x' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no aggregate TL-LEND-A9' });
  });

  it('runs `lathe aggregate <command>`, the aggregate_ tools and POST /api/aggregate/<command>', async () => {
    const root = writeData(domainModelBase());
    const out: string[] = [];
    const err: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => err.push(t) };
    expect(await runAggregateCommand(['aggregate', 'add-aggregate', '--id', 'TL-LEND-A1', '--title', 'Loan', '--domain_id', 'TL-LEND', '--identity', 'Loan ID', '--description', 'A loan.', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added aggregate TL-LEND-A1');
    expect(await runAggregateCommand(['aggregate', 'add-entity', '--id', 'TL-LEND-EN01', '--title', 'Loan', '--aggregate_id', 'TL-LEND-A1', '--role', 'root', '--description', 'The loan.', '--fields', '{"name":"Loan ID","meaning":"Which loan.","type":"text","required":true}', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added entity_field entity_id TL-LEND-EN01, position 1');
    expect(await runAggregateCommand(['aggregate', 'add-entity', '--help', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('--fields');
    const added = await callTool(root, 'aggregate_add_invariant', { id: 'TL-LEND-INV01', title: 'One loan', aggregate_id: 'TL-LEND-A1', statement: 'A tool MUST NOT have two loans.' });
    expect(added.isError).toBeUndefined();
    const read = await callTool(root, 'aggregate_get_aggregate', { id: 'TL-LEND-INV01' });
    expect(read.content[0].text).toContain('Invariant TL-LEND-INV01: One loan');
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/aggregate/change-invariant', { id: 'TL-LEND-INV01', title: 'One active loan' })).status).toBe(200);
      const refused = await post('/api/aggregate/add-entity', { id: 'TL-LEND-EN02', title: 'Second root', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'Another root.' });
      expect(refused.status).toBe(422);
      expect(await refused.json()).toMatchObject({ ok: false, problems: [{ rule: 'aggregate-root' }] });
      expect((await post('/api/aggregate/add-entity', { id: 'TL-LEND-EN02' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('LA-AUT-INV12-T an aggregate with two roots is refused, one with none is not', () => {
  it('refuses a second root from Add an entity and Change an entity, with its reason, and changes no file', async () => {
    const store = await aggregateDataSet();
    const before = fileOf(store, 'entity');
    const added = await refusal(store, ADD_ENTITY, { id: 'TL-LEND-EN04', title: 'Second', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'Another root.' });
    expect(added.problems).toEqual([expect.objectContaining({ rule: 'aggregate-root', message: 'aggregate TL-LEND-A1 has 2 root entities; an aggregate has one root' })]);
    expect((await refusal(store, CHANGE_ENTITY, { id: 'TL-LEND-EN02', role: 'root', in_root_table: null })).problems.map((p) => p.rule)).toEqual(['aggregate-root']);
    expect(fileOf(store, 'entity')).toBe(before);
    await runCommand(store, ADD_ENTITY, { id: 'TL-LEND-EN04', title: 'Repair', aggregate_id: 'TL-LEND-A2', role: 'child', description: 'A repair made to a tool.' });
    await runCommand(store, CHANGE_ENTITY, { id: 'TL-LEND-EN03', role: 'child' });
  });

  it('refuses data files that give an aggregate two roots when they are loaded', async () => {
    const store = await aggregateDataSet();
    const data = { ...domainModelBase(), ...Object.fromEntries(['aggregate', 'entity'].map((t) => [t, store.rows(t)])) };
    data.entity = data.entity.map((e) => (e.id === 'TL-LEND-EN02' ? { id: e.id, title: e.title, aggregate_id: e.aggregate_id, role: 'root', description: e.description } : e));
    const refused = await openStore(writeData(data), { latheDataDir: null }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(StoreError);
    expect((refused as StoreError).problems).toEqual([expect.objectContaining({ rule: 'aggregate-root', key: 'TL-LEND-A1', file: 'data/aggregate.jsonl', line: 1 })]);
  });
});
