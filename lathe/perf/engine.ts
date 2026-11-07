// LA-PLT-UC01-R03-T01 LA-PLT-UC01-R10-T01 LA-PLT-UC03-R05-T01: the engine's performance budgets (LA-PLT-UC01-R03,
// LA-PLT-UC01-R10, LA-PLT-UC03-R05), measured: `npm --prefix lathe run test:perf`.
//
// - Loading Lathe's own spec (a cold load: the data files read and loaded with every key and rule, then checked)
//   takes under 2 s.
// - Loading it again after one row changes takes under 500 ms.
// - A cold CLI command (`lathe use-case get-use-case --id <id>` on Lathe's spec, a fresh process with the schema cache and the files' validated-build stamp in place) takes
//   under 800 ms, from the process's start to its exit.
// - On the large product (lathe/perf/large-product.ts, about ten times Lathe's records), served as `lathe serve` serves
//   it: one edit (a use case retitled by an Agent in another process) is visible, the server having read the changed
//   file and the page having read again what the change names (the record summaries, the folder tree and the use
//   case's page), in under 500 ms from the file's change; so is one of the page's own writes (the use case retitled
//   through its command's route), from the request; the checks' run in the background is announced within 4 s of the
//   change; and a cold load with every check takes under 4 s.
// - The full check (`lathe check` in a fresh process on Lathe's own spec, about 7,000 records) takes under 20 s
//   (LA-CHK-A1-SR02-T01), from the process's start to its exit.
// It also measures the reference, without a budget.
//
// Timings mean nothing on a machine that is busy with other work, so when the one-minute load average is above
// PERF_MAX_LOAD (12 by default) it still measures and prints, but judges nothing and exits 3 ("not run: machine
// busy"). A budget is never loosened to make a busy run pass. Prints one line per measurement, with the load's
// phases, and exits 1 when a budget is missed. With --profile it also prints the steps of Lathe's live reload (the
// store's schema copy, reading the files, each table's insert, record_scope, each integrity query, each aggregate's rules, the commit, the
// file facts, the coverage tables and each check), and of the large product's reload, to find where the time goes.

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadavg, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReference, loadWorkspace, openStore, type LoadTimings } from '../src/index.ts';
import { closeEngine } from '../src/platform/data/store.ts';
import { CHANGE_USE_CASE } from '../src/use-cases/use-case/commands/change-use-case.ts';
import { runCommand } from '../src/platform/commands/run.ts';
import { closeStores, dataFilesChanged, handleApi, onDataChange } from '../src/server/api.ts';
import type { DataChange } from '../src/server/events.ts';
import { RELOAD_DELAY_MS } from '../src/server/serve.ts';
import { LARGE_PRODUCT, largeProduct } from './large-product.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');

export const ENGINE_BUDGETS = { loadMs: 2000, reloadMs: 500, cliMs: 800, checkMs: 20000 } as const;
/**
 * The large product's budgets (LA-PLT-UC03-R05). The edit's is the Owner's, and holds for the page's own writes too.
 * The others are set from measurements on the dev machine (2026-10-29): without its three slow parts (the
 * term-used-unlinked check, the Use case rules and the record summaries' sort) a cold load with every check took about
 * 2.5 s, and so did the checks' run.
 */
export const LARGE_BUDGETS = { editMs: 500, checksMs: 4000, loadMs: 4000 } as const;
const MAX_LOAD = Number(process.env.PERF_MAX_LOAD ?? 12);
const RUNS = 5;
const PROFILE = process.argv.includes('--profile');

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const phases = (t: Partial<LoadTimings>) => (['open', 'files', 'checks', 'coverage'] as const).map((p) => `${p} ${Math.round(t[p] ?? 0)}`).join(', ');

/** A copy of the repo in a temporary folder: its data, config, code and manifests. */
function copyOfRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-perf-'));
  // Every file git knows of (tracked, or new and not ignored), copied, as the app's suites copy the repo
  // (app/stability/copy.ts): the code and manifests the spec names are there, so `lathe check` finds what it finds here.
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: repo, maxBuffer: 64 * 1024 * 1024 })
    .toString().split('\0').filter(Boolean);
  for (const file of files) {
    const from = path.join(repo, file);
    if (existsSync(from) && lstatSync(from).isFile()) cpSync(from, path.join(root, file));
  }
  return root;
}

async function timedLoad(root: string) {
  const timings: Partial<LoadTimings> = {};
  const start = performance.now();
  const workspace = await loadWorkspace(root, { timings });
  return { ms: performance.now() - start, timings, records: workspace.records.length };
}

/** Changes one use case with Change a use case (its title, so the data file changes) and reloads, then puts the title back; the median of RUNS. */
async function reload(root: string) {
  const store = await openStore(root);
  const [first] = store.rows('use_case');
  await store.close();
  const runs: { ms: number; timings: Partial<LoadTimings> }[] = [];
  for (let i = 0; i < RUNS; i++) {
    const writer = await openStore(root);
    await runCommand(writer, CHANGE_USE_CASE, { id: String(first.id), title: `${first.title} ${i}` });
    await writer.close();
    runs.push(await timedLoad(root));
  }
  // The title put back, so the steps after it (the full check among them) see the spec as it is.
  const writer = await openStore(root);
  await runCommand(writer, CHANGE_USE_CASE, { id: String(first.id), title: String(first.title) });
  await writer.close();
  // The median run, with its own phases.
  return [...runs].sort((a, b) => a.ms - b.ms)[Math.floor(runs.length / 2)];
}

/**
 * A cold CLI command, as an Agent runs it: `lathe use-case get-use-case` in a fresh process, timed from its start to
 * its exit. The first run fills the schema cache and stamps the files' whole build, as any earlier command has on a working
 * machine; then the median of RUNS.
 */
function cliGetUseCase(root: string, id: string): number {
  const bin = path.join(here, '..', 'bin', 'lathe.ts');
  const once = () => {
    const start = performance.now();
    const run = spawnSync(process.execPath, [bin, 'use-case', 'get-use-case', '--id', id, '--root', root], { encoding: 'utf8' });
    if (run.status !== 0) throw new Error(`lathe use-case get-use-case --id ${id} failed: ${run.stderr}`);
    return performance.now() - start;
  };
  once();
  return median(Array.from({ length: RUNS }, once));
}

/** `lathe check` in a fresh process, timed from its start to its exit; one run, as it takes seconds. */
function cliCheck(root: string): number {
  const bin = path.join(here, '..', 'bin', 'lathe.ts');
  const start = performance.now();
  const run = spawnSync(process.execPath, [bin, 'check', '--root', root], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const ms = performance.now() - start;
  if (run.status !== 0) throw new Error(`lathe check failed (${run.status}): ${run.stderr}`);
  return ms;
}

/** The steps of a load, slowest first, with the totals of the inserts, integrity queries and checks. */
function profile(t: Partial<LoadTimings>): string {
  const steps = Object.entries(t.steps ?? {});
  const sum = (prefix: string) => steps.filter(([n]) => n.startsWith(prefix)).reduce((a, [, ms]) => a + ms, 0);
  const totals = ['insert ', 'integrity ', 'check '].map((p) => `  ${`${p.trim()} (all, summed)`.padEnd(48)} ${sum(p).toFixed(1).padStart(7)} ms`);
  const slowest = steps.sort((a, b) => b[1] - a[1]).filter(([, ms]) => ms >= 1).map(([n, ms]) => `  ${n.padEnd(48)} ${ms.toFixed(1).padStart(7)} ms`);
  return [...totals, ...slowest].join('\n');
}

/** A copy of the large product, to change, in a fresh folder. */
function copyOfLarge(source: string): string {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-perf-large-'));
  cpSync(source, root, { recursive: true });
  return root;
}

/**
 * The large product served as `lathe serve` serves it, with a page open on a use case: an Agent in another process
 * retitles a use case RUNS times. Each edit is timed from the file's change to the page having read again what the
 * change names (the watcher's wait included), and the checks' run from the file's change to its announcement. Medians.
 */
async function largeEdits(root: string): Promise<{ editMs: number; checksMs: number; writeMs: number; reads: string }> {
  const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const heard: { at: number; change: DataChange }[] = [];
  const stop = onDataChange(root, (change) => heard.push({ at: performance.now(), change }));
  const get = async (route: string) => {
    const res = await fetch(`${base}${route}`);
    if (!res.ok) throw new Error(`${route} answered ${res.status}: ${await res.text()}`);
    await res.arrayBuffer();
  };
  const useCase = `${LARGE_PRODUCT}-D001-UC01`;
  // What the page reads, by read model: the space's reads and the use case's own page.
  const reads: Record<string, string> = {
    'meta-model': '/api/meta-model/get-meta-model',
    'record-summaries': `/api/record-summaries/list-record-summaries?product_id=${LARGE_PRODUCT}`,
    'folder-tree': `/api/folder-tree/get-folder-tree?product_id=${LARGE_PRODUCT}`,
    'use-case': `/api/use-case/get-use-case?id=${useCase}`,
    problems: `/api/problems/list-problems?product_id=${LARGE_PRODUCT}`,
    coverage: `/api/coverage/get-coverage?product_id=${LARGE_PRODUCT}`,
  };
  const writer = await openStore(root);
  const edits: number[] = [];
  const checks: number[] = [];
  const writes: number[] = [];
  const reread = new Set<string>();
  // Waits for the checks' run that follows the change heard from `from` on.
  const checked = async (from: number) => {
    while (!heard.slice(from).some((h) => h.change.readModels?.includes('problems'))) await new Promise((resolve) => setTimeout(resolve, 10));
  };
  try {
    // The page opens: each read once (the problems wait for the first checks' run).
    for (const route of Object.values(reads)) await get(route);
    for (let i = 0; i < RUNS; i++) {
      await runCommand(writer, CHANGE_USE_CASE, { id: useCase, title: `Retitled use case ${i}` });
      const start = performance.now();
      const from = heard.length;
      await new Promise((resolve) => setTimeout(resolve, RELOAD_DELAY_MS));
      await dataFilesChanged(root);
      const change = heard.slice(from).find((h) => h.change.tables.length)?.change;
      if (!change) throw new Error('The edit was not announced.');
      const named = Object.keys(reads).filter((model) => change.readModels === null || change.readModels.includes(model));
      for (const model of named) reread.add(model);
      await Promise.all(named.map((model) => get(reads[model])));
      edits.push(performance.now() - start);
      await checked(from);
      checks.push(heard.slice(from).find((h) => h.change.readModels?.includes('problems'))!.at - start);
    }
    // The page's own writes: the use case retitled through its command's route, timed from the request to the page
    // having read again what the change names.
    for (let i = 0; i < RUNS; i++) {
      const from = heard.length;
      const start = performance.now();
      const res = await fetch(`${base}${CHANGE_USE_CASE.route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: useCase, title: `Retitled in the app ${i}` }) });
      if (!res.ok) throw new Error(`The write answered ${res.status}: ${await res.text()}`);
      await res.arrayBuffer();
      const change = heard.slice(from).find((h) => h.change.tables.length)?.change;
      if (!change) throw new Error('The write was not announced.');
      await Promise.all(Object.keys(reads).filter((model) => change.readModels === null || change.readModels.includes(model)).map((model) => get(reads[model])));
      writes.push(performance.now() - start);
      await checked(from);
    }
  } finally {
    stop();
    await writer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeStores(root);
  }
  return { editMs: median(edits), checksMs: median(checks), writeMs: median(writes), reads: [...reread].sort().join(', ') };
}

/** The steps of the large product's reload after one use case is retitled, slowest first. */
async function largeReloadSteps(root: string): Promise<string> {
  const steps: Record<string, number> = {};
  const store = await openStore(root, { steps });
  const writer = await openStore(root);
  try {
    await runCommand(writer, CHANGE_USE_CASE, { id: `${LARGE_PRODUCT}-D001-UC02`, title: 'Retitled for the profile' });
    for (const name of Object.keys(steps)) delete steps[name];
    await store.reload();
  } finally {
    await writer.close();
    await store.close();
  }
  return Object.entries(steps).sort((a, b) => b[1] - a[1]).map(([n, ms]) => `  ${n.padEnd(48)} ${ms.toFixed(1).padStart(7)} ms`).join('\n');
}

const before = loadavg()[0];
const busy = before > MAX_LOAD;
const lines: string[] = [];
const misses: string[] = [];
const judge = (name: string, ms: number, budget: number | null, detail: string) => {
  const verdict = budget === null ? 'measured' : busy ? 'not judged' : ms < budget ? 'ok' : 'OVER';
  if (verdict === 'OVER') misses.push(`${name}: ${Math.round(ms)} ms, budget ${budget} ms`);
  lines.push(`${name.padEnd(36)} ${String(Math.round(ms)).padStart(6)} ms  ${budget === null ? '' : `budget ${budget} ms  `}${verdict}  (${detail})`);
};

const lathe = copyOfRepo();
const large = copyOfLarge(await largeProduct());
try {
  const colds = [];
  for (let i = 0; i < 3; i++) colds.push(await timedLoad(lathe));
  const cold = colds.sort((a, b) => a.ms - b.ms)[1];
  judge(`Lathe's spec, cold load (${cold.records})`, cold.ms, ENGINE_BUDGETS.loadMs, phases(cold.timings));
  const live = await reload(lathe);
  judge("Lathe's spec, loaded again after a change", live.ms, ENGINE_BUDGETS.reloadMs, phases(live.timings));
  if (PROFILE) lines.push(`Steps of that load (1 ms and over):\n${profile(live.timings)}`);
  judge('A cold CLI command (lathe use-case get-use-case)', cliGetUseCase(lathe, 'LA-PLT-UC01'), ENGINE_BUDGETS.cliMs, `median of ${RUNS} fresh processes`);
  judge('The full check (lathe check)', cliCheck(lathe), ENGINE_BUDGETS.checkMs, 'one fresh process on Lathe\'s spec');
  const refs: number[] = [];
  for (let i = 0; i < RUNS; i++) { const t = performance.now(); await buildReference(lathe); refs.push(performance.now() - t); }
  judge('Reference (first, then cached)', refs[0], null, `cached ${median(refs.slice(1)).toFixed(1)} ms`);
  const largeCold = await timedLoad(large);
  judge(`Large product, cold load (${largeCold.records})`, largeCold.ms, LARGE_BUDGETS.loadMs, phases(largeCold.timings));
  const edits = await largeEdits(large);
  judge('Large product, one edit visible', edits.editMs, LARGE_BUDGETS.editMs, `median of ${RUNS}; read again: ${edits.reads}`);
  judge("Large product, the checks' run announced", edits.checksMs, LARGE_BUDGETS.checksMs, `median of ${RUNS}, from the file's change`);
  judge("Large product, one of the page's own writes visible", edits.writeMs, LARGE_BUDGETS.editMs, `median of ${RUNS}, from the request`);
  if (PROFILE) lines.push(`Steps of the large product's reload:\n${await largeReloadSteps(large)}`);
} finally {
  rmSync(lathe, { recursive: true, force: true });
  rmSync(large, { recursive: true, force: true });
  await closeEngine();
}

const after = loadavg()[0];
console.log(`Engine performance (load average ${before.toFixed(1)} before, ${after.toFixed(1)} after; judged below ${MAX_LOAD}):`);
console.log(lines.join('\n'));
if (busy) {
  console.log(`\nNot run (machine busy): the load average was ${before.toFixed(1)}, above ${MAX_LOAD}. Nothing was judged.`);
  process.exit(3);
}
if (misses.length > 0) {
  console.log(`\nOver budget:\n${misses.join('\n')}`);
  process.exit(1);
}
console.log('\nEvery engine budget is met.');
