// Platform's flows that run through code, the CLI and the server, end to end along their main paths: loading the
// workspace from a script (LA-PLT-UC01), setting Lathe up in a product repo (LA-PLT-UC02) and changing the data
// through each aggregate's own commands (LA-PLT-UC16). `lathe serve` needs the built web app: when lathe/dist/app is missing,
// the app's own Vite builds it there, as the package's build does. It is skipped, with a message, only when the app's
// packages are not installed (app/node_modules).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, openStore, PACKAGE_DIR, SCHEMA_VERSION, type LoadTimings } from '../../src/index.ts';
import type { WriteAnswer } from '../../src/server/contract.ts';
import { summariesIn, type RecordSummaries } from '../../src/exploring/record-summaries/read-model.ts';
import { WRITE_BODY_LIMIT } from '../../src/server/api.ts';
import { APP_DIR } from '../../src/server/serve.ts';
import { build, complete, removeData, run } from '../helpers.ts';

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'lathe.ts');
const APP_SOURCE = path.join(PACKAGE_DIR, '..', 'app');
const VITE = path.join(APP_SOURCE, 'node_modules', '.bin', 'vite');
const appBuilt = () => existsSync(path.join(APP_DIR, 'index.html'));
const canServe = appBuilt() || existsSync(VITE);
if (!canServe) {
  console.warn(`Skipping the lathe serve flows: ${APP_DIR} is missing and ${APP_SOURCE}/node_modules is not installed. Run \`npm --prefix lathe run build\` to run them.`);
}

const temps: string[] = [];
const children = new Set<ChildProcess>();
const temp = (prefix: string) => {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
};

beforeAll(() => {
  if (canServe && !appBuilt()) {
    const built = spawnSync(VITE, ['build', '--outDir', APP_DIR, '--emptyOutDir', '--logLevel', 'error'], { cwd: APP_SOURCE, encoding: 'utf8' });
    if (built.status !== 0) throw new Error(`Building the app failed:\n${built.stderr}`);
  }
}, 180_000);

afterAll(async () => {
  for (const child of children) await stop(child);
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
  removeData();
}, 60_000);

/** Runs the real `lathe` command in a product repo. */
function lathe(root: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [bin, ...args, '--root', root], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}
/** Runs `lathe` and expects it to succeed quietly on stderr. */
function ok(root: string, ...args: string[]) {
  const result = lathe(root, ...args);
  expect(result.stderr, args.join(' ')).toBe('');
  expect(result.status, args.join(' ')).toBe(0);
  return result.stdout;
}
const git = (root: string, ...args: string[]) => {
  const result = spawnSync('git', ['-c', 'user.name=Lathe Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], { cwd: root, encoding: 'utf8' });
  expect(result.status, `git ${args.join(' ')}: ${result.stderr}`).toBe(0);
  return result.stdout;
};
const files = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).sort().map((f) => [f, readFileSync(path.join(root, 'data', f), 'utf8')]));

/** A free TCP port, never 5199 (the Owner's own dev server). */
async function freePort(): Promise<number> {
  for (;;) {
    const port = await new Promise<number>((resolve, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const p = typeof address === 'object' && address ? address.port : 0;
        server.close(() => resolve(p));
      });
    });
    if (port !== 5199 && port > 0) return port;
  }
}

const exited = (child: ChildProcess, ms: number) =>
  new Promise<boolean>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve(true);
    const timer = setTimeout(() => resolve(false), ms);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });

/** Stops a server this file started: SIGINT, as Ctrl+C in a terminal, then SIGKILL only if it will not stop. */
async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGINT');
  if (!(await exited(child, 15_000))) {
    child.kill('SIGKILL');
    await exited(child, 5_000);
  }
  children.delete(child);
}

/** Starts the real `lathe serve` on a free port and waits until it says it is serving. */
async function serveCli(root: string): Promise<{ child: ChildProcess; base: string; output: () => string }> {
  const port = await freePort();
  const child = spawn(process.execPath, [bin, 'serve', '--port', String(port), '--root', root], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  let output = '';
  child.stdout!.setEncoding('utf8').on('data', (s: string) => (output += s));
  child.stderr!.setEncoding('utf8').on('data', (s: string) => (output += s));
  const deadline = Date.now() + 30_000;
  while (!output.includes('Lathe is serving') && Date.now() < deadline && child.exitCode === null) await new Promise((r) => setTimeout(r, 100));
  expect(output).toContain(`Lathe is serving ${root} at http://127.0.0.1:${port}`);
  return { child, base: `http://127.0.0.1:${port}`, output: () => output };
}

/** Reads the server's event stream until `wanted` appears, or gives up after the timeout. */
async function eventsUntil(response: Response, wanted: string, timeoutMs: number): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  const deadline = Date.now() + timeoutMs;
  try {
    while (!text.includes(wanted) && Date.now() < deadline) {
      const chunk = await Promise.race([
        reader.read(),
        new Promise<{ done: true; value: undefined }>((resolve) => setTimeout(() => resolve({ done: true, value: undefined }), deadline - Date.now())),
      ]);
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return text;
}

describe('Platform flows', () => {
  it('LA-PLT-UC01-FL-T LA-PAT-PACKAGE-STEPS-R01-T01 LA-PAT-PACKAGE-STEPS-R02-T01 an Agent\'s script loads the workspace, sees refused data as data-refused errors, and loads again after a write', async () => {
    // A product with a record of nearly every kind, every obligation designed, built and proved.
    const root = await build(complete());

    // The script loads it and reads the records, links, problems and coverage.
    const ws = await loadWorkspace(root);
    expect(ws.records.map((r) => r.id)).toEqual(expect.arrayContaining(['EX', 'EX-LEND', 'EX-LEND-A1', 'EX-LEND-UC01', 'EX-LEND-UC01-FL']));
    expect(ws.links.length).toBeGreaterThan(0);
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(ws.coverage.map((c) => c.domain)).toContain('EX-LEND');

    // Data the store refuses ends the load: one data-refused error per refusal, and no records.
    const file = path.join(root, 'data', 'use_case.jsonl');
    const good = readFileSync(file, 'utf8');
    writeFileSync(file, `${good}{"id":"EX-LEND-UC09","title":"Lost","capability_id":"EX-LEND-CAP09","goal":"A member finds the lost tool."}\n`);
    const refused = await loadWorkspace(root);
    expect(refused.records).toEqual([]);
    expect(refused.problems.length).toBeGreaterThan(0);
    expect(refused.problems.every((p) => p.check === 'data-refused' && p.severity === 'error')).toBe(true);
    expect(refused.problems.map((p) => p.message).join('\n')).toContain('EX-LEND-CAP09');
    writeFileSync(file, good);

    // After a write through the Use case aggregate's own command, the next load sees it. Its timings are what the performance budgets
    // judge (LA-PLT-UC01-R03, `npm --prefix lathe run test:perf`); here they are only taken.
    const store = await openStore(root);
    try {
      await run(store, 'use-case change-use-case', { id: 'EX-LEND-UC01', title: 'Borrow a tool at the desk' });
    } finally {
      await store.close();
    }
    const timings: Partial<LoadTimings> = {};
    const again = await loadWorkspace(root, { timings });
    expect(again.records.find((r) => r.id === 'EX-LEND-UC01')?.title).toBe('Borrow a tool at the desk');
    expect(timings.total).toBeGreaterThan(0);
  }, 120_000);

  it.skipIf(!canServe)('LA-PLT-UC02-FL-T the Owner sets Lathe up in a product repo: init, the merge driver, the first records, serve and stop', async () => {
    const root = temp('lathe-setup-');
    git(root, 'init', '-q');

    // lathe init writes the config and the product record.
    const init = ok(root, 'init', '--name', 'Tool Library', '--prefix', 'TL');
    expect(init).toContain('Wrote lathe.config.json');
    expect(JSON.parse(readFileSync(path.join(root, 'lathe.config.json'), 'utf8'))).toEqual({ schema: SCHEMA_VERSION, data: 'data' });
    expect(readFileSync(path.join(root, 'data', 'product.jsonl'), 'utf8')).toContain('"id":"TL","title":"Tool Library"');

    // The merge driver, once per clone, as the README says: git then merges the data files through it.
    writeFileSync(path.join(root, '.gitattributes'), '**/data/*.jsonl merge=lathe-data\n');
    git(root, 'config', 'merge.lathe-data.name', 'Lathe data files');
    git(root, 'config', 'merge.lathe-data.driver', `node ${bin} merge-data %O %A %B %P`);
    expect(git(root, 'check-attr', 'merge', 'data/domain.jsonl').trim()).toBe('data/domain.jsonl: merge: lathe-data');

    // The first domain and records, with the aggregates' own commands, in the data folder the config names.
    ok(root, 'domain', 'add-domain', '--id', 'TL-LEND', '--title', 'Lending', '--product_id', 'TL', '--subdomain_type', 'core', '--description', 'Lending tools to members and getting them back.');
    ok(root, 'aggregate', 'add-aggregate', '--id', 'TL-LEND-A1', '--title', 'Loan', '--domain_id', 'TL-LEND', '--identity', 'Loan ID', '--description', 'One tool lent to one member.');
    expect(Object.keys(files(root))).toEqual(['aggregate.jsonl', 'domain.jsonl', 'product.jsonl']);
    expect(lathe(root, 'check').status).toBe(0);

    // lathe serve: the app and its reads, with no build tools in the product repo.
    expect(existsSync(path.join(root, 'package.json'))).toBe(false);
    const { child, base } = await serveCli(root);
    const page = await fetch(`${base}/`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<div id="root">');
    const summaries = (await (await fetch(`${base}/api/record-summaries/list-record-summaries?product_id=TL`)).json()) as RecordSummaries;
    expect(summariesIn(summaries).filter((r) => r.kind === 'aggregate').map((r) => r.id)).toEqual(['TL-LEND-A1']);

    // Stopped from the terminal, it closes the database and ends by the same signal, cleanly.
    child.kill('SIGINT');
    expect(await exited(child, 15_000)).toBe(true);
    children.delete(child);
    expect(child.signalCode).toBe('SIGINT');
  }, 120_000);

  it.skipIf(!canServe)('LA-PLT-UC16-FL-T LA-PAT-CLI-STEPS-R01-T03 LA-PAT-CLI-STEPS-R02-T03 LA-PAT-MCP-STEPS-R01-T03 LA-PAT-MCP-STEPS-R02-T03 LA-PAT-HTTP-STEPS-R01-T01 LA-PAT-HTTP-STEPS-R02-T01 every change is one command of its aggregate: the CLI, the MCP tools and POST /api/<aggregate>/<command>, refusals change nothing, open pages reload, and git merges row by row', async () => {
    const root = temp('lathe-layer-');
    git(root, 'init', '-q');
    writeFileSync(path.join(root, '.gitattributes'), '**/data/*.jsonl merge=lathe-data\n');
    git(root, 'config', 'merge.lathe-data.name', 'Lathe data files');
    git(root, 'config', 'merge.lathe-data.driver', `node ${bin} merge-data %O %A %B %P`);
    ok(root, 'init', '--name', 'Tool Library', '--prefix', 'TL');

    // The Owner runs Add a domain from the command line.
    ok(root, 'domain', 'add-domain', '--id', 'TL-LEND', '--title', 'Lending', '--product_id', 'TL', '--subdomain_type', 'core', '--description', 'Lending tools to members and getting them back.');

    // An Agent calls the plugin's MCP tools.
    const mcp = spawn(process.execPath, [bin, 'mcp', '--root', root], { stdio: ['pipe', 'pipe', 'pipe'] });
    children.add(mcp);
    let buffer = '';
    const waiting = new Map<number, (message: { result?: { isError?: boolean; content: { text: string }[] } }) => void>();
    mcp.stdout!.setEncoding('utf8').on('data', (chunk: string) => {
      buffer += chunk;
      for (let at = buffer.indexOf('\n'); at >= 0; at = buffer.indexOf('\n')) {
        const message = JSON.parse(buffer.slice(0, at));
        buffer = buffer.slice(at + 1);
        waiting.get(message.id)?.(message);
      }
    });
    let next = 0;
    const request = (method: string, params: object) =>
      new Promise<{ result?: { isError?: boolean; content: { text: string }[] } }>((resolve) => {
        const id = ++next;
        waiting.set(id, resolve);
        mcp.stdin!.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      });
    expect((await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } })).result).toBeDefined();
    const added = await request('tools/call', { name: 'aggregate_add_aggregate', arguments: { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', description: 'A loan of a tool.', identity: 'Loan ID' } });
    expect(added.result?.isError, added.result?.content[0].text).toBeUndefined();
    mcp.stdin!.end();
    await exited(mcp, 15_000);
    children.delete(mcp);
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'Lending');

    // The Owner saves an aggregate's editor: the page sends POST /api/aggregate/change-aggregate, and the open page hears
    // spec:changed naming what changed.
    const { base } = await serveCli(root);
    const events = await fetch(`${base}/api/events`);
    const post = (route: string, body: string, headers: Record<string, string> = {}) =>
      fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
    const saved = await post('/api/aggregate/change-aggregate', JSON.stringify({ id: 'TL-LEND-A1', description: 'One tool lent to one member.' }));
    expect(saved.status).toBe(200);
    expect((await saved.json()) as WriteAnswer).toMatchObject({ ok: true, tables: ['aggregate'] });
    // The page hears the write's change, naming the table it wrote, before the write is answered.
    expect(await eventsUntil(events, '"tables":["aggregate"]', 10_000)).toContain('event: spec:changed\ndata: {"tables":["aggregate"],');
    const reloaded = (await (await fetch(`${base}/api/aggregate/get-aggregate?id=TL-LEND-A1`)).json()) as { aggregate: { description: string } };
    expect(reloaded.aggregate.description).toBe('One tool lent to one member.');

    // Refused before the store sees it: another site's write, a body not sent as JSON, a body over the limit.
    const before = files(root);
    expect((await post('/api/aggregate/change-aggregate', '{"id":"TL-LEND-A1"}', { origin: 'http://elsewhere.example' })).status).toBe(403);
    expect((await fetch(`${base}/api/aggregate/change-aggregate`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })).status).toBe(415);
    expect((await post('/api/aggregate/change-aggregate', JSON.stringify({ id: 'TL-LEND-A1', description: 'x'.repeat(WRITE_BODY_LIMIT + 1) }))).status).toBe(413);
    // No route writes whatever table it is given.
    expect((await post('/api/write', JSON.stringify({ commands: [] }))).status).toBe(404);

    // The store refuses a write that breaks a rule, with every reason, and no file changes.
    const broken = await post('/api/aggregate/add-aggregate', JSON.stringify({ id: 'TL-LEND-A2', title: 'Lost', domain_id: 'TL-NONE', description: 'A tool no one can find.', identity: 'Tool ID' }));
    expect(broken.status).toBe(422);
    const refusal = (await broken.json()) as WriteAnswer;
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) expect(refusal.problems.map((p) => p.message).join('\n')).toContain('TL-NONE');
    expect(files(root)).toEqual(before);
    git(root, 'commit', '-q', '-am', 'Describe the loan');

    // Reviewed and committed in git: two branches each add an aggregate, and git merges the file row by row.
    git(root, 'checkout', '-q', '-b', 'tools');
    ok(root, 'aggregate', 'add-aggregate', '--id', 'TL-LEND-A2', '--title', 'Tool', '--domain_id', 'TL-LEND', '--identity', 'Tool ID', '--description', 'A tool the library holds.');
    git(root, 'commit', '-q', '-am', 'Tools');
    git(root, 'checkout', '-q', 'main');
    ok(root, 'aggregate', 'add-aggregate', '--id', 'TL-LEND-A3', '--title', 'Member', '--domain_id', 'TL-LEND', '--identity', 'Member ID', '--description', 'A member of the library.');
    git(root, 'commit', '-q', '-am', 'Members');
    git(root, 'merge', '-q', '--no-edit', 'tools');
    expect(readFileSync(path.join(root, 'data', 'aggregate.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id)).toEqual(['TL-LEND-A1', 'TL-LEND-A2', 'TL-LEND-A3']);
    expect(lathe(root, 'check').status).toBe(0);
  }, 180_000);
});
