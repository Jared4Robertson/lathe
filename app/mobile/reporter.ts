import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import type { Finding } from './measure';

// Gathers every page's findings into app/mobile/results/summary.json (ignored by git), each with its phone and page,
// and prints the count per check and per phone.

const here = path.dirname(fileURLToPath(import.meta.url));

/** A finding where it was found, with its cropped screenshot. */
export interface Found extends Finding { phone: string; page: string; shot: string }

export default class PhoneReporter implements Reporter {
  private found: Found[] = [];

  onTestEnd(_test: TestCase, result: TestResult) {
    for (const a of result.attachments) if (a.name === 'phone findings' && a.body) this.found.push(...(JSON.parse(a.body.toString()) as Found[]));
  }

  onEnd() {
    const dir = path.join(here, 'results');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(this.found, null, 2));
    const count = (key: (f: Found) => string) => {
      const by = new Map<string, number>();
      for (const f of this.found) by.set(key(f), (by.get(key(f)) ?? 0) + 1);
      return [...by].map(([k, n]) => `${k} ${n}`).join(', ');
    };
    console.log(`\nphone: ${this.found.length} finding(s) on ${new Set(this.found.map((f) => `${f.phone} ${f.page}`)).size} page(s)`);
    console.log(`  by check: ${count((f) => f.check)}`);
    console.log(`  by phone: ${count((f) => f.phone)}`);
  }
}
