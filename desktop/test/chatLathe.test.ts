// The Lathe a window's chat brings (chatLathe.ts): the plugin of the Lathe the window runs, its MCP server running that
// same Lathe, and, with View only on, only its reads; the real plugin and Lathe from this repo, on a small product.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { claudeEnv } from '../src/chat.ts';
import { appPluginDir, chatLatheFor, countLatheTools, sourceLathe, withLatheCli } from '../src/chatLathe.ts';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const temp = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'lathe-chat-lathe-')));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

/** A product folder with its config and one product, and no Lathe of its own. */
function product(): string {
  const root = mkdtempSync(path.join(temp, 'product-'));
  const { schema } = JSON.parse(readFileSync(path.join(repo, 'lathe', 'schema', 'version.json'), 'utf8')) as { schema: number };
  writeFileSync(path.join(root, 'lathe.config.json'), `${JSON.stringify({ schema })}\n`);
  mkdirSync(path.join(root, 'data'));
  writeFileSync(path.join(root, 'data', 'product.jsonl'), '{"id":"TL","title":"Tool Library","description":"A neighborhood tool library."}\n');
  return root;
}

/** Asks the plugin's MCP server, started as Claude Code starts it, for its tools, then calls one; the messages it answered. */
async function askServer(root: string, env: NodeJS.ProcessEnv, call: { name: string; arguments: object }) {
  const lathe = sourceLathe(repo);
  const server = spawn(process.execPath, [path.join(lathe.pluginDir, 'scripts', 'mcp-server.mjs')], { cwd: root, env: { ...withLatheCli(env, lathe), CLAUDE_PROJECT_DIR: root }, stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  server.stdout.on('data', (chunk) => (out += chunk));
  const send = (message: object) => server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
  send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {} } });
  send({ id: 2, method: 'tools/list' });
  send({ id: 3, method: 'tools/call', params: call });
  server.stdin.end();
  expect(await new Promise((resolve) => server.on('close', resolve))).toBe(0);
  const messages = out.trim().split('\n').map((l) => JSON.parse(l) as { id: number; result: { tools?: { name: string }[]; content?: { text: string }[]; isError?: boolean } });
  return (id: number) => messages.find((m) => m.id === id)!.result;
}

describe('LA-PLT-UC19-R08-T01 The chat loads the plugin of the Lathe the window runs, and its server runs that Lathe', () => {
  const exists = (files: string[]) => (file: string) => files.includes(file);
  const appPlugin = '/apps/Lathe.app/Contents/Resources/node_modules/@jaredrob/lathe/dist/plugin';

  it('takes the product\'s own Lathe\'s plugin and bin when it ships them, else the app\'s plugin with the product\'s bin', () => {
    const own = '/work/shop/node_modules/@jaredrob/lathe';
    const choice = { modulePath: `${own}/dist/src/server/serve.js`, source: 'product' as const, version: '2.1.0' };
    expect(chatLatheFor(choice, appPlugin, exists([`${own}/dist/plugin/.claude-plugin/plugin.json`, `${own}/dist/bin/lathe.js`]))).toEqual({ pluginDir: `${own}/dist/plugin`, cli: `${own}/dist/bin/lathe.js`, version: '2.1.0' });
    // A product's Lathe from before the package shipped the plugin: the app's plugin, still running the product's Lathe.
    expect(chatLatheFor(choice, appPlugin, exists([`${own}/dist/bin/lathe.js`]))).toEqual({ pluginDir: appPlugin, cli: `${own}/dist/bin/lathe.js`, version: '2.1.0' });
  });

  it('takes the app\'s plugin and its bundled Lathe for a product with none of its own, and the repo\'s from source in development', () => {
    const bundled = '/apps/Lathe.app/Contents/Resources/node_modules/@jaredrob/lathe';
    const choice = { modulePath: `${bundled}/dist/src/server/serve.js`, source: 'bundled' as const, version: '2.0.0' };
    expect(chatLatheFor(choice, appPlugin, exists([`${bundled}/dist/bin/lathe.js`]))).toEqual({ pluginDir: appPlugin, cli: `${bundled}/dist/bin/lathe.js`, version: '2.0.0' });
    expect(appPluginDir('/repo', { resourcesPath: '/apps/Lathe.app/Contents/Resources' })).toBe(appPlugin);
    expect(appPluginDir('/repo', null)).toBe('/repo/plugin');
    const source = sourceLathe(repo);
    expect(source).toEqual({ pluginDir: path.join(repo, 'plugin'), cli: path.join(repo, 'lathe', 'bin', 'lathe.ts'), version: expect.stringMatching(/^\d+\.\d+\.\d+/) });
    expect(withLatheCli({ PATH: '/bin' }, source)).toEqual({ PATH: '/bin', LATHE_CLI: source.cli });
  });

  it('runs the Lathe the window runs, though the product has none installed', async () => {
    const answer = await askServer(product(), claudeEnv(process.env, 'accept-reads'), { name: 'product_get_product', arguments: { id: 'TL' } });
    expect(answer(3).content?.[0].text).toBe('Product TL: Tool Library\n  description: A neighborhood tool library.');
  });
});

describe('LA-PLT-UC19-R09-T03 A View only session cannot call a command tool', () => {
  it('lists no command, and refuses one called anyway, changing nothing', async () => {
    const root = product();
    const before = readFileSync(path.join(root, 'data', 'product.jsonl'), 'utf8');
    const answer = await askServer(root, claudeEnv(process.env, 'view-only'), { name: 'product_change_product', arguments: { id: 'TL', title: 'Changed' } });
    const names = answer(2).tools!.map((t) => t.name);
    expect(names).toContain('product_get_product');
    expect(names).toContain('check');
    expect(names.filter((n) => /_(add|change|remove|move|follow|stop|declare)_/.test(n))).toEqual([]);
    expect(answer(3)).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('this chat is View only') }] });
    expect(readFileSync(path.join(root, 'data', 'product.jsonl'), 'utf8')).toBe(before);
  });
});

describe('LA-PLT-UC19-R10-T01 The chat counts the Lathe tools a session gets, or says why they did not load', () => {
  it('counts every tool, and fewer in View only', async () => {
    const root = product();
    const lathe = sourceLathe(repo);
    const env = withLatheCli(process.env, lathe);
    const all = await countLatheTools({ pluginDir: lathe.pluginDir, cwd: root, env: claudeEnv(env, 'accept-reads'), version: '2.0.0' });
    const viewOnly = await countLatheTools({ pluginDir: lathe.pluginDir, cwd: root, env: claudeEnv(env, 'view-only'), version: '2.0.0' });
    expect(all.lathe).toMatchObject({ status: 'loaded', version: '2.0.0', count: expect.any(Number) });
    expect(viewOnly.lathe).toMatchObject({ status: 'loaded', count: expect.any(Number) });
    if (all.lathe.status === 'loaded' && viewOnly.lathe.status === 'loaded') {
      expect(viewOnly.lathe.count).toBeLessThan(all.lathe.count);
      // The tools that only read, by the names Claude Code gives them: what Accept reads runs without asking.
      expect(all.reads).toContain('mcp__plugin_lathe_lathe__product_get_product');
      expect(all.reads).not.toContain('mcp__plugin_lathe_lathe__product_change_product');
      expect(viewOnly.reads).toHaveLength(viewOnly.lathe.count);
    }
  });

  it('says why when the server cannot start', async () => {
    const lathe = sourceLathe(repo);
    const failed = await countLatheTools({ pluginDir: lathe.pluginDir, cwd: temp, env: process.env, version: null });
    expect(failed).toEqual({ lathe: { status: 'failed', version: null, problem: expect.stringContaining('lathe.config.json') }, reads: [] });
  });
});
