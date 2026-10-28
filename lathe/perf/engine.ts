// LA-PLT-UC01-R03-T01 LA-AUT-UC01-R09-T01: the engine's performance budgets (LA-PLT-UC01-R03, LA-AUT-UC01-R09),
// measured: `npm --prefix lathe run test:perf`.
//
// - Loading Lathe's own spec (a cold load: the data files read and loaded with every key and rule, then checked)
//   takes under 2 s.
// - A live reload after one row changes takes under 500 ms.
// - A cold CLI command (`lathe show <id>` on Lathe's spec, a fresh process with the schema cache in place) takes
//   under 600 ms, from the process's start to its exit.
// It also measures, without a budget, a synthetic product of about 10,000 records (Lathe's data copied six times
// under other ID prefixes, in a temporary folder), and the reference.
//
// Timings mean nothing on a machine that is busy with other work, so when the one-minute load average is above
// PERF_MAX_LOAD (12 by default) it still measures and prints, but judges nothing and exits 3 ("not run: machine
// busy"). A budget is never loosened to make a busy run pass. Prints one line per measurement, with the load's
// phases, and exits 1 when a budget is missed. With --profile it also prints the steps of Lathe's live reload (the
// store's schema copy, reading the files, each table's insert, record_scope, each validation query, the commit, the
// file facts, the coverage tables and each check), to find where the time goes.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { loadavg, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReference, CONFIG_FILE, loadWorkspace, openStore, SCHEMA_VERSION, sortRows, tableText, type LoadTimings, type Row } from '../src/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');

export const ENGINE_BUDGETS = { loadMs: 2000, reloadMs: 500, cliMs: 600 } as const;
const MAX_LOAD = Number(process.env.PERF_MAX_LOAD ?? 12);
const RUNS = 5;
const PROFILE = process.argv.includes('--profile');

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const phases = (t: Partial<LoadTimings>) => (['open', 'files', 'checks', 'coverage'] as const).map((p) => `${p} ${Math.round(t[p] ?? 0)}`).join(', ');

/** A copy of the repo's data and config in a temporary folder; the code folders are linked, so tests' files resolve. */
function copyOfRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-perf-'));
  for (const name of readdirSync(repo)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const from = path.join(repo, name);
    if (['data', 'lathe.config.json'].includes(name)) cpSync(from, path.join(root, name), { recursive: true });
    else symlinkSync(from, path.join(root, name));
  }
  return root;
}

/**
 * Lathe's data six times over, under the prefixes LB to LG: about 10,000 records. Its own checks are left out, and so
 * are LA's own kinds and relations (a kind's name is one key across products, so six products cannot each declare
 * it): their declarations, their records' tables and every row that names one of those records.
 */
async function syntheticProduct(): Promise<{ root: string }> {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-perf-10k-'));
  const source = path.join(repo, 'data');
  const schemaStore = await openStore(root, { dataDir: path.join(root, 'none'), latheDataDir: null });
  const schema = schemaStore.schema;
  await schemaStore.close();
  const declarations = ['product_kind', 'product_kind_field', 'product_relation'];
  const files = readdirSync(source).filter((f) => f.endsWith('.jsonl') && f !== 'check.jsonl');
  const kept = files.filter((f) => schema.tables[f.slice(0, -'.jsonl'.length)] && !declarations.includes(f.slice(0, -'.jsonl'.length)));
  // The IDs of the records of LA's own kinds, which no copy keeps.
  const dropped = new Set(
    files
      .filter((f) => !schema.tables[f.slice(0, -'.jsonl'.length)])
      .flatMap((f) => readFileSync(path.join(source, f), 'utf8').split('\n').filter(Boolean).map((line) => String(JSON.parse(line).id))),
  );
  const namesDropped = (row: Row) => Object.values(row).some((v) => typeof v === 'string' && dropped.has(v));
  mkdirSync(path.join(root, 'data'));
  // Its config names this Lathe's schema version, as the copied data is for it.
  writeFileSync(path.join(root, CONFIG_FILE), `${JSON.stringify({ schema: SCHEMA_VERSION })}\n`);
  for (const file of kept) {
    const table = schema.tables[file.slice(0, -'.jsonl'.length)];
    const own = readFileSync(path.join(source, file), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as Row).filter((row) => !namesDropped(row));
    const text = own.map((row) => JSON.stringify(row)).join('\n');
    const rows: Row[] = [];
    for (const prefix of ['LB', 'LC', 'LD', 'LE', 'LF', 'LG']) {
      const copied = text.replace(/(?<![A-Za-z0-9])LA(?![a-z0-9])/g, prefix);
      for (const line of copied.split('\n').filter(Boolean)) rows.push(JSON.parse(line));
    }
    writeFileSync(path.join(root, 'data', file), tableText(table, sortRows(table, rows)));
  }
  // The code folders are linked, so a test's file resolves as it does in this repo.
  for (const name of ['app', 'lathe', 'desktop', 'examples', 'plugin']) if (existsSync(path.join(repo, name))) symlinkSync(path.join(repo, name), path.join(root, name));
  return { root };
}

async function timedLoad(root: string) {
  const timings: Partial<LoadTimings> = {};
  const start = performance.now();
  const workspace = await loadWorkspace(root, { timings });
  return { ms: performance.now() - start, timings, records: workspace.records.length };
}

/** Changes one row through the store (its title, so the data file changes) and reloads; the median of RUNS. */
async function reload(root: string) {
  const store = await openStore(root);
  const [first] = store.rows('use_case');
  await store.close();
  const runs: { ms: number; timings: Partial<LoadTimings> }[] = [];
  for (let i = 0; i < RUNS; i++) {
    const writer = await openStore(root);
    await writer.set('use_case', String(first.id), { title: `${first.title} ${i}` });
    await writer.close();
    runs.push(await timedLoad(root));
  }
  // The median run, with its own phases.
  return [...runs].sort((a, b) => a.ms - b.ms)[Math.floor(runs.length / 2)];
}

/**
 * A cold CLI command, as an Agent runs it: `lathe show` in a fresh process, timed from its start to its exit. The first
 * run fills the schema cache, as any earlier command has on a working machine; then the median of RUNS.
 */
function cliShow(root: string, id: string): number {
  const bin = path.join(here, '..', 'bin', 'lathe.ts');
  const once = () => {
    const start = performance.now();
    const run = spawnSync(process.execPath, [bin, 'show', id, '--root', root], { encoding: 'utf8' });
    if (run.status !== 0) throw new Error(`lathe show ${id} failed: ${run.stderr}`);
    return performance.now() - start;
  };
  once();
  return median(Array.from({ length: RUNS }, once));
}

/** The steps of a load, slowest first, with the totals of the inserts, validation queries and checks. */
function profile(t: Partial<LoadTimings>): string {
  const steps = Object.entries(t.steps ?? {});
  const sum = (prefix: string) => steps.filter(([n]) => n.startsWith(prefix)).reduce((a, [, ms]) => a + ms, 0);
  const totals = ['insert ', 'validate ', 'check '].map((p) => `  ${`${p.trim()} (all, summed)`.padEnd(48)} ${sum(p).toFixed(1).padStart(7)} ms`);
  const slowest = steps.sort((a, b) => b[1] - a[1]).filter(([, ms]) => ms >= 1).map(([n, ms]) => `  ${n.padEnd(48)} ${ms.toFixed(1).padStart(7)} ms`);
  return [...totals, ...slowest].join('\n');
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
const big = await syntheticProduct();
try {
  const colds = [];
  for (let i = 0; i < 3; i++) colds.push(await timedLoad(lathe));
  const cold = colds.sort((a, b) => a.ms - b.ms)[1];
  judge(`Lathe's spec, cold load (${cold.records})`, cold.ms, ENGINE_BUDGETS.loadMs, phases(cold.timings));
  const live = await reload(lathe);
  judge("Lathe's spec, live reload", live.ms, ENGINE_BUDGETS.reloadMs, phases(live.timings));
  if (PROFILE) lines.push(`Steps of that reload (1 ms and over):\n${profile(live.timings)}`);
  judge('A cold CLI command (lathe show)', cliShow(lathe, 'LA-PLT-UC01'), ENGINE_BUDGETS.cliMs, `median of ${RUNS} fresh processes`);
  const refs: number[] = [];
  for (let i = 0; i < RUNS; i++) { const t = performance.now(); await buildReference(lathe); refs.push(performance.now() - t); }
  judge('Reference (first, then cached)', refs[0], null, `cached ${median(refs.slice(1)).toFixed(1)} ms`);
  const bigCold = await timedLoad(big.root);
  judge(`Synthetic product, cold load (${bigCold.records})`, bigCold.ms, null, phases(bigCold.timings));
  const bigLive = await reload(big.root);
  judge('Synthetic product, live reload', bigLive.ms, null, phases(bigLive.timings));
} finally {
  rmSync(lathe, { recursive: true, force: true });
  rmSync(big.root, { recursive: true, force: true });
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
