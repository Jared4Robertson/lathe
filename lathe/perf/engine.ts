// The engine's performance budgets (LA-CHK-DR310), measured: `npm --prefix lathe run test:perf`.
//
// - Loading Lathe's own spec (a cold load: every file parsed) takes under 2 s.
// - A live reload after one record file changes takes under 500 ms.
// It also measures, without a budget, a synthetic product of about 10,000 records (Lathe's spec
// copied six times under other ID prefixes, in a temporary folder), and the format reference.
//
// Timings mean nothing on a machine that is busy with other work, so when the one-minute load
// average is above PERF_MAX_LOAD (12 by default) it still measures and prints, but judges nothing
// and exits 3 ("not run: machine busy"). A budget is never loosened to make a busy run pass.
// Prints one line per measurement, with the load's phases, and exits 1 when a budget is missed.

import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { loadavg, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearParseCache, formatReference, loadWorkspace, type LoadTimings } from '../src/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');

export const ENGINE_BUDGETS = { loadMs: 2000, reloadMs: 500 } as const;
const MAX_LOAD = Number(process.env.PERF_MAX_LOAD ?? 12);
const RUNS = 5;

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const phases = (t: Partial<LoadTimings>) =>
  (['parse', 'files', 'load', 'checks', 'coverage'] as const).map((p) => `${p} ${Math.round(t[p] ?? 0)}`).join(', ');

/** A copy of the repo's specs, checks and config in a temporary folder; the code folders are linked, so tests' run_by files resolve. */
function copyOfRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-perf-'));
  for (const name of readdirSync(repo)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const from = path.join(repo, name);
    if (['specs', 'lathe-checks', 'lathe.config.json', 'model'].includes(name)) cpSync(from, path.join(root, name), { recursive: true });
    else symlinkSync(from, path.join(root, name));
  }
  return root;
}

/** Lathe's spec six times over, under the prefixes LB to LG: about 10,000 records. */
function syntheticProduct(): { root: string; records: number } {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-perf-10k-'));
  const source = path.join(repo, 'specs/lathe');
  let records = 0;
  for (const prefix of ['LB', 'LC', 'LD', 'LE', 'LF', 'LG']) {
    const walk = (dir: string, rel: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const from = path.join(dir, entry.name);
        const to = path.join(root, 'specs', prefix, rel, entry.name);
        if (entry.isDirectory()) { walk(from, path.join(rel, entry.name)); continue; }
        if (!entry.name.endsWith('.md')) continue;
        const text = readFileSync(from, 'utf8').replace(/(?<![A-Za-z0-9])LA(?![a-z0-9])/g, prefix);
        mkdirSync(path.dirname(to), { recursive: true });
        writeFileSync(to, text);
        if (entry.name !== 'README.md') records++;
      }
    };
    walk(source, '');
  }
  // The code folders are linked, so a test's run_by file resolves as it does in this repo.
  for (const name of ['app', 'lathe', 'desktop', 'examples', 'plugin']) if (existsSync(path.join(repo, name))) symlinkSync(path.join(repo, name), path.join(root, name));
  writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ specs: 'specs' }));
  return { root, records };
}

async function timedLoad(root: string, cold: boolean) {
  if (cold) clearParseCache();
  const timings: Partial<LoadTimings> = {};
  const start = performance.now();
  const workspace = await loadWorkspace(root, { timings });
  return { ms: performance.now() - start, timings, records: workspace.records.length };
}

/** Changes one record file (a word added to its body, so its size and time change) and reloads; the median of RUNS. */
async function reload(root: string, file: string) {
  await timedLoad(root, true);
  const times: number[] = [];
  let last: Partial<LoadTimings> = {};
  const original = readFileSync(file, 'utf8');
  try {
    for (let i = 0; i < RUNS; i++) {
      writeFileSync(file, `${original}\nChanged ${i}.\n`);
      const r = await timedLoad(root, false);
      times.push(r.ms);
      last = r.timings;
    }
  } finally {
    writeFileSync(file, original);
  }
  return { ms: median(times), timings: last };
}

function firstRecord(dir: string): string {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { const found = firstRecord(p); if (found) return found; }
    else if (entry.name.endsWith('.md') && entry.name !== 'README.md' && statSync(p).isFile()) return p;
  }
  return '';
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
const big = syntheticProduct();
try {
  const colds = [];
  for (let i = 0; i < 3; i++) colds.push(await timedLoad(lathe, true));
  const cold = colds.sort((a, b) => a.ms - b.ms)[1];
  judge(`Lathe's spec, cold load (${cold.records})`, cold.ms, ENGINE_BUDGETS.loadMs, phases(cold.timings));
  const live = await reload(lathe, firstRecord(path.join(lathe, 'specs/lathe')));
  judge('Lathe\'s spec, live reload', live.ms, ENGINE_BUDGETS.reloadMs, `${phases(live.timings)}; ${live.timings.parsed} file parsed`);
  const refs: number[] = [];
  for (let i = 0; i < RUNS; i++) { const t = performance.now(); await formatReference(lathe); refs.push(performance.now() - t); }
  judge('Format reference (first, then cached)', refs[0], null, `cached ${median(refs.slice(1)).toFixed(1)} ms`);
  const bigCold = await timedLoad(big.root, true);
  judge(`Synthetic product, cold load (${bigCold.records})`, bigCold.ms, null, phases(bigCold.timings));
  const bigLive = await reload(big.root, firstRecord(path.join(big.root, 'specs')));
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
