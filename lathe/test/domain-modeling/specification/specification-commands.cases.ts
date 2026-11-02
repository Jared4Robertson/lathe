// The commands of the specification aggregate, run on a store as the CLI, the MCP tools and HTTP run them. Its cases are proved by
// LA-PAT-AGGREGATE-COMMANDS-R10-T01, which runs them from lathe/test/domain-modeling/aggregate/aggregate-commands.test.ts.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { expect, it } from 'vitest';
import { ADD_PREDICATE } from '../../../src/domain-modeling/specification/commands/add-predicate.ts';
import { ADD_SPECIFICATION } from '../../../src/domain-modeling/specification/commands/add-specification.ts';
import { ADD_SPECIFICATION_TEST } from '../../../src/domain-modeling/specification/commands/add-specification-test.ts';
import { CHANGE_PREDICATE } from '../../../src/domain-modeling/specification/commands/change-predicate.ts';
import { CHANGE_SPECIFICATION } from '../../../src/domain-modeling/specification/commands/change-specification.ts';
import { CHANGE_SPECIFICATION_TEST } from '../../../src/domain-modeling/specification/commands/change-specification-test.ts';
import { GET_SPECIFICATION, LIST_SPECIFICATIONS, NEXT_SPECIFICATION_ID } from '../../../src/domain-modeling/specification/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';
import { domainModelBase } from '../domain-model-base.ts';
import { AROUND, specificationDataSet } from './data-set.ts';

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
type Whole = ReturnType<typeof GET_SPECIFICATION.run>;

export function specificationCommandCases(): void {
  it('builds the data set with its own Add commands, and reads a specification whole by any record in it', async () => {
    const store = await specificationDataSet();
    const whole = runQuery(store, GET_SPECIFICATION, { id: 'TL-LEND-SP02-T' }) as Whole;
    expect(whole).toMatchObject({ record: { id: 'TL-LEND-SP02-T', kind: 'specification_test' }, specification: { id: 'TL-LEND-SP02' }, domain: 'TL-LEND', reads: ['TL-LEND-A1'], predicate: { predicate: { id: 'TL-LEND-SP02-PR' }, meets: ['TL-STD-CODE-R01'], packages: ['date-fns'] }, test: { test: { id: 'TL-LEND-SP02-T' }, startsFrom: ['TL-LEND-TD01'] } });
    expect(GET_SPECIFICATION.text(whole)).toContain('Predicate TL-LEND-SP02-PR: isAtLoanLimit (src/lending/limits.ts) [meets TL-STD-CODE-R01; uses date-fns]');
    expect(runQuery(store, LIST_SPECIFICATIONS, { domain_id: 'TL-LEND' })).toEqual([
      { id: 'TL-LEND-SP01', title: 'Tool is free' },
      { id: 'TL-LEND-SP02', title: 'Member is at the loan limit' },
    ]);
    expect(runQuery(store, NEXT_SPECIFICATION_ID, { kind: 'specification', parent: 'TL-LEND' })).toBe('TL-LEND-SP03');
    expect(runQuery(store, NEXT_SPECIFICATION_ID, { kind: 'predicate', parent: 'TL-LEND-SP01' })).toBe('TL-LEND-SP01-PR');
    expect(() => runQuery(store, NEXT_SPECIFICATION_ID, { kind: 'specification_test', parent: 'TL-LEND-SP02' })).toThrow(/already has its test, TL-LEND-SP02-T/);
    expect(() => runQuery(store, NEXT_SPECIFICATION_ID, { kind: 'predicate', parent: 'TL-LEND' })).toThrow(/a predicate sits under a specification, and TL-LEND is a domain/);
  });

  it('changes each kind, writing only its own tables: a list given replaces its list, null clears an optional column', async () => {
    const store = await specificationDataSet();
    expect((await runCommand(store, CHANGE_SPECIFICATION, { id: 'TL-LEND-SP02', reads: ['TL-LEND-A1', 'TL-LEND-A2'] })).tables).toEqual(['reads']);
    expect((await runCommand(store, CHANGE_PREDICATE, { id: 'TL-LEND-SP02-PR', file: null, packages: [] })).tables).toEqual(['package_use', 'predicate']);
    expect(store.record('TL-LEND-SP02-PR')?.row).not.toHaveProperty('file');
    expect((await runCommand(store, CHANGE_SPECIFICATION_TEST, { id: 'TL-LEND-SP02-T', level: 'integration', starts_from: [] })).tables).toEqual(['specification_test', 'starts_from']);
  });

  it("refuses a second predicate or test, an input that is not the command's, and a record that is not there, changing no file", async () => {
    const store = await specificationDataSet();
    const before = fileOf(store, 'predicate');
    expect((await refusal(store, ADD_PREDICATE, { id: 'TL-LEND-SP02-PR2', title: 'again', specification_id: 'TL-LEND-SP02' })).problems[0]).toMatchObject({ rule: 'specification-one-each', message: 'specification TL-LEND-SP02 already has its predicate, so TL-LEND-SP02-PR2 cannot be a second: a specification has one' });
    expect((await refusal(store, ADD_SPECIFICATION_TEST, { id: 'TL-LEND-SP02-T2', title: 'again', specification_id: 'TL-LEND-SP02', level: 'unit', state: 'not automated yet', when: 'x', then: 'y' })).problems[0].rule).toBe('specification-one-each');
    expect((await refusal(store, ADD_SPECIFICATION, { id: 'TL-LEND-SP02', title: 'Again', statement: 'Again.' })).problems[0].rule).toBe('primary-key');
    await expect(runCommand(store, CHANGE_PREDICATE, { id: 'TL-LEND-SP02-PR', specification_id: 'TL-LEND-SP01' })).rejects.toThrow(/change-predicate takes no specification_id/);
    await expect(runCommand(store, CHANGE_SPECIFICATION, { id: 'TL-LEND-SP02', reads: 'TL-LEND-A1' })).rejects.toThrow(/reads .* is not a list of record IDs/);
    expect((await refusal(store, CHANGE_SPECIFICATION, { id: 'TL-LEND-SP09', title: 'x' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no specification TL-LEND-SP09' });
    expect(fileOf(store, 'predicate')).toBe(before);
  });

  it('runs `lathe specification <command>`, the specification_ tools and POST /api/specification/<command>', async () => {
    const root = writeData(domainModelBase(AROUND));
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['specification', 'add-specification', '--id', 'TL-LEND-SP02', '--title', 'Member is at the loan limit', '--statement', 'Three active loans.', '--reads', 'TL-LEND-A1', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added reads source_id TL-LEND-SP02, target_id TL-LEND-A1');
    expect((await callTool(root, 'specification_add_predicate', { id: 'TL-LEND-SP02-PR', title: 'isAtLoanLimit', specification_id: 'TL-LEND-SP02' })).isError).toBeUndefined();
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const post = (route: string, body: unknown) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/specification/remove-predicate', { id: 'TL-LEND-SP02-PR' })).status).toBe(200);
      expect((await post('/api/specification/remove-specification', { id: 'TL-LEND-SP09' })).status).toBe(422);
      expect((await post('/api/specification/add-specification', { id: 'TL-LEND-SP03', colour: 'red' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
