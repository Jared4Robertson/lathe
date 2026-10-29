// The MCP server's tools: input schemas generated from the schema description, each tool's good result and refusal,
// and the JSON-RPC exchange over stdio that Claude Code holds with `lathe mcp`.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { loadProducts, openStore, SCHEMA_VERSION } from '../../src/index.ts';
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
type Schema = { properties: Record<string, Schema>; required?: string[]; enum?: unknown[]; type?: unknown; description?: string; oneOf?: unknown };

describe('the tools', () => {
  it('LA-AUT-UC01-R05-T08 are add, set, move, link, unlink, remove, show, list, next_id and check', async () => {
    const all = tools(await schemaOf(writeData(everyKind())));
    expect(all.map((t) => t.name)).toEqual(['add', 'set', 'move', 'link', 'unlink', 'remove', 'show', 'list', 'next_id', 'check']);
    for (const t of all) {
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.inputSchema.type).toBe('object');
    }
  });

  it('LA-AUT-UC01-R06-T03 take input schemas generated from the schema description, product kinds included', async () => {
    const schema = await schemaOf(writeData(everyKind()));
    const all = tools(schema);
    const add = tool(all, 'add').inputSchema as unknown as Schema;
    // One property per table that takes rows; links are not among them.
    expect(Object.keys(add.properties)).toEqual(expect.arrayContaining(['uc_requirement', 'entity_field', 'table_key', 'command_change', 'use_case_actor', 'invariant', 'cli_command']));
    expect(Object.keys(add.properties)).not.toContain('raises');
    const requirement = add.properties.uc_requirement;
    expect(requirement.required).toEqual(['id', 'title', 'use_case_id', 'statement']);
    expect(requirement.properties.statement).toEqual({ type: 'string', minLength: 1, description: schema.tables.uc_requirement.columns.find((c) => c.name === 'statement')!.description });
    expect(requirement.description).toContain('ID: <use case>-R<nn>, such as TL-LEND-UC01-R01. Parent: use_case (use_case_id).');
    expect(add.properties.entity.properties.role).toMatchObject({ type: 'string', enum: ['root', 'child'] });
    expect(add.properties.capability.properties.position).toMatchObject({ type: 'integer' });
    expect(add.properties.check.properties.kinds).toMatchObject({ type: 'array', items: { type: 'string', minLength: 1 } });
    expect(add.properties.invariant.required).toEqual(['id', 'title', 'aggregate_id', 'statement']);
    // Two possible parents: exactly one of them; no owner: no parent column.
    expect(add.properties.endpoint.required).toEqual(['id', 'title', 'method', 'route', 'description']);
    expect(add.properties.endpoint.oneOf).toEqual([{ required: ['command_id'] }, { required: ['query_id'] }]);
    expect(add.properties.endpoint.description).toContain('Parent: exactly one of command (command_id) or query (query_id).');
    expect(add.properties.view.description).toContain('No owner: no parent column; its product is the one its ID starts with.');
    expect(add.properties.view.required).toEqual(['id', 'title', 'description']);
    expect(add.properties.view.oneOf).toBeUndefined();

    // set: the key is required, other columns may be null (cleared), and parent columns are left to move.
    const set = (tool(all, 'set').inputSchema as unknown as Schema).properties;
    expect(set.uc_requirement.required).toEqual(['id']);
    expect(Object.keys(set.uc_requirement.properties)).toEqual(['id', 'title', 'statement', 'group_name']);
    expect(set.uc_requirement.properties.group_name.type).toEqual(['string', 'null']);
    expect(set.uc_requirement.properties.statement.type).toBe('string');
    expect(Object.keys(set.endpoint.properties)).not.toContain('query_id');
    expect(set.entity_field.required).toEqual(['entity_id', 'position']);
    expect(set.command_change.required).toEqual(['command_id', 'aggregate_id']);

    const link = (tool(all, 'link').inputSchema as unknown as Schema).properties;
    expect(link.relation.enum).toEqual(expect.arrayContaining(['raises', 'hears', 'invokes', 'fulfills', 'documents']));
    expect(link.relation.description).toContain('hears (Hears; policy->domain_event)');
    expect((tool(all, 'next_id').inputSchema as unknown as Schema).properties.kind.enum).toEqual(expect.arrayContaining(['invariant', 'value_object', 'flow_test']));
    expect(Object.keys((tool(all, 'remove').inputSchema as unknown as Schema).properties)).toEqual(expect.arrayContaining(['id', 'entity_field', 'table_key', 'check']));
  });
});

describe('LA-AUT-UC01-R05-T10 each tool', () => {
  it('LA-AUT-UC01-R07-T02 add returns the row added, and a refusal with its reason', async () => {
    const root = writeData(everyKind());
    const added = await callTool(root, 'add', { uc_requirement: { id: 'TL-LEND-UC01-R02', title: 'Member known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' } });
    expect(added.isError).toBeUndefined();
    expect(added.structuredContent).toEqual({
      changes: [
        {
          change: 'added',
          table: 'uc_requirement',
          link: false,
          key: 'TL-LEND-UC01-R02',
          row: { id: 'TL-LEND-UC01-R02', title: 'Member known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' },
        },
      ],
      files: ['data/uc_requirement.jsonl'],
    });
    expect(added.content).toEqual([
      {
        type: 'text',
        text: 'Added uc_requirement TL-LEND-UC01-R02: {"id":"TL-LEND-UC01-R02","title":"Member known","use_case_id":"TL-LEND-UC01","statement":"The library MUST refuse an unknown member."}\nWrote data/uc_requirement.jsonl',
      },
    ]);

    const refused = await callTool(root, 'add', { uc_requirement: { id: 'TL-LEND-UC01-R03', title: 'X', use_case_id: 'TL-NOPE', statement: 'S.' } });
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toContain('uc_requirement TL-LEND-UC01-R03: use_case_id "TL-NOPE" names no use_case [foreign-key]');
    expect(refused.structuredContent).toEqual({ refused: true, problems: expect.arrayContaining([expect.objectContaining({ rule: 'foreign-key' })]) });
    const rule = await callTool(root, 'add', { entity_field: { entity_id: 'TL-LEND-EN02', position: 1, name: 'Returned at', meaning: 'When.', required: true } });
    expect(rule.structuredContent).toEqual({
      refused: true,
      problems: [
        expect.objectContaining({
          rule: 'check',
          message: 'entity_field entity_id TL-LEND-EN02, position 1 breaks a rule of its table: exactly one of type, type_value_object_id and type_aggregate_id is given',
        }),
      ],
    });
    expect((await callTool(root, 'add', { view: { id: 'TL-V02' }, integration: { id: 'TL-INT02' } })).content[0].text).toContain('add takes exactly one property');
  });

  it('set changes a record and clears a column with null; refuses a parent column', async () => {
    const root = writeData(everyKind());
    const set = await callTool(root, 'set', { view: { id: 'TL-V01', route: null, description: 'The tools.' } });
    expect(set.content[0].text).toBe('Changed view TL-V01: {"id":"TL-V01","title":"Catalog","description":"The tools."}\nWrote data/view.jsonl');
    const part = await callTool(root, 'set', { entity_field: { entity_id: 'TL-LEND-EN01', position: 1, example: '32' } });
    expect(part.isError).toBeUndefined();
    const parent = await callTool(root, 'set', { entity: { id: 'TL-LEND-EN01', aggregate_id: 'TL-LEND-A2' } });
    expect(parent.isError).toBe(true);
    expect(parent.content[0].text).toContain('aggregate_id places the record under its parent; use move [command]');
  });

  it('move, link and unlink return every changed row, or the refusal', async () => {
    const root = writeData(everyKind());
    const moved = await callTool(root, 'move', { id: 'TL-LEND-EP01', parent: 'TL-LEND-QRY01' });
    expect(moved.structuredContent?.changes).toEqual([
      expect.objectContaining({ change: 'changed', table: 'endpoint', key: 'TL-LEND-EP01', row: expect.objectContaining({ query_id: 'TL-LEND-QRY01' }) }),
    ]);
    expect((await callTool(root, 'move', { id: 'TL-LEND-EP01', parent: 'TL-LEND-A1' })).isError).toBe(true);
    const linked = await callTool(root, 'link', { source: 'TL-LEND-QRY01', relation: 'calls', target: 'TL-LEND-DS01' });
    expect(linked.content[0].text).toBe('Added link TL-LEND-QRY01 calls TL-LEND-DS01\nWrote data/calls.jsonl');
    expect((await callTool(root, 'link', { source: 'TL-LEND-QRY01', relation: 'calls', target: 'TL-LEND-DS01' })).isError).toBe(true);
    expect((await callTool(root, 'unlink', { source: 'TL-LEND-QRY01', relation: 'calls', target: 'TL-LEND-DS01' })).content[0].text).toBe(
      'Removed link TL-LEND-QRY01 calls TL-LEND-DS01\nWrote data/calls.jsonl',
    );
    expect((await callTool(root, 'link', { source: 'TL-LEND-QRY01', relation: 'nope', target: 'TL-LEND-DS01' })).content[0].text).toContain('there is no relation nope');
    expect((await callTool(root, 'link', { source: 'TL-LEND-QRY01', relation: 'calls' })).content[0].text).toContain('target is a non-empty string');
  });

  it('remove takes a record by its ID or a part by its key, and is refused while referenced', async () => {
    const root = writeData(everyKind());
    const referenced = await callTool(root, 'remove', { id: 'TL-INT01' });
    expect(referenced.isError).toBe(true);
    expect(referenced.content[0].text).toContain('integration TL-INT01 is referenced, so it stays');
    await callTool(root, 'unlink', { source: 'TL-LEND-UC01-FL01-S01', relation: 'exchanges_with', target: 'TL-INT01' });
    await callTool(root, 'remove', { id: 'TL-INT01-AD' });
    await callTool(root, 'remove', { id: 'TL-INT01-T01' });
    expect((await callTool(root, 'remove', { id: 'TL-INT01' })).structuredContent?.changes).toEqual([expect.objectContaining({ change: 'removed', table: 'integration', key: 'TL-INT01' })]);
    const part = await callTool(root, 'remove', { use_case_actor: { use_case_id: 'TL-LEND-UC01', position: 1 } });
    expect(part.content[0].text).toContain('Removed use_case_actor use_case_id TL-LEND-UC01, position 1');
  }, 20_000);

  it('show, list and next_id read the data', async () => {
    const root = writeData(everyKind());
    const shown = await callTool(root, 'show', { id: 'TL-LEND-EN01' });
    expect(shown.structuredContent).toMatchObject({
      kind: 'entity',
      parent: 'TL-LEND-A1',
      scope: { product: 'TL', domain: 'TL-LEND', aggregate: 'TL-LEND-A1' },
      parts: [{ table: 'entity_field', rows: [expect.objectContaining({ name: 'Loan ID' }), expect.anything(), expect.anything()] }],
      links: expect.arrayContaining([{ relation: 'has_many', label: 'Has many', direction: 'out', id: 'TL-LEND-EN02', title: 'Return' }]),
    });
    expect(shown.content[0].text).toContain('Entity TL-LEND-EN01: Loan');
    expect((await callTool(root, 'show', { id: 'TL-V01' })).structuredContent).toMatchObject({ parent: null, scope: { product: 'TL', domain: 'TL-LEND' } });
    expect((await callTool(root, 'show', { id: 'TL-NOPE' })).isError).toBe(true);
    const listed = await callTool(root, 'list', { table: 'invariant', parent: 'TL-LEND-A1' });
    expect(listed.structuredContent).toEqual({ rows: [expect.objectContaining({ id: 'TL-LEND-INV01' })] });
    expect(listed.content[0].text).toBe('TL-LEND-INV01  One active loan per tool');
    expect((await callTool(root, 'next_id', { kind: 'invariant', parent: 'TL-LEND-A2' })).structuredContent).toEqual({ id: 'TL-LEND-INV02' });
    expect((await callTool(root, 'next_id', { kind: 'value_object', parent: 'TL' })).structuredContent).toEqual({ id: 'TL-VO02' });
    expect((await callTool(root, 'next_id', { kind: 'invariant', parent: 'TL-LEND-UC01' })).isError).toBe(true);
  });

  it('check reports the errors and warnings with a count, and each product\'s coverage with its gaps as lathe check --json gives it', async () => {
    const root = writeData(everyKind());
    const checked = await callTool(root, 'check', {});
    const [{ workspace }] = await loadProducts(root);
    expect(checked.structuredContent).toEqual({
      errors: expect.any(Number),
      warnings: expect.any(Number),
      problems: expect.any(Array),
      exceptions: [
        { command: 'TL-LEND-CMD01', aggregate: 'TL-LEND-A2', reason: 'The tool must never show as lent without its loan.' },
        { repository: 'TL-LEND-REPO01', aggregate: 'TL-LEND-A2', reason: 'Loans and tools are kept in one store.' },
      ],
      products: [{ root: '.', coverage: workspace.coverage }],
    });
    expect(workspace.coverage.flatMap((c) => c.gaps).length).toBeGreaterThan(0);
    expect(checked.content[0].text).toContain(
      'Recorded exceptions (2):\n  TL-LEND-CMD01 also changes aggregate TL-LEND-A2 in the same transaction: The tool must never show as lent without its loan.\n' +
        '  TL-LEND-REPO01 also persists aggregate TL-LEND-A2: Loans and tools are kept in one store.',
    );
    expect(checked.content[0].text).toMatch(/\n\nCoverage:\n {2}TL-LEND [^\n]+: \d+\/\d+ designed/);
    expect(checked.content[0].text).toMatch(/\d+ errors?, \d+ warnings?\.$/);
    expect(checked.isError).toBe((checked.structuredContent!.errors as number) > 0);
  });

  it('refuses an unknown tool', async () => {
    const root = writeData(everyKind());
    expect(await callTool(root, 'format', {})).toMatchObject({ isError: true, content: [{ type: 'text', text: 'Refused; nothing changed: there is no tool format.' }] });
  });
});

describe('the server', () => {
  it('LA-INT01-T02 answers initialize, tools/list and tools/call over stdio, and says when the tools change', async () => {
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
    send({ id: 3, method: 'tools/call', params: { name: 'add', arguments: { view: { id: 'TL-V02', title: 'Desk', description: 'The desk where tools go out.' } } } });
    send({
      id: 4,
      method: 'tools/call',
      params: { name: 'add', arguments: { product_kind: { name: 'report', product_id: 'TL', label: 'Report', description: 'A report.', parent_kind: 'domain', obligation: false, id_pattern: '<domain>-RPT<nn>' } } },
    });
    send({ id: 5, method: 'tools/list' });
    send({ id: 6, method: 'nope' });
    input.write('not json\n');
    input.end();
    await served;

    const messages = received.trim().split('\n').map((l) => JSON.parse(l));
    const byId = (id: number) => messages.find((m) => m.id === id);
    expect(byId(1).result).toMatchObject({ protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: true } }, serverInfo: { name: 'lathe' } });
    expect(byId(2).result.tools.map((t: Tool) => t.name)).toContain('add');
    expect(byId(3).result.content[0].text).toContain('Added view TL-V02');
    expect(byId(4).result.isError).toBeUndefined();
    expect(messages).toContainEqual({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' });
    expect(Object.keys(byId(5).result.tools[0].inputSchema.properties)).toContain('report');
    expect(byId(6).error).toEqual({ code: -32601, message: 'Method not found: nope' });
    expect(messages).toContainEqual({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    expect(messages.filter((m) => m.id === undefined).length).toBe(1);
    expect(readFileSync(path.join(root, 'data', 'view.jsonl'), 'utf8')).toContain('TL-V02');
  });

  it('LA-PLT-UC17-R01-T02 for a product whose data is for another schema, offers only check, and every tool says what to do', async () => {
    const root = writeData(everyKind());
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ schema: SCHEMA_VERSION + 1 }));
    const message = `This product's data is for schema ${SCHEMA_VERSION + 1}; this Lathe uses schema ${SCHEMA_VERSION}. It needs a newer Lathe: update @jaredrob/lathe.`;
    const input = new PassThrough();
    const output = new PassThrough();
    let received = '';
    output.on('data', (chunk) => (received += chunk));
    const served = serveMcp(root, input, output);
    const send = (message: object) => input.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
    send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {} } });
    send({ id: 2, method: 'tools/list' });
    send({ id: 3, method: 'tools/call', params: { name: 'check', arguments: {} } });
    send({ id: 4, method: 'tools/call', params: { name: 'show', arguments: { id: 'TL' } } });
    input.end();
    await served;
    const byId = (id: number) => received.trim().split('\n').map((l) => JSON.parse(l)).find((m) => m.id === id);
    expect(byId(1).result.instructions).toMatch(new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} Until then, only the check tool runs`));
    expect(byId(2).result.tools.map((t: Tool) => t.name)).toEqual(['check']);
    for (const id of [3, 4]) expect(byId(id).result).toEqual({ content: [{ type: 'text', text: message }], structuredContent: { refused: true, problems: [{ rule: 'schema-version', message }] }, isError: true });
  });
});
