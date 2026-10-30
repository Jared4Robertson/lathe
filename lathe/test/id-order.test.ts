// LA-STD-CODE-R08-T01 (LA-STD-CODE-R08): record IDs are put in ID order through each package's one ID collator, made
// once: the engine's in lathe/src/platform/data/ids.ts, the app's in app/src/exploring/record-summaries/record-index.ts.
// No other code makes a collator or sorts with a numeric localeCompare, which builds a collator on every comparison.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The code the rule covers: the engine, the server and the CLI, the app and the desktop app. */
const FOLDERS = ['lathe/src', 'lathe/bin', 'lathe/perf', 'lathe/scripts', 'app/src', 'app/server', 'desktop/src'];
const SOURCE = /\.(?:c|m)?(?:t|j)sx?$/;

/** The one ID collator of each package. */
const HOMES = new Set(['lathe/src/platform/data/ids.ts', 'app/src/exploring/record-summaries/record-index.ts']);

function sourceFiles(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    if (e.name === 'node_modules' || e.name === 'dist') return [];
    const full = path.join(dir, e.name);
    return e.isDirectory() ? sourceFiles(full) : SOURCE.test(e.name) ? [full] : [];
  });
}

/** Each line of the text that makes a collator or compares with localeCompare's numeric option, by its number. */
function ownOrders(text: string): number[] {
  return text.split('\n').flatMap((line, at) => (/new Intl\.Collator\(|localeCompare\([^)]*numeric/.test(line) ? [at + 1] : []));
}

describe('LA-STD-CODE-R08-T01 record IDs are ordered by the one ID collator of each package', () => {
  it('finds a collator of its own and a numeric localeCompare, and lets a plain localeCompare pass', () => {
    expect(ownOrders("const c = new Intl.Collator('en', { numeric: true });")).toEqual([1]);
    expect(ownOrders("ids.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));")).toEqual([1]);
    expect(ownOrders('names.sort((a, b) => a.localeCompare(b));\nids.sort(compareIds);')).toEqual([]);
  });

  it('the engine, the app and the desktop app make a collator only in the two homes, and never sort with a numeric localeCompare', () => {
    const files = FOLDERS.flatMap((folder) => sourceFiles(path.join(REPO, folder)));
    expect(files.length).toBeGreaterThan(50);
    const found = files.flatMap((file) => {
      const rel = path.relative(REPO, file).split(path.sep).join('/');
      const lines = ownOrders(readFileSync(file, 'utf8'));
      return HOMES.has(rel) ? (lines.length === 1 ? [] : [`${rel}: ${lines.length} collators`]) : lines.map((line) => `${rel}:${line}`);
    });
    expect(found).toEqual([]);
  });
});
