import { mkdirSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { MAX_LOAD } from './budgets';
import type { PerfResult } from './measure';

// Gathers every measurement into app/perf/results/summary.json (ignored by git) and prints one line
// each: its value, its budget and its verdict. PERF_LABEL=before also keeps summary-before.json.

const here = path.dirname(fileURLToPath(import.meta.url));

export default class PerfReporter implements Reporter {
  private results: PerfResult[] = [];
  private load = loadavg()[0];

  onTestEnd(_test: TestCase, result: TestResult) {
    for (const a of result.attachments) {
      if (a.name.startsWith('perf: ') && a.body) this.results.push(JSON.parse(a.body.toString()) as PerfResult);
    }
  }

  onEnd() {
    if (this.results.length === 0) return;
    const dir = path.join(here, 'results');
    mkdirSync(dir, { recursive: true });
    const body = JSON.stringify(this.results, null, 2);
    writeFileSync(path.join(dir, 'summary.json'), body);
    if (process.env.PERF_LABEL) writeFileSync(path.join(dir, `summary-${process.env.PERF_LABEL}.json`), body);
    const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
    const lines = this.results.map((r) =>
      `${pad(r.name, 52)} ${pad(`${r.value} ${r.unit}`, 12)} ${pad(r.budget === null ? '' : `budget ${r.budget} ${r.unit}`, 18)} ${pad(r.verdict, 10)} load ${r.load}${r.detail ? `\n    ${r.detail}` : ''}`);
    const busy = this.results.some((r) => r.verdict === 'not judged');
    console.log(`\nPerformance (load average ${this.load.toFixed(1)} at the start; judged below ${MAX_LOAD}):\n${lines.join('\n')}\n${busy ? 'Some budgets were not run (machine busy): measured, not judged.\n' : ''}`);
  }
}
