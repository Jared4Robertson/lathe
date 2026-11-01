import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The browser suites (stability, a11y, perf) take `test` and `expect` from stability/test.ts only, so every test fails
// when its page logs an error, and stand in for the desktop shell only through stability/desktop.ts, whose stand-in is
// typed by the bridge itself (test/desktop-bridge.ts).

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['stability', 'a11y', 'perf'].flatMap((dir) =>
  readdirSync(path.join(app, dir)).filter((f) => f.endsWith('.ts')).map((f) => `${dir}/${f}`));

describe('LA-PAT-APP-CODE-R26-T01 LA-PAT-APP-CODE-R26-T02 the browser suites', () => {
  it('take test and expect only from stability/test.ts, which fails a test on any console error', () => {
    const own = files.filter((f) => f !== 'stability/test.ts' && /import \{[^}]*\b(test|expect)\b[^}]*\} from '@playwright\/test'/.test(readFileSync(path.join(app, f), 'utf8').replace(/import type \{[^}]*\}/g, '')));
    expect(own).toEqual([]);
  });

  it('stand in for the desktop bridge only through the shared stand-in', () => {
    const own = files.filter((f) => f !== 'stability/desktop.ts' && /latheDesktop\s*=/.test(readFileSync(path.join(app, f), 'utf8')));
    expect(own).toEqual([]);
  });
});
