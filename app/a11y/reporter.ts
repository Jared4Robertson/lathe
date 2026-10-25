import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import type { Finding } from './axe';

// Gathers every audit's findings into app/a11y/results/summary.json (ignored by git), grouped by
// axe rule, and prints one line per rule. notes/a11y-audit.md is written from this summary.

const here = path.dirname(fileURLToPath(import.meta.url));

export default class A11yReporter implements Reporter {
  private findings: Finding[] = [];

  onTestEnd(_test: TestCase, result: TestResult) {
    for (const a of result.attachments) {
      if (!a.name.startsWith('a11y: ') || !a.body) continue;
      this.findings.push(...(JSON.parse(a.body.toString()) as Finding[]));
    }
  }

  onEnd() {
    const byRule = new Map<string, Finding[]>();
    for (const f of this.findings) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f]);
    const dir = path.join(here, 'results');
    mkdirSync(dir, { recursive: true });
    const summary = [...byRule].map(([rule, list]) => ({
      rule,
      impact: list[0].impact,
      help: list[0].help,
      states: [...new Set(list.map((f) => f.state))],
      targets: [...new Set(list.flatMap((f) => f.targets))].slice(0, 60),
      samples: [...new Set(list.flatMap((f) => f.summaries))].slice(0, 12),
    }));
    writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2));
    if (process.env.A11Y_LABEL) writeFileSync(path.join(dir, `summary-${process.env.A11Y_LABEL}.json`), JSON.stringify(summary, null, 2));
    console.log(`\naccessibility: ${this.findings.length} finding(s) in ${byRule.size} rule(s)`);
    for (const s of summary) console.log(`  ${s.rule} (${s.impact}): ${s.states.length} state(s), ${s.targets.length} element(s)`);
  }
}
