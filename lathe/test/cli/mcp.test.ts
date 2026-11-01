// The MCP server's tools: one per aggregate command and query and the check, their input schemas from the schema's
// columns, and the JSON-RPC exchange over stdio that Claude Code holds with `lathe mcp`.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { loadProducts, openStore, SCHEMA_VERSION } from '../../src/index.ts';
import { callTool, serveMcp, tools, VIEW_ONLY_REFUSAL, type Tool } from '../../src/cli/mcp.ts';
import { ALL_COMMANDS, ALL_QUERIES } from '../../src/commands.ts';
import { toolName } from '../../src/platform/commands/definition.ts';
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
  it('LA-INT01-T04 are the check, then one per aggregate command and query, each named for it, with no generic verb', async () => {
    const all = tools(await schemaOf(writeData(everyKind())));
    expect(all.map((t) => t.name)).toEqual(['check', ...[...ALL_COMMANDS, ...ALL_QUERIES].map(toolName)]);
    for (const verb of ['add', 'set', 'move', 'link', 'unlink', 'remove', 'show', 'list', 'next_id']) expect(all.map((t) => t.name)).not.toContain(verb);
    // A command's input schema reads its fields' types from the schema's columns.
    const addView = tool(all, 'view_add_view').inputSchema as unknown as Schema;
    expect(addView.required).toEqual(['id', 'title', 'description']);
    expect(addView.properties.title.description).toBeTruthy();
  });

  it('LA-INT01-T05 check reports the errors and warnings with a count, and each product\'s coverage with its gaps as lathe check --json gives it', async () => {
    const root = writeData(everyKind());
    const checked = await callTool(root, 'check', {});
    const [{ workspace }] = await loadProducts(root);
    expect(checked.structuredContent).toEqual({
      errors: expect.any(Number),
      warnings: expect.any(Number),
      problems: expect.any(Array),
      products: [{ root: '.', coverage: workspace.coverage }],
    });
    expect(workspace.coverage.flatMap((c) => c.gaps).length).toBeGreaterThan(0);
    expect(checked.content[0].text).not.toContain('exception');
    expect(checked.content[0].text).toMatch(/\n\nCoverage:\n {2}TL-LEND [^\n]+: \d+\/\d+ designed/);
    expect(checked.content[0].text).toMatch(/\d+ errors?, \d+ warnings?\.$/);
    expect(checked.isError).toBe((checked.structuredContent!.errors as number) > 0);
  });

  it('LA-INT01-T06 refuses an unknown tool', async () => {
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
    send({ id: 3, method: 'tools/call', params: { name: 'view_add_view', arguments: { id: 'TL-V02', title: 'Desk', description: 'The desk where tools go out.' } } });
    send({
      id: 4,
      method: 'tools/call',
      params: { name: 'product_declare_product_kind', arguments: { name: 'report', product_id: 'TL', label: 'Report', description: 'A report.', parent_kind: 'domain', stage: 'use-cases', obligation: false, complexity: 'essential', id_pattern: '<domain>-RPT<nn>' } },
    });
    send({ id: 5, method: 'tools/list' });
    send({ id: 6, method: 'nope' });
    input.write('not json\n');
    input.end();
    await served;

    const messages = received.trim().split('\n').map((l) => JSON.parse(l));
    const byId = (id: number) => messages.find((m) => m.id === id);
    expect(byId(1).result).toMatchObject({ protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: true } }, serverInfo: { name: 'lathe' } });
    expect(byId(2).result.tools.map((t: Tool) => t.name)).toContain('view_add_view');
    expect(byId(3).result.content[0].text).toContain('Added view TL-V02');
    expect(byId(4).result.isError).toBeUndefined();
    expect(messages).toContainEqual({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' });
    expect(byId(5).result.tools.map((t: Tool) => t.name)).toContain('extension_record_add_extension_record');
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
    send({ id: 4, method: 'tools/call', params: { name: 'product_get_product', arguments: { id: 'TL' } } });
    input.end();
    await served;
    const byId = (id: number) => received.trim().split('\n').map((l) => JSON.parse(l)).find((m) => m.id === id);
    expect(byId(1).result.instructions).toMatch(new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} Until then, only the check tool runs`));
    expect(byId(2).result.tools.map((t: Tool) => t.name)).toEqual(['check']);
    for (const id of [3, 4]) expect(byId(id).result).toEqual({ content: [{ type: 'text', text: message }], structuredContent: { refused: true, problems: [{ rule: 'schema-version', message }] }, isError: true });
  });
});

/** Serves the tools over streams, sends the messages, and gives each answer by its ID. */
async function exchange(root: string, messages: object[], app: Parameters<typeof serveMcp>[3], viewOnly: boolean) {
  const input = new PassThrough();
  const output = new PassThrough();
  let received = '';
  output.on('data', (chunk) => (received += chunk));
  const served = serveMcp(root, input, output, app, viewOnly);
  for (const message of messages) input.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
  input.end();
  await served;
  const all = received.trim().split('\n').map((l) => JSON.parse(l));
  return (id: number) => all.find((m) => m.id === id);
}

describe('LA-PLT-UC19-R09-T02 In View only, the server lists only the reads and refuses every command', () => {
  it('marks every query and the check read only, lists only them in View only, and refuses a command there, changing nothing', async () => {
    const root = writeData(everyKind());
    const all = tools(await schemaOf(root));
    expect(all.filter((t) => t.annotations?.readOnlyHint).map((t) => t.name)).toEqual(['check', ...ALL_QUERIES.map(toolName)]);
    expect(tools(await schemaOf(root), true).map((t) => t.name)).toEqual(['check', ...ALL_QUERIES.map(toolName)]);
    const before = readFileSync(path.join(root, 'data', 'view.jsonl'), 'utf8');
    const answer = await exchange(root, [
      { id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {} } },
      { id: 2, method: 'tools/list' },
      { id: 3, method: 'tools/call', params: { name: 'view_add_view', arguments: { id: 'TL-V09', title: 'Desk', description: 'The desk.' } } },
      { id: 4, method: 'tools/call', params: { name: 'product_get_product', arguments: { id: 'TL' } } },
    ], null, true);
    expect(answer(1).result.instructions).toContain('This chat is View only');
    expect(answer(2).result.tools.map((t: Tool) => t.name)).not.toContain('view_add_view');
    expect(answer(3).result).toEqual({ content: [{ type: 'text', text: VIEW_ONLY_REFUSAL }], structuredContent: { refused: true, problems: [{ rule: 'view-only', message: VIEW_ONLY_REFUSAL }] }, isError: true });
    expect(answer(4).result.isError).toBeUndefined();
    expect(readFileSync(path.join(root, 'data', 'view.jsonl'), 'utf8')).toBe(before);
  });
});

describe('LA-PLT-UC19-R12-T02 Under the desktop chat, the server tells Claude to use the app tools for the window', () => {
  it('says so in its instructions only with an app window, and marks app_focus read only', async () => {
    const root = writeData(everyKind());
    const init = [{ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {} } }, { id: 2, method: 'tools/list' }];
    const withApp = await exchange(root, init, { url: 'http://127.0.0.1:1/windows/w', token: 't' }, false);
    expect(withApp(1).result.instructions).toContain('use them for anything about the window; never search the code or the files to find what the window shows.'.replace('use', 'Use'));
    expect(withApp(2).result.tools.find((t: Tool) => t.name === 'app_focus').annotations).toEqual({ readOnlyHint: true });
    const alone = await exchange(root, init, null, false);
    expect(alone(1).result.instructions).not.toContain('app_focus');
  });
});

