// LA-PLT-T09: a reload parses only the files whose text changed, and gives the same workspace as a
// fresh load; the format reference is kept until a file it reads changes (LA-PLT-DR02, LA-PLT-DR01).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { clearParseCache, formatReference, loadWorkspace, type LoadTimings } from '../src/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const made: string[] = [];
const copyOf = (name: string) => {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-reload-'));
  cpSync(path.join(here, 'fixtures', name), root, { recursive: true });
  made.push(root);
  return root;
};
afterAll(() => { for (const dir of made) rmSync(dir, { recursive: true, force: true }); });

describe('reloading', () => {
  it('LA-PLT-T09 A reload parses only the changed file and gives the same workspace as a fresh load', async () => {
    const root = copyOf('good');
    clearParseCache();
    const cold: Partial<LoadTimings> = {};
    const first = await loadWorkspace(root, { timings: cold });
    expect(cold.parsed).toBe(first.records.length);
    for (const phase of ['parse', 'files', 'load', 'checks', 'coverage', 'total'] as const) expect(cold[phase]).toBeGreaterThanOrEqual(0);

    // Nothing changed: nothing is parsed again, and the workspace is the same.
    const warm: Partial<LoadTimings> = {};
    expect(await loadWorkspace(root, { timings: warm })).toEqual(first);
    expect(warm.parsed).toBe(0);

    // One file changed: only it is parsed, and the result is what a fresh load gives.
    const file = path.join(root, 'specs/example/notes/01-define/use-cases/UC01.md');
    writeFileSync(file, readFileSync(file, 'utf8').replace('title: Write a note', 'title: Write a short note'));
    const changed: Partial<LoadTimings> = {};
    const reloaded = await loadWorkspace(root, { timings: changed });
    expect(changed.parsed).toBe(1);
    expect(reloaded.records.find((r) => r.id === 'EX-NOTE-UC01')?.title).toBe('Write a short note');
    clearParseCache();
    expect(await loadWorkspace(root)).toEqual(reloaded);
  });

  it('LA-PLT-T09 The format reference is kept until a file it reads changes', async () => {
    const root = copyOf('good');
    const first = await formatReference(root);
    expect(await formatReference(root)).toBe(first);
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ specs: 'specs', checks: 'missing-checks' }));
    const next = await formatReference(root);
    expect(next).not.toBe(first);
  });
});
