// The MCP server's tools: input schemas generated from the schema description, each tool's good result and refusal,
// and the JSON-RPC exchange over stdio that Claude Code holds with `lathe mcp`.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { openStore } from '../../src/index.ts';
import { callTool, serveMcp, tools, type Tool } from '../../src/cli/mcp.ts';
import { everyKind, removeData, writeData } from '../store/fixture.ts';

afterAll(removeData);

async function schemaOf(root: string) {
  const store = await openStore(root);
  const schema = store.schema;
  await store.close();
  return schema;
}

const tool = (all: Tool[], name: string) => all.find((t) => t.name === name)!;
type Schema = { properties: Record<string, Schema>; required?: string[]; enum?: unknown[]; type?: unknown; description?: string };

describe('the tools', () => {
  it('are add, set, move, link, unlink, remove, show, list, next_id and check', async () => {
    const all = tools(await schemaOf(writeData(everyKind())));
    expect(all.map((t) => t.name)).toEqual(['add', 'set', 'move', 'link', 'unlink', 'remove', 'show', 'list', 'next_id', 'check']);
    for (const t of all) {
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.inputSchema.type).toBe('object');
    }
  });

  it('take input schemas generated from the schema description, product kinds included', async () => {
    const schema = await schemaOf(writeData(everyKind()));
    const all = tools(schema);
    const add = tool(all, 'add').inputSchema as unknown as Schema;
    // One property per table that takes rows; links are not among them.
    expect(Object.keys(add.properties)).toContain('requirement');
    expect(Object.keys(add.properties)).toContain('entity_field');
    expect(Object.keys(add.properties)).toContain('invariant');
    expect(Object.keys(add.properties)).not.toContain('proves');
    const requirement = add.properties.requirement;
    expect(requirement.required).toEqual(['id', 'title', 'use_case_id', 'statement']);
    expect(requirement.properties.statement).toEqual({ type: 'string', minLength: 1, description: schema.tables.requirement.columns.find((c) => c.name === 'statement')!.description });
    expect(requirement.description).toContain('ID: <use case>-R<nn>, such as TL-LEND-UC01-R01. Parent: use_case (use_case_id).');
    expect(add.properties.entity.properties.role).toMatchObject({ type: 'string', enum: ['root', 'child'] });
    expect(add.properties.capability.properties.position).toMatchObject({ type: 'integer' });
    expect(add.properties.check.properties.kinds).toMatchObject({ type: 'array', items: { type: 'string', minLength: 1 } });
    expect(add.properties.invariant.required).toEqual(['id', 'title', 'aggregate_id', 'strength']);

    // set: the key is required, other columns may be null (cleared), and parent columns are left to move.
    const set = (tool(all, 'set').inputSchema as unknown as Schema).properties;
    expect(set.requirement.required).toEqual(['id']);
    expect(Object.keys(set.requirement.properties)).toEqual(['id', 'title', 'statement', 'group_name']);
    expect(set.requirement.properties.group_name.type).toEqual(['string', 'null']);
    expect(set.requirement.properties.statement.type).toBe('string');
    expect(set.entity_field.required).toEqual(['entity_id', 'position']);

    const link = (tool(all, 'link').inputSchema as unknown as Schema).properties;
    expect(link.relation.enum).toContain('enforces');
    expect(link.relation.description).toContain('satisfies (Satisfies; component->domain_rule');
    expect((tool(all, 'next_id').inputSchema as unknown as Schema).properties.kind.enum).toContain('invariant');
    expect(Object.keys((tool(all, 'remove').inputSchema as unknown as Schema).properties)).toEqual(expect.arrayContaining(['id', 'entity_field', 'check']));
  });
});

describe('each tool', () => {
  it('add returns the row added, and a refusal with its reason', async () => {
    const root = writeData(everyKind());
    const added = await callTool(root, 'add', { requirement: { id: 'TL-LEND-UC01-R02', title: 'Member known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' } });
    expect(added.isError).toBeUndefined();
    expect(added.structuredContent).toEqual({
      changes: [{ change: 'added', table: 'requirement', link: false, key: 'TL-LEND-UC01-R02', row: { id: 'TL-LEND-UC01-R02', title: 'Member known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' } }],
      files: ['data/requirement.jsonl'],
    });
    expect(added.content).toEqual([
      { type: 'text', text: 'Added requirement TL-LEND-UC01-R02: {"id":"TL-LEND-UC01-R02","title":"Member known","use_case_id":"TL-LEND-UC01","statement":"The library MUST refuse an unknown member."}\nWrote data/requirement.jsonl' },
    ]);

    const refused = await callTool(root, 'add', { requirement: { id: 'TL-LEND-UC01-R03', title: 'X', use_case_id: 'TL-NOPE', statement: 'S.' } });
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toBe('Refused; nothing changed:\n  requirement TL-LEND-UC01-R03: use_case_id "TL-NOPE" names no use_case [foreign-key]');
    expect(refused.structuredContent).toEqual({ refused: true, problems: [expect.objectContaining({ rule: 'foreign-key' })] });
    expect((await callTool(root, 'add', { view: { id: 'TL-LEND-V02' }, api: { id: 'TL-LEND-API02' } })).content[0].text).toContain('add takes exactly one property');
  });

  it('set changes a record and clears a column with null; refuses a parent column', async () => {
    const root = writeData(everyKind());
    const set = await callTool(root, 'set', { view: { id: 'TL-LEND-V01', route: null, description: 'The tools.' } });
    expect(set.content[0].text).toBe('Changed view TL-LEND-V01: {"id":"TL-LEND-V01","title":"Catalog","domain_id":"TL-LEND","description":"The tools."}\nWrote data/view.jsonl');
    const part = await callTool(root, 'set', { entity_field: { entity_id: 'TL-LEND-EN01', position: 1, example: '32' } });
    expect(part.isError).toBeUndefined();
    const parent = await callTool(root, 'set', { view: { id: 'TL-LEND-V01', domain_id: 'TL-LEND' } });
    expect(parent.isError).toBe(true);
    expect(parent.content[0].text).toContain('domain_id places the record under its parent; use move [command]');
  });

  it('move, link and unlink return every changed row, or the refusal', async () => {
    const root = writeData(everyKind());
    const moved = await callTool(root, 'move', { id: 'TL-LEND-C02', parent: 'TL-LEND-LAY02' });
    expect(moved.structuredContent?.changes).toEqual([expect.objectContaining({ change: 'changed', table: 'component', key: 'TL-LEND-C02', row: expect.objectContaining({ layer_id: 'TL-LEND-LAY02' }) })]);
    expect((await callTool(root, 'move', { id: 'TL-LEND-C02', parent: 'TL-LEND-A1' })).isError).toBe(true);
    const linked = await callTool(root, 'link', { source: 'TL-LEND-T01', relation: 'proves', target: 'TL-LEND-DR01' });
    expect(linked.content[0].text).toBe('Added link TL-LEND-T01 proves TL-LEND-DR01\nWrote data/proves.jsonl');
    expect((await callTool(root, 'link', { source: 'TL-LEND-T01', relation: 'proves', target: 'TL-LEND-DR01' })).isError).toBe(true);
    expect((await callTool(root, 'unlink', { source: 'TL-LEND-T01', relation: 'proves', target: 'TL-LEND-DR01' })).content[0].text).toBe('Removed link TL-LEND-T01 proves TL-LEND-DR01\nWrote data/proves.jsonl');
    expect((await callTool(root, 'link', { source: 'TL-LEND-T01', relation: 'nope', target: 'TL-LEND-DR01' })).content[0].text).toContain('there is no relation nope');
    expect((await callTool(root, 'link', { source: 'TL-LEND-T01', relation: 'proves' })).content[0].text).toContain('target is a non-empty string');
  });

  it('remove takes a record by its ID or a part by its key, and is refused while referenced', async () => {
    const root = writeData(everyKind());
    const referenced = await callTool(root, 'remove', { id: 'TL-LEND-V01' });
    expect(referenced.isError).toBe(true);
    expect(referenced.content[0].text).toContain('view TL-LEND-V01 is referenced, so it stays: TL-LEND-F01 uses TL-LEND-V01 [referenced]');
    await callTool(root, 'unlink', { source: 'TL-LEND-F01', relation: 'uses', target: 'TL-LEND-V01' });
    expect((await callTool(root, 'remove', { id: 'TL-LEND-V01' })).structuredContent?.changes).toEqual([expect.objectContaining({ change: 'removed', table: 'view', key: 'TL-LEND-V01' })]);
    const part = await callTool(root, 'remove', { use_case_step: { use_case_id: 'TL-LEND-UC01', position: 1 } });
    expect(part.content[0].text).toContain('Removed use_case_step use_case_id TL-LEND-UC01, position 1');
  });

  it('show, list and next_id read the data', async () => {
    const root = writeData(everyKind());
    const shown = await callTool(root, 'show', { id: 'TL-LEND-EN01' });
    expect(shown.structuredContent).toMatchObject({
      kind: 'entity',
      parent: 'TL-LEND-A1',
      parts: [{ table: 'entity_field', rows: [expect.objectContaining({ name: 'Loan ID' })] }],
      links: expect.arrayContaining([{ relation: 'has_many', label: 'Has many', direction: 'out', id: 'TL-LEND-EN02', title: 'Return' }]),
    });
    expect(shown.content[0].text).toContain('Entity TL-LEND-EN01: Loan');
    expect((await callTool(root, 'show', { id: 'TL-NOPE' })).isError).toBe(true);
    const listed = await callTool(root, 'list', { table: 'domain_rule', parent: 'TL-LEND-A1' });
    expect(listed.structuredContent).toEqual({ rows: [expect.objectContaining({ id: 'TL-LEND-DR01' })] });
    expect(listed.content[0].text).toBe('TL-LEND-DR01  One active loan per tool');
    expect((await callTool(root, 'next_id', { kind: 'domain_rule', parent: 'TL-LEND-A1' })).structuredContent).toEqual({ id: 'TL-LEND-DR03' });
    expect((await callTool(root, 'next_id', { kind: 'domain_rule', parent: 'TL-LEND-UC01' })).isError).toBe(true);
  });

  it('check reports the errors and warnings with a count', async () => {
    const root = writeData(everyKind());
    const checked = await callTool(root, 'check', {});
    expect(checked.structuredContent).toEqual({ errors: expect.any(Number), warnings: expect.any(Number), problems: expect.any(Array) });
    expect(checked.content[0].text).toMatch(/\d+ errors?, \d+ warnings?\.$/);
    expect(checked.isError).toBe((checked.structuredContent!.errors as number) > 0);
  });

  it('refuses an unknown tool', async () => {
    const root = writeData(everyKind());
    expect(await callTool(root, 'format', {})).toMatchObject({ isError: true, content: [{ type: 'text', text: 'Refused; nothing changed: there is no tool format.' }] });
  });
});

describe('the server', () => {
  it('answers initialize, tools/list and tools/call over stdio, and says when the tools change', async () => {
    const root = writeData(everyKind());
    const input = new PassThrough();
    const output = new PassThrough();
    let received = '';
    output.on('data', (chunk) => (received += chunk));
    const served = serveMcp(root, input, output);
    const send = (message: object) => input.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
    send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
    send({ method: 'notifications/initialized' });
    send({ id: 2, method: 'tools/list' });
    send({ id: 3, method: 'tools/call', params: { name: 'add', arguments: { view: { id: 'TL-LEND-V02', title: 'Desk', domain_id: 'TL-LEND' } } } });
    send({ id: 4, method: 'tools/call', params: { name: 'add', arguments: { product_kind: { name: 'report', product_id: 'TL', label: 'Report', description: 'A report.', parent_kind: 'domain', obligation: 'none' } } } });
    send({ id: 5, method: 'tools/list' });
    send({ id: 6, method: 'nope' });
    input.write('not json\n');
    input.end();
    await served;

    const messages = received.trim().split('\n').map((l) => JSON.parse(l));
    const byId = (id: number) => messages.find((m) => m.id === id);
    expect(byId(1).result).toMatchObject({ protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: true } }, serverInfo: { name: 'lathe' } });
    expect(byId(2).result.tools.map((t: Tool) => t.name)).toContain('add');
    expect(byId(3).result.content[0].text).toContain('Added view TL-LEND-V02');
    expect(byId(4).result.isError).toBeUndefined();
    expect(messages).toContainEqual({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' });
    expect(Object.keys(byId(5).result.tools[0].inputSchema.properties)).toContain('report');
    expect(byId(6).error).toEqual({ code: -32601, message: 'Method not found: nope' });
    expect(messages).toContainEqual({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    expect(messages.filter((m) => m.id === undefined).length).toBe(1);
    expect(readFileSync(path.join(root, 'data', 'view.jsonl'), 'utf8')).toContain('TL-LEND-V02');
  });
});
