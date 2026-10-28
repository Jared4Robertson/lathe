// LA-PAT-APP-CODE-R21-T01 and -T02 (LA-PAT-APP-CODE-R21): no dead code, for the platform and for the Explorer. knip finds no unused file, export, dependency or binary in the app, the
// engine or the desktop app, each with its own knip.json (an export used only in its own file is not
// dead). It runs as part of the normal test run; `npm run knip` in a package runs it alone.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const runs = new Map<string, { status: number | null; output: string }>();

/** knip in one package, run once per test run however many tests read it. */
function knip(pkg: string) {
  if (!runs.has(pkg)) runs.set(pkg, runKnip(pkg));
  return runs.get(pkg)!;
}

function runKnip(pkg: string) {
  const cwd = path.join(repo, pkg);
  const run = spawnSync(path.join(cwd, 'node_modules/.bin/knip'), ['--no-progress', '--no-config-hints'], { cwd, encoding: 'utf8', timeout: 120_000 });
  return { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? String(run.error) : ''}`.trim() };
}

describe('LA-PAT-APP-CODE-R21-T01 No unused files, exports or dependencies', () => {
  for (const pkg of ['app', 'lathe', 'desktop']) {
    it(`knip finds nothing unused in ${pkg}/`, () => {
      const { status, output } = knip(pkg);
      expect(output).toBe('');
      expect(status).toBe(0);
    }, 120_000);
  }
});

// The Explorer's code is the app's: the same knip run of app/ proves the rule there.
describe('LA-PAT-APP-CODE-R21-T02 No unused files, exports or dependencies in the Explorer', () => {
  it('knip finds nothing unused in app/', () => {
    const { status, output } = knip('app');
    expect(output).toBe('');
    expect(status).toBe(0);
  }, 120_000);
});
