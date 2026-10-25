// LA-PLT-T129 (LA-PAT-APP-CODE-R21): no dead code. knip finds no unused file, export, dependency or binary in the app, the
// engine or the desktop app, each with its own knip.json (an export used only in its own file is not
// dead). It runs as part of the normal test run; `npm run knip` in a package runs it alone.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function knip(pkg: string) {
  const cwd = path.join(repo, pkg);
  const run = spawnSync(path.join(cwd, 'node_modules/.bin/knip'), ['--no-progress', '--no-config-hints'], { cwd, encoding: 'utf8', timeout: 120_000 });
  return { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? String(run.error) : ''}`.trim() };
}

describe('LA-PLT-T129 No unused files, exports or dependencies', () => {
  for (const pkg of ['app', 'lathe', 'desktop']) {
    it(`knip finds nothing unused in ${pkg}/`, () => {
      const { status, output } = knip(pkg);
      expect(output).toBe('');
      expect(status).toBe(0);
    }, 120_000);
  }
});
