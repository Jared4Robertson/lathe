import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import type { StepResult } from './measure';

// Gathers every step's measurement into app/stability/results/summary.json (ignored by git) and
// prints one line per step: its unexpected shift, its total shift, its long frames and what moved.
// notes/jitter-audit.md is written from this summary.

const here = path.dirname(fileURLToPath(import.meta.url));

export default class StabilityReporter implements Reporter {
  private steps: (StepResult & { status: string; expected: string })[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    for (const a of result.attachments) {
      if (!a.name.startsWith('stability: ') || !a.body) continue;
      this.steps.push({ ...(JSON.parse(a.body.toString()) as StepResult), status: result.status, expected: test.expectedStatus });
    }
  }

  onEnd() {
    if (this.steps.length === 0) return;
    const dir = path.join(here, 'results');
    mkdirSync(dir, { recursive: true });
    const body = JSON.stringify(this.steps, null, 2);
    writeFileSync(path.join(dir, 'summary.json'), body);
    // STABILITY_LABEL=before keeps a copy to compare with (summary-before.json).
    if (process.env.STABILITY_LABEL) writeFileSync(path.join(dir, `summary-${process.env.STABILITY_LABEL}.json`), body);
    const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
    const lines = this.steps.map((s) =>
      `${pad(`${s.scenario} / ${s.step}`, 64)} unexpected ${s.unexpected.toFixed(4)}  deferred ${s.deferred.toFixed(4)}  total ${s.total.toFixed(4)}  long frames ${s.longFrames.count} (worst ${s.longFrames.worst} ms)${s.moved.length ? `  moved: ${s.moved.map((m) => m.selector).join(', ')}` : ''}`);
    console.log(`\nStability (budget 0.01 unexpected per step):\n${lines.join('\n')}\n`);
  }
}
