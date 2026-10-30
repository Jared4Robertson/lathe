// The Extension record aggregate's commands, queries and refusals (LA-AUT-A19), run on a store as the CLI, the MCP
// tools and the HTTP API run them: each command changes one record of a product's own kind through
// ExtensionRecordRepository, held to its kind's declaration, and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_EXTENSION_RECORD } from '../../../src/authoring/extension-record/commands/add-extension-record.ts';
import { CHANGE_EXTENSION_RECORD } from '../../../src/authoring/extension-record/commands/change-extension-record.ts';
import { REMOVE_EXTENSION_RECORD } from '../../../src/authoring/extension-record/commands/remove-extension-record.ts';
import { GET_EXTENSION_RECORD, LIST_EXTENSION_RECORDS, NEXT_EXTENSION_RECORD_ID } from '../../../src/authoring/extension-record/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool, tools } from '../../../src/cli/mcp.ts';
import { readSchema } from '../../../src/cli/operations.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { writeData, type Data } from '../../helpers.ts';

/**
 * The data the set starts from: product TL with domain TL-LEND and its one command, a second product OT with domain
 * OT-D, and TL's declarations: a report under a domain (file required, usage optional, a description as its lead), a
 * report section under a report, and the relation reports_on from a report to a command.
 */
function declared(): Data {
  return {
    product: [
      { id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' },
      { id: 'OT', title: 'Other', description: 'Another product.' },
    ],
    domain: [
      { id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core', description: 'Lending tools to members.' },
      { id: 'OT-D', title: 'Other', product_id: 'OT', subdomain_type: 'generic', description: "The other product's one domain." },
    ],
    aggregate: [{ id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member.' }],
    entity: [{ id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' }],
    command: [{ id: 'TL-LEND-CMD01', title: 'Open a loan', entity_id: 'TL-LEND-EN01', description: 'Lends a free tool to a member.' }],
    product_kind: [
      { name: 'report', product_id: 'TL', label: 'Report', description: 'A script that measures the outcomes.', parent_kind: 'domain', stage: 'technical-specification', obligation: false, id_pattern: '<domain>-RP<nn>', id_example: 'TL-LEND-RP01', title_form: 'identifier' },
      { name: 'report_section', product_id: 'TL', label: 'Report section', description: 'One section of a report.', parent_kind: 'report', stage: 'technical-specification', obligation: false, id_pattern: '<report>-S<nn>', id_example: 'TL-LEND-RP01-S01' },
    ],
    product_kind_field: [
      { kind: 'report', position: 1, name: 'file', type: 'text', required: true, description: 'The script, from the product root.' },
      { kind: 'report', position: 2, name: 'usage', type: 'text', required: false, description: 'How it is run.' },
      { kind: 'report', position: 3, name: 'description', type: 'text', required: true, description: 'What it counts.' },
    ],
    product_relation: [
      { name: 'reports_on', source_kind: 'report', target_kind: 'command', product_id: 'TL', forward_label: 'Reports on', reverse_label: 'Reported on by', description: 'The report counts what the command does.' },
    ],
  };
}

/**
 * The Extension record test data set (LA-AUT-TD119): the declarations above, then report TL-LEND-RP01 with its links
 * and packages and its section TL-LEND-RP01-S01, each added with Add an extension record.
 */
async function extensionRecordDataSet(store: Store): Promise<void> {
  await runCommand(store, ADD_EXTENSION_RECORD, {
    kind: 'report',
    id: 'TL-LEND-RP01',
    parent_id: 'TL-LEND',
    values: { title: 'printOutcomeReport', file: 'src/outcomes.ts', description: 'Counts each outcome for a month.' },
    links: { reports_on: ['TL-LEND-CMD01'] },
    packages: ['vitest'],
  });
  await runCommand(store, ADD_EXTENSION_RECORD, { kind: 'report_section', id: 'TL-LEND-RP01-S01', parent_id: 'TL-LEND-RP01', values: { title: 'Loans' } });
}

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

async function storeOf(data: Data = declared()): Promise<Store> {
  const store = await openStore(writeData(data), { latheDataDir: null });
  open.push(store);
  await extensionRecordDataSet(store);
  return store;
}

/** A product root holding the data set, for the CLI, the MCP tools and HTTP. */
async function rootOf(): Promise<string> {
  const root = writeData(declared());
  const store = await openStore(root, { latheDataDir: null });
  await extensionRecordDataSet(store);
  await store.close();
  return root;
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

describe('LA-AUT-UC04-R01-T52 each Extension record command changes one record of a product kind, held to its declaration', () => {
  it('adds a record with its fields, links and packages, writing only its own tables', async () => {
    const store = await storeOf();
    const committed = await runCommand(store, ADD_EXTENSION_RECORD, {
      kind: 'report',
      id: 'TL-LEND-RP02',
      parent_id: 'TL-LEND',
      values: { title: 'printLateReport', file: 'src/late.ts', usage: 'npm run late', description: 'Counts late returns.' },
      links: { reports_on: ['TL-LEND-CMD01'] },
      packages: ['vitest'],
    });
    expect(committed.tables).toEqual(['package_use', 'report', 'reports_on']);
    const whole = runQuery(store, GET_EXTENSION_RECORD, { id: 'TL-LEND-RP02' }) as ReturnType<typeof GET_EXTENSION_RECORD.run>;
    expect(whole).toEqual({
      id: 'TL-LEND-RP02',
      kind: 'report',
      label: 'Report',
      parent: 'TL-LEND',
      values: { title: 'printLateReport', file: 'src/late.ts', usage: 'npm run late', description: 'Counts late returns.' },
      links: { reports_on: ['TL-LEND-CMD01'] },
      packages: ['vitest'],
    });
    expect(runQuery(store, LIST_EXTENSION_RECORDS, { kind: 'report', parent: 'TL-LEND' })).toEqual([
      { id: 'TL-LEND-RP01', title: 'printOutcomeReport' },
      { id: 'TL-LEND-RP02', title: 'printLateReport' },
    ]);
    expect(runQuery(store, NEXT_EXTENSION_RECORD_ID, { kind: 'report', parent: 'TL-LEND' })).toBe('TL-LEND-RP03');
    expect(runQuery(store, NEXT_EXTENSION_RECORD_ID, { kind: 'report_section', parent: 'TL-LEND-RP01' })).toBe('TL-LEND-RP01-S02');
  });

  it('changes a record: a value sets its column, null clears an optional one, a links list replaces its relation\'s', async () => {
    const store = await storeOf();
    await runCommand(store, CHANGE_EXTENSION_RECORD, { id: 'TL-LEND-RP01', values: { usage: 'npm run outcomes' } });
    const committed = await runCommand(store, CHANGE_EXTENSION_RECORD, { id: 'TL-LEND-RP01', values: { usage: null }, links: { reports_on: [] }, packages: [] });
    expect(committed.tables).toEqual(['package_use', 'report', 'reports_on']);
    expect(runQuery(store, GET_EXTENSION_RECORD, { id: 'TL-LEND-RP01' })).toMatchObject({
      id: 'TL-LEND-RP01',
      parent: 'TL-LEND',
      values: { title: 'printOutcomeReport', file: 'src/outcomes.ts', description: 'Counts each outcome for a month.' },
      links: {},
      packages: [],
    });
  });

  it('refuses a field, a relation or a kind its declaration does not have, and a required field left out, changing no file', async () => {
    const store = await storeOf();
    const before = fileOf(store, 'report');
    expect((await refusal(store, CHANGE_EXTENSION_RECORD, { id: 'TL-LEND-RP01', values: { colour: 'red' } })).problems[0]).toMatchObject({
      rule: 'field',
      message: 'a report has no field colour; its fields are title, file, usage, description, and its parent changes by no command',
    });
    expect((await refusal(store, CHANGE_EXTENSION_RECORD, { id: 'TL-LEND-RP01', values: { domain_id: 'OT-D' } })).problems[0].rule).toBe('field');
    expect((await refusal(store, CHANGE_EXTENSION_RECORD, { id: 'TL-LEND-RP01', links: { measured_by: ['TL-LEND-CMD01'] } })).problems[0]).toMatchObject({
      rule: 'relation',
      message: 'a report starts no link of measured_by; it starts reports_on',
    });
    expect((await refusal(store, ADD_EXTENSION_RECORD, { kind: 'aggregate', id: 'TL-LEND-A9', parent_id: 'TL-LEND', values: { title: 'X' } })).problems[0]).toMatchObject({
      rule: 'kind',
      message: 'aggregate is not a product kind; the products declare report, report_section',
    });
    expect((await refusal(store, ADD_EXTENSION_RECORD, { kind: 'report', id: 'TL-LEND-RP02', parent_id: 'TL-LEND', values: { title: 'printX', file: 'src/x.ts' } })).problems[0].rule).toBe('required');
    expect((await refusal(store, CHANGE_EXTENSION_RECORD, { id: 'TL-LEND-RP01', values: { file: null } })).problems[0].rule).toBe('required');
    expect(fileOf(store, 'report')).toBe(before);
  });

  it('refuses an input that is not the command\'s, and a record that is not one', async () => {
    const store = await storeOf();
    await expect(runCommand(store, ADD_EXTENSION_RECORD, { kind: 'report', id: 'TL-LEND-RP02', parent_id: 'TL-LEND' })).rejects.toThrow(new InputError('add-extension-record needs values'));
    await expect(runCommand(store, CHANGE_EXTENSION_RECORD, { id: 'TL-LEND-RP01', parent_id: 'OT-D' })).rejects.toThrow(/change-extension-record takes no parent_id/);
    await expect(runCommand(store, CHANGE_EXTENSION_RECORD, { id: 'TL-LEND-RP01', links: { reports_on: 'TL-LEND-CMD01' } })).rejects.toThrow(/is not an object of record ID lists by relation/);
    expect((await refusal(store, CHANGE_EXTENSION_RECORD, { id: 'TL-LEND-CMD01', values: { title: 'x' } })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no extension record TL-LEND-CMD01' });
    expect(() => runQuery(store, GET_EXTENSION_RECORD, { id: 'TL-LEND-CMD01' })).toThrow(/one of Lathe's kinds/);
    expect(() => runQuery(store, NEXT_EXTENSION_RECORD_ID, { kind: 'report_section', parent: 'TL-LEND' })).toThrow(/a report_section sits under a report, and TL-LEND is a domain/);
  });
});

describe("LA-AUT-INV55-T a record of a product's own kind sits in the product that declares it", () => {
  it('refuses a record of TL\'s kind under another product\'s domain, with its reason, changing no file', async () => {
    const store = await storeOf();
    const before = fileOf(store, 'report');
    const refused = await refusal(store, ADD_EXTENSION_RECORD, { kind: 'report', id: 'OT-D-RP01', parent_id: 'OT-D', values: { title: 'printOther', file: 'src/o.ts', description: 'Counts.' } });
    expect(refused.problems).toEqual([expect.objectContaining({ rule: 'product-kind-product', message: 'OT-D-RP01 is a report, a kind of product TL, but it sits in product OT' })]);
    expect(fileOf(store, 'report')).toBe(before);
  });
});

describe('LA-AUT-UC04-R01-T53 an extension record goes with its links and packages, refused while referenced', () => {
  it('removes a record with what it starts, and refuses one a record of another kind sits under', async () => {
    const store = await storeOf();
    const refused = await refusal(store, REMOVE_EXTENSION_RECORD, { id: 'TL-LEND-RP01' });
    expect(refused.problems).toEqual([expect.objectContaining({ rule: 'referenced' })]);
    expect(refused.problems[0].message).toMatch(/^Report TL-LEND-RP01 is referenced, so it stays: report_section TL-LEND-RP01-S01 \(report_id\)/);
    await runCommand(store, REMOVE_EXTENSION_RECORD, { id: 'TL-LEND-RP01-S01' });
    const removed = await runCommand(store, REMOVE_EXTENSION_RECORD, { id: 'TL-LEND-RP01' });
    expect(removed.changes.filter((c) => c.after === null).map((c) => `${c.table} ${c.key}`).sort()).toEqual([
      'package_use record_id TL-LEND-RP01, package vitest',
      'report TL-LEND-RP01',
      'reports_on source_id TL-LEND-RP01, target_id TL-LEND-CMD01',
    ]);
  });
});

describe('LA-AUT-UC04-R01-T54 each Extension record command and query is reached by name from the CLI, the MCP tools and HTTP', () => {
  it('runs `lathe extension-record <command>` with flags or JSON, and prints the refusal with its reasons', async () => {
    const root = await rootOf();
    const out: string[] = [];
    const err: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => err.push(t), stdin: async () => JSON.stringify({ kind: 'report', id: 'TL-LEND-RP02', parent_id: 'TL-LEND', values: { title: 'printLateReport', file: 'src/late.ts', description: 'Counts late returns.' } }) };
    expect(await runAggregateCommand(['extension-record', 'add-extension-record', '--json', '-', '--root', root], io)).toBe(0);
    expect(JSON.parse(out.pop()!)).toMatchObject({ tables: ['report'] });
    expect(await runAggregateCommand(['extension-record', 'change-extension-record', '--id', 'TL-LEND-RP02', '--values', '{"usage":"npm run late"}', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Changed report TL-LEND-RP02');
    expect(await runAggregateCommand(['extension-record', 'remove-extension-record', '--id', 'TL-LEND-RP01', '--root', root], io)).toBe(1);
    expect(err.pop()).toMatch(/^Refused; nothing changed:\n {2}Report TL-LEND-RP01 is referenced, so it stays: .* \[referenced\]$/);
    expect(await runAggregateCommand(['extension-record', 'next-id', '--kind', 'report', '--parent', 'TL-LEND', '--root', root], io)).toBe(0);
    expect(out.pop()).toBe('TL-LEND-RP03');
  });

  it('serves one MCP tool per command and query', async () => {
    const root = await rootOf();
    const listed = tools(await readSchema(root));
    expect(listed.find((t) => t.name === 'extension_record_add_extension_record')!.inputSchema).toMatchObject({ required: ['kind', 'id', 'parent_id', 'values'], additionalProperties: false });
    expect(listed.map((t) => t.name)).toEqual(expect.arrayContaining(['extension_record_change_extension_record', 'extension_record_remove_extension_record', 'extension_record_get_extension_record', 'extension_record_list_extension_records', 'extension_record_next_id']));
    const changed = await callTool(root, 'extension_record_change_extension_record', { id: 'TL-LEND-RP01', values: { usage: 'npm run outcomes' } });
    expect(changed.isError).toBeUndefined();
    const read = await callTool(root, 'extension_record_get_extension_record', { id: 'TL-LEND-RP01' });
    expect(read.content[0].text).toContain('report TL-LEND-RP01: printOutcomeReport');
    expect(read.content[0].text).toContain('reports_on: TL-LEND-CMD01');
  });

  it('answers POST /api/extension-record/<command> with the changed rows, and 422 with the refusal', async () => {
    const root = await rootOf();
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      const changed = await post('/api/extension-record/change-extension-record', { id: 'TL-LEND-RP01', values: { usage: 'npm run outcomes' } });
      expect(changed.status).toBe(200);
      expect(await changed.json()).toMatchObject({ ok: true, tables: ['report'] });
      const refused = await post('/api/extension-record/remove-extension-record', { id: 'TL-LEND-RP01' });
      expect(refused.status).toBe(422);
      expect(await refused.json()).toMatchObject({ ok: false, problems: [{ rule: 'referenced' }] });
    } finally {
      await closeStores(root);
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
