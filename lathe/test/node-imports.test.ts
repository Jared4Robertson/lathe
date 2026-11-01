// LA-PAT-AGGREGATE-COMMANDS-R12, proved in Authoring, Checking and Traceability (T01 to T03): the engine, the server,
// the CLI, the desktop app and their tests import Node's built-in modules by their node: name, never by the bare name.
// A scan of every source and test file.
import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The folders the rule covers: the engine and server (with the CLI, scripts and budgets), the desktop app, and their tests. */
const FOLDERS = ['lathe/src', 'lathe/bin', 'lathe/scripts', 'lathe/perf', 'lathe/test', 'desktop/src', 'desktop/scripts', 'desktop/test'];
const SOURCE = /\.(?:c|m)?(?:t|j)sx?$/;

/** Node's built-in modules that also have a bare name, such as fs and fs/promises. */
const BARE = new Set(builtinModules.filter((name) => !name.startsWith('node:')));

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

/** The modules a file names in an import or export from, a dynamic import, or a require. */
function namedModules(text: string): string[] {
  const names: string[] = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(['"])([^'"\n]+)\1/gm;
  for (const m of text.matchAll(pattern)) names.push(m[2]);
  return names;
}

/** The built-in modules a file imports by their bare name. */
const bareBuiltins = (text: string): string[] => namedModules(text).filter((name) => BARE.has(name));

describe('LA-PAT-AGGREGATE-COMMANDS-R12-T01 LA-PAT-AGGREGATE-COMMANDS-R12-T02 LA-PAT-AGGREGATE-COMMANDS-R12-T03 built-in modules are imported with the node: prefix', () => {
  it('finds a bare built-in import in any of the shapes it may take, and lets a node: one or a package pass', () => {
    // The samples quote through q, so this file's own text names no module it does not import.
    const q = "'";
    const named = (...lines: string[]) => bareBuiltins(lines.join('\n'));
    expect(named(`import fs from ${q}fs${q};`, `import { join } from ${q}path${q};`, `export { x } from ${q}fs/promises${q};`)).toEqual(['fs', 'path', 'fs/promises']);
    expect(named(`const cp = require(${q}child_process${q});`, `const u = await import(${q}url${q});`, `import ${q}os${q};`)).toEqual(['child_process', 'url', 'os']);
    expect(named(`import fs from ${q}node:fs${q};`, `import { describe } from ${q}vitest${q};`, `import x from ${q}./path${q};`)).toEqual([]);
  });

  it('the engine, the server, the desktop app and their tests name every built-in module with node:', () => {
    const files = FOLDERS.flatMap((folder) => sourceFiles(path.join(REPO, folder)));
    expect(files.length).toBeGreaterThan(50);
    const bare = files.flatMap((file) => bareBuiltins(readFileSync(file, 'utf8')).map((name) => `${path.relative(REPO, file)}: ${name}`));
    expect(bare).toEqual([]);
  });
});
