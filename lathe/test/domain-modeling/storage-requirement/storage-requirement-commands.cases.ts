// The commands of the storage-requirement aggregate, run on a store as the CLI, the MCP tools and HTTP run them. Its cases are proved by
// LA-PAT-AGGREGATE-COMMANDS-R10-T01, which runs them from lathe/test/domain-modeling/aggregate/aggregate-commands.test.ts.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { expect, it } from 'vitest';
import { ADD_STORAGE_REQUIREMENT } from '../../../src/domain-modeling/storage-requirement/commands/add-storage-requirement.ts';
import { ADD_STORAGE_REQUIREMENT_TEST } from '../../../src/domain-modeling/storage-requirement/commands/add-storage-requirement-test.ts';
import { CHANGE_STORAGE_REQUIREMENT } from '../../../src/domain-modeling/storage-requirement/commands/change-storage-requirement.ts';
import { CHANGE_STORAGE_REQUIREMENT_TEST } from '../../../src/domain-modeling/storage-requirement/commands/change-storage-requirement-test.ts';
import { GET_STORAGE_REQUIREMENT, LIST_STORAGE_REQUIREMENTS, NEXT_STORAGE_REQUIREMENT_ID } from '../../../src/domain-modeling/storage-requirement/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';
import { domainModelBase } from '../domain-model-base.ts';
import { AROUND, storageRequirementDataSet } from './data-set.ts';

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
type Whole = ReturnType<typeof GET_STORAGE_REQUIREMENT.run>;

export function storageRequirementCommandCases(): void {
  it('builds the data set with its own Add commands, and reads a storage requirement whole by any record in it', async () => {
    const store = await storageRequirementDataSet();
    const whole = runQuery(store, GET_STORAGE_REQUIREMENT, { id: 'TL-LEND-A1-SR01-T02' }) as Whole;
    expect(whole).toMatchObject({
      record: { id: 'TL-LEND-A1-SR01-T02', kind: 'storage_requirement_test' },
      requirement: { id: 'TL-LEND-A1-SR01', aggregate_id: 'TL-LEND-A1' },
      parent: { id: 'TL-LEND-A1', kind: 'aggregate', title: 'Loan' },
      builder: { id: 'TL-LEND-REPO01', kind: 'repository', title: 'LoanRepository', file: 'src/lending/loans.ts', storedIn: { id: 'TL-STORE01', title: 'DATABASE_URL', kind: 'database' } },
      tests: [{ test: { id: 'TL-LEND-A1-SR01-T01' }, startsFrom: ['TL-LEND-TD01'] }, { test: { id: 'TL-LEND-A1-SR01-T02' }, startsFrom: [] }],
    });
    expect(GET_STORAGE_REQUIREMENT.text(whole)).toContain('built by: TL-LEND-REPO01 LoanRepository (src/lending/loans.ts), stored in TL-STORE01 DATABASE_URL');
    expect(runQuery(store, GET_STORAGE_REQUIREMENT, { id: 'TL-LEND-RM01-SR01' })).toMatchObject({ parent: { id: 'TL-LEND-RM01', kind: 'read_model' }, builder: null, tests: [] });
    expect(runQuery(store, LIST_STORAGE_REQUIREMENTS, { parent: 'TL-LEND-A1' })).toEqual([{ id: 'TL-LEND-A1-SR01', title: 'A loan is saved with its outbox event' }]);
    expect(runQuery(store, NEXT_STORAGE_REQUIREMENT_ID, { kind: 'storage_requirement', parent: 'TL-LEND-A1' })).toBe('TL-LEND-A1-SR02');
    expect(runQuery(store, NEXT_STORAGE_REQUIREMENT_ID, { kind: 'storage_requirement_test', parent: 'TL-LEND-A1-SR01' })).toBe('TL-LEND-A1-SR01-T03');
    expect(() => runQuery(store, NEXT_STORAGE_REQUIREMENT_ID, { kind: 'storage_requirement_test', parent: 'TL-LEND-A1' })).toThrow(/a storage_requirement_test sits under a storage_requirement, and TL-LEND-A1 is an aggregate/);
    expect(() => runQuery(store, GET_STORAGE_REQUIREMENT, { id: 'TL-LEND-A1' })).toThrow(/TL-LEND-A1 is an aggregate, not a storage requirement or a record in one/);
  });

  it('changes each kind, writing only its own tables: a list given replaces its list, null clears an optional column', async () => {
    const store = await storageRequirementDataSet();
    expect((await runCommand(store, CHANGE_STORAGE_REQUIREMENT, { id: 'TL-LEND-A1-SR01', title: 'A loan is kept with its event' })).tables).toEqual(['storage_requirement']);
    expect((await runCommand(store, CHANGE_STORAGE_REQUIREMENT_TEST, { id: 'TL-LEND-A1-SR01-T01', file: null, state: 'not automated yet', starts_from: [] })).tables).toEqual(['starts_from', 'storage_requirement_test']);
    expect(store.record('TL-LEND-A1-SR01-T01')?.row).not.toHaveProperty('file');
  });

  it("refuses a requirement under no parent or two, an input that is not the command's, and a record that is not there, changing no file", async () => {
    const store = await storageRequirementDataSet();
    const before = fileOf(store, 'storage_requirement');
    const both = { id: 'TL-LEND-A1-SR02', title: 'Both', aggregate_id: 'TL-LEND-A1', read_model_id: 'TL-LEND-RM01', statement: 'Kept.' };
    expect((await refusal(store, ADD_STORAGE_REQUIREMENT, both)).problems[0]).toMatchObject({ rule: 'parent', message: 'storage requirement TL-LEND-A1-SR02 sits under exactly one aggregate or read model: give exactly one of aggregate_id and read_model_id' });
    expect((await refusal(store, ADD_STORAGE_REQUIREMENT, { id: 'TL-LEND-A1-SR02', title: 'None', statement: 'Kept.' })).problems[0].rule).toBe('parent');
    expect((await refusal(store, ADD_STORAGE_REQUIREMENT, { id: 'TL-LEND-A1-SR01', title: 'Again', aggregate_id: 'TL-LEND-A1', statement: 'Again.' })).problems[0].rule).toBe('primary-key');
    await expect(runCommand(store, CHANGE_STORAGE_REQUIREMENT, { id: 'TL-LEND-A1-SR01', aggregate_id: 'TL-LEND-A2' })).rejects.toThrow(/change-storage-requirement takes no aggregate_id/);
    expect((await refusal(store, ADD_STORAGE_REQUIREMENT_TEST, { id: 'TL-LEND-A1-SR09-T01', title: 'x', storage_requirement_id: 'TL-LEND-A1-SR09', level: 'integration', state: 'not automated yet', when: 'x', then: 'y' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no storage requirement TL-LEND-A1-SR09' });
    expect((await refusal(store, CHANGE_STORAGE_REQUIREMENT_TEST, { id: 'TL-LEND-A1-SR01-T09', title: 'x' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no storage requirement test TL-LEND-A1-SR01-T09' });
    expect(fileOf(store, 'storage_requirement')).toBe(before);
  });

  it('runs `lathe storage-requirement <command>`, the storage_requirement_ tools and POST /api/storage-requirement/<command>', async () => {
    const root = writeData(domainModelBase(AROUND));
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['storage-requirement', 'add-storage-requirement', '--id', 'TL-LEND-A1-SR01', '--title', 'A loan is saved whole', '--aggregate_id', 'TL-LEND-A1', '--statement', 'A loan MUST be saved whole.', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added storage_requirement TL-LEND-A1-SR01');
    expect((await callTool(root, 'storage_requirement_add_storage_requirement_test', { id: 'TL-LEND-A1-SR01-T01', title: 'Survives a restart', storage_requirement_id: 'TL-LEND-A1-SR01', level: 'integration', state: 'not automated yet', when: 'Restarts.', then: 'Reads it back.' })).isError).toBeUndefined();
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const post = (route: string, body: unknown) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/storage-requirement/remove-storage-requirement-test', { id: 'TL-LEND-A1-SR01-T01' })).status).toBe(200);
      expect((await post('/api/storage-requirement/remove-storage-requirement', { id: 'TL-LEND-A1-SR09' })).status).toBe(422);
      expect((await post('/api/storage-requirement/add-storage-requirement', { id: 'TL-LEND-A1-SR02', colour: 'red' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
