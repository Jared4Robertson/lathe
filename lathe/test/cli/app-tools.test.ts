// The MCP server's app tools against a stand-in for the desktop app's bridge (desktop/src/bridge.ts).
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PassThrough } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appBridgeFromEnv, focusText, type AppBridge } from '../../src/cli/app-tools.ts';
import { callTool, serveMcp, type Tool } from '../../src/cli/mcp.ts';
import { everyKind, removeData, writeData } from '../store/fixture.ts';

const TOKEN = 'secret';
const opened: unknown[] = [];
let server: Server;
let base: string;
const page = { path: '/TL-LEND-UC01', product: 'TL', stage: 'graph', focus: { id: 'TL-LEND-UC01', kind: 'use_case', title: 'Borrow a tool' }, selected: { id: 'TL-LEND', kind: 'domain', title: 'Lending' }, wikiCard: true };

beforeAll(async () => {
  server = createServer((req, res) => {
    const send = (status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'token' });
    if (req.url === '/windows/open-window/focus') return send(200, { connected: true, page });
    if (req.url === '/windows/open-window/open') {
      let text = '';
      req.on('data', (c) => (text += c));
      req.on('end', () => {
        const request = JSON.parse(text) as { id: string };
        opened.push(request);
        send(200, request.id === 'TL-LEND-UC01' ? { ok: true, message: 'Opened TL-LEND-UC01 on the graph stage.' } : { ok: false, message: `There is no record ${request.id} in this window.` });
      });
      return;
    }
    send(404, { error: 'That window has closed.' });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/windows`;
});
afterAll(() => {
  server.close();
  removeData();
});

const app = (window: string): AppBridge => ({ url: `${base}/${window}`, token: TOKEN });

describe('LA-PLT-UC19-R06-T01 Claude asks what the Reader is looking at and opens a record, only with an app window connected', () => {
  it('lists the app tools only under the desktop app\'s chat', async () => {
    const root = writeData(everyKind());
    const list = async (bridge: AppBridge | null) => {
      const input = new PassThrough();
      const output = new PassThrough();
      let received = '';
      output.on('data', (c) => (received += c));
      const served = serveMcp(root, input, output, bridge);
      input.end(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })}\n`);
      await served;
      return (JSON.parse(received.trim()).result.tools as Tool[]).map((t) => t.name);
    };
    expect(await list(null)).not.toContain('app_focus');
    expect((await list(app('open-window'))).slice(-2)).toEqual(['app_focus', 'app_open']);
  });

  it('reads the bridge from the environment the desktop app gives the CLI', () => {
    expect(appBridgeFromEnv({ LATHE_APP_BRIDGE: 'http://127.0.0.1:5/windows/a', LATHE_APP_TOKEN: 't' })).toEqual({ url: 'http://127.0.0.1:5/windows/a', token: 't' });
    expect(appBridgeFromEnv({ LATHE_APP_BRIDGE: 'http://example.com/windows/a', LATHE_APP_TOKEN: 't' })).toBeNull();
    expect(appBridgeFromEnv({})).toBeNull();
  });

  it('says what the Reader is looking at', async () => {
    const result = await callTool('/unused', 'app_focus', {}, app('open-window'));
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('The Reader is looking at TL-LEND-UC01 (use_case): Borrow a tool, on the graph stage.\nSelected: TL-LEND (domain): Lending.\nProduct: TL.\nPage: /TL-LEND-UC01');
    expect(result.structuredContent).toMatchObject({ page: { focus: { id: 'TL-LEND-UC01' } } });
    expect(focusText({ page: null })).toBe('The window shows no page yet.');
  });

  it('opens a record in the window, and passes on a refusal', async () => {
    const result = await callTool('/unused', 'app_open', { id: 'TL-LEND-UC01', stage: 'graph' }, app('open-window'));
    expect(result).toMatchObject({ content: [{ text: 'Opened TL-LEND-UC01 on the graph stage.' }], structuredContent: { opened: 'TL-LEND-UC01' } });
    expect(opened.at(-1)).toEqual({ id: 'TL-LEND-UC01', stage: 'graph' });
    const missing = await callTool('/unused', 'app_open', { id: 'TL-NOPE' }, app('open-window'));
    expect(missing).toMatchObject({ isError: true, content: [{ text: 'There is no record TL-NOPE in this window.' }] });
    expect((await callTool('/unused', 'app_open', { id: 'X', stage: 'map' }, app('open-window'))).isError).toBe(true);
  });

  it('refuses when no app window is connected, or it has closed', async () => {
    for (const bridge of [null, app('closed-window'), { url: 'http://127.0.0.1:9/windows/x', token: TOKEN }, { ...app('open-window'), token: 'wrong' }]) {
      const result = await callTool('/unused', 'app_focus', {}, bridge);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No Lathe app window is connected');
    }
  });
});
