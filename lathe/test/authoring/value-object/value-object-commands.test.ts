// The Value object aggregate's commands, queries and refusals (LA-AUT-A9), run on a store as the CLI, the MCP tools and
// the HTTP API run them: each command changes one value object through ValueObjectRepository and is refused with its
// reason, changing nothing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_CONSTRAINT_TEST } from '../../../src/authoring/value-object/commands/add-constraint-test.ts';
import { ADD_VALUE_TYPE } from '../../../src/authoring/value-object/commands/add-value-type.ts';
import { CHANGE_CONSTRAINT } from '../../../src/authoring/value-object/commands/change-constraint.ts';
import { CHANGE_CONSTRAINT_TEST } from '../../../src/authoring/value-object/commands/change-constraint-test.ts';
import { CHANGE_VALUE_OBJECT } from '../../../src/authoring/value-object/commands/change-value-object.ts';
import { CHANGE_VALUE_TYPE } from '../../../src/authoring/value-object/commands/change-value-type.ts';
import { REMOVE_CONSTRAINT } from '../../../src/authoring/value-object/commands/remove-constraint.ts';
import { REMOVE_CONSTRAINT_TEST } from '../../../src/authoring/value-object/commands/remove-constraint-test.ts';
import { REMOVE_VALUE_OBJECT } from '../../../src/authoring/value-object/commands/remove-value-object.ts';
import { REMOVE_VALUE_TYPE } from '../../../src/authoring/value-object/commands/remove-value-type.ts';
import { GET_VALUE_OBJECT, LIST_VALUE_OBJECTS, NEXT_VALUE_OBJECT_ID } from '../../../src/authoring/value-object/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';
import { closeOpenStores, domainModelBase, storeOn } from '../domain-model-base.ts';
import { valueObjectDataSet } from './data-set.ts';

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
type Whole = ReturnType<typeof GET_VALUE_OBJECT.run>;

describe('LA-AUT-UC24-R50-T01 each Value object command (LA-AUT-A9) changes one value object through ValueObjectRepository, and is reached by name from the CLI, the MCP tools and HTTP', () => {
  it('builds the data set with its own Add commands, and reads a value object whole by any record in it', async () => {
    const store = await valueObjectDataSet();
    const whole = runQuery(store, GET_VALUE_OBJECT, { id: 'TL-VO01-C01-T' }) as Whole;
    expect(whole).toMatchObject({ record: { id: 'TL-VO01-C01-T', kind: 'constraint_test' }, valueObject: { id: 'TL-VO01' }, product: 'TL', constraints: [{ constraint: { id: 'TL-VO01-C01' }, test: { test: { id: 'TL-VO01-C01-T' }, startsFrom: ['TL-LEND-TD01'] } }], valueType: { valueType: { id: 'TL-VO01-VT' }, meets: ['TL-STD-CODE-R01'] } });
    expect(whole.fields).toEqual([{ value_object_id: 'TL-VO01', position: 1, name: 'Address', meaning: 'The address as the member gives it.', type: 'text', required: true, example: 'ada@example.org' }]);
    expect(GET_VALUE_OBJECT.text(whole)).toContain('field 1: Address (text, required)');
    expect(runQuery(store, LIST_VALUE_OBJECTS, { product_id: 'TL' })).toEqual([{ id: 'TL-VO01', title: 'Email address' }]);
    expect(runQuery(store, NEXT_VALUE_OBJECT_ID, { kind: 'value_object', parent: 'TL' })).toBe('TL-VO02');
    expect(runQuery(store, NEXT_VALUE_OBJECT_ID, { kind: 'constraint', parent: 'TL-VO01' })).toBe('TL-VO01-C02');
    expect(() => runQuery(store, NEXT_VALUE_OBJECT_ID, { kind: 'value_type', parent: 'TL-VO01' })).toThrow(/already has its value type, TL-VO01-VT/);
    expect(() => runQuery(store, NEXT_VALUE_OBJECT_ID, { kind: 'constraint_test', parent: 'TL-VO01' })).toThrow(/a constraint_test sits under a constraint, and TL-VO01 is a value_object/);
  });

  it('changes each kind, writing only its own tables: a list given replaces its list, null clears an optional column', async () => {
    const store = await valueObjectDataSet();
    const fields = [
      { name: 'Local part', meaning: 'Before the @.', type: 'text', required: true },
      { name: 'Domain', meaning: 'After the @.', type: 'text', required: true },
    ];
    expect((await runCommand(store, CHANGE_VALUE_OBJECT, { id: 'TL-VO01', fields })).tables).toEqual(['value_object_field']);
    expect(store.rows('value_object_field').map((f) => `${f.position} ${f.name}`)).toEqual(['1 Local part', '2 Domain']);
    expect((await runCommand(store, CHANGE_CONSTRAINT, { id: 'TL-VO01-C01', title: 'Exactly one at sign' })).tables).toEqual(['constraint']);
    expect((await runCommand(store, CHANGE_VALUE_TYPE, { id: 'TL-VO01-VT', file: null, meets: [] })).tables).toEqual(['meets', 'value_type']);
    expect((await runCommand(store, CHANGE_CONSTRAINT_TEST, { id: 'TL-VO01-C01-T', refuses: 'a@b@c', starts_from: [] })).tables).toEqual(['constraint_test', 'starts_from']);
  });

  it("refuses a second value type or constraint test, an input that is not the command's, and a record that is not there, changing no file", async () => {
    const store = await valueObjectDataSet();
    const before = fileOf(store, 'value_object_field');
    expect((await refusal(store, ADD_VALUE_TYPE, { id: 'TL-VO01-VT2', title: 'Email', value_object_id: 'TL-VO01' })).problems[0]).toMatchObject({ rule: 'exists', message: 'TL-VO01 already has its value type, TL-VO01-VT' });
    expect((await refusal(store, ADD_CONSTRAINT_TEST, { id: 'TL-VO01-C01-T2', title: 'again', constraint_id: 'TL-VO01-C01', level: 'unit', state: 'not automated yet', accepts: 'a@b', refuses: 'ab' })).problems[0].rule).toBe('exists');
    await expect(runCommand(store, CHANGE_VALUE_OBJECT, { id: 'TL-VO01', fields: [{ name: 'Address', colour: 'red' }] })).rejects.toThrow(/an item takes name, meaning/);
    await expect(runCommand(store, CHANGE_CONSTRAINT, { id: 'TL-VO01-C01', value_object_id: 'TL-VO02' })).rejects.toThrow(/change-constraint takes no value_object_id/);
    expect((await refusal(store, CHANGE_VALUE_OBJECT, { id: 'TL-VO01', fields: [{ name: 'Address', meaning: 'x', required: true }] })).problems[0].rule).toBe('check');
    expect((await refusal(store, REMOVE_CONSTRAINT, { id: 'TL-VO09-C01' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no constraint TL-VO09-C01' });
    expect(fileOf(store, 'value_object_field')).toBe(before);
  });

  it('runs `lathe value-object <command>`, the value_object_ tools and POST /api/value-object/<command>', async () => {
    const root = writeData(domainModelBase());
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['value-object', 'add-value-object', '--id', 'TL-VO01', '--title', 'Email address', '--description', 'How the library reaches a member.', '--fields', '{"name":"Address","meaning":"As given.","type":"text","required":true}', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added value_object_field value_object_id TL-VO01, position 1');
    expect((await callTool(root, 'value_object_add_constraint', { id: 'TL-VO01-C01', title: 'One at sign', value_object_id: 'TL-VO01', statement: 'An email address MUST have one @.' })).isError).toBeUndefined();
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const post = (route: string, body: unknown) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/value-object/remove-constraint', { id: 'TL-VO01-C01' })).status).toBe(200);
      expect((await post('/api/value-object/remove-value-object', { id: 'TL-VO09' })).status).toBe(422);
      expect((await post('/api/value-object/add-constraint', { id: 'TL-VO01-C02', colour: 'red' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('LA-STD-CODE-R07-T51 a value object, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
  it('removes a constraint with its test, a value type, then the value object whole', async () => {
    const store = await valueObjectDataSet();
    expect((await runCommand(store, REMOVE_CONSTRAINT_TEST, { id: 'TL-VO01-C01-T' })).changes.map((c) => c.table).sort()).toEqual(['constraint_test', 'starts_from']);
    await runCommand(store, ADD_CONSTRAINT_TEST, { id: 'TL-VO01-C01-T', title: 'One at sign', constraint_id: 'TL-VO01-C01', level: 'unit', state: 'not automated yet', accepts: 'a@b', refuses: 'a@b@c' });
    expect((await runCommand(store, REMOVE_CONSTRAINT, { id: 'TL-VO01-C01' })).changes.map((c) => c.table).sort()).toEqual(['constraint', 'constraint_test']);
    expect((await runCommand(store, REMOVE_VALUE_TYPE, { id: 'TL-VO01-VT' })).changes.map((c) => c.table).sort()).toEqual(['meets', 'value_type']);
    expect((await runCommand(store, REMOVE_VALUE_OBJECT, { id: 'TL-VO01' })).changes.map((c) => c.table).sort()).toEqual(['value_object', 'value_object_field']);
  });

  it('refuses to remove a value object a field types, naming it', async () => {
    const store = await storeOn(
      domainModelBase({
        value_object: [{ id: 'TL-VO01', title: 'Email address', description: 'How the library reaches a member.' }],
        aggregate: [{ id: 'TL-LEND-A2', title: 'Member', domain_id: 'TL-LEND', identity: 'Member ID', description: 'Someone who borrows tools.' }],
        entity: [{ id: 'TL-LEND-EN03', title: 'Member', aggregate_id: 'TL-LEND-A2', role: 'root', description: 'The member.' }],
        entity_field: [{ entity_id: 'TL-LEND-EN03', position: 1, name: 'Email', meaning: 'How to reach them.', type_value_object_id: 'TL-VO01', required: true }],
      }),
    );
    expect((await refusal(store, REMOVE_VALUE_OBJECT, { id: 'TL-VO01' })).problems[0].message).toMatch(/^Value object TL-VO01 is referenced, so it stays: .*TL-LEND-EN03/);
  });
});
