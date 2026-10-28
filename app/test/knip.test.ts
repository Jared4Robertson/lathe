// LA-PAT-APP-CODE-R21 (no dead code): knip finds no unused file, export, dependency or binary in the app, the engine or
// the desktop app, each with its own knip.json (an export used only in its own file is not dead). The app holds both
// the Platform's and Exploring's code, so one run of knip per package proves the rule for each domain that follows
// the pattern: LA-PAT-APP-CODE-R21-T01 for LA-PLT and LA-PAT-APP-CODE-R21-T02 for LA-EXP. It runs as part of the normal
// test run; `npm run knip` in a package runs it alone.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** knip's findings in a package, run once however many tests read them. */
const runs = new Map<string, { status: number | null; output: string }>();
function knip(pkg: string) {
  const known = runs.get(pkg);
  if (known) return known;
  const cwd = path.join(repo, pkg);
  const run = spawnSync(path.join(cwd, 'node_modules/.bin/knip'), ['--no-progress', '--no-config-hints'], { cwd, encoding: 'utf8', timeout: 120_000 });
  const result = { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? String(run.error) : ''}`.trim() };
  runs.set(pkg, result);
  return result;
}

describe.each(['LA-PAT-APP-CODE-R21-T01', 'LA-PAT-APP-CODE-R21-T02'])('%s No unused files, exports or dependencies', () => {
  for (const pkg of ['app', 'lathe', 'desktop']) {
    it(`knip finds nothing unused in ${pkg}/`, () => {
      const { status, output } = knip(pkg);
      expect(output).toBe('');
      expect(status).toBe(0);
    }, 120_000);
  }
});
