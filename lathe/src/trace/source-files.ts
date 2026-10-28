// The product's source files and whether a technical record names each, for the code-file-untraced coverage gap.
//
// A source file is a file matching the config's source globs (DEFAULT_SOURCE when it names none), except what is
// left out whatever the globs:
// - folders never read: node_modules, build output (dist, build, out, coverage), dot-folders (.git, .claude) and
//   the folder of another product (one with its own lathe.config.json);
// - tests: a file matching the config's test globs, or inside a folder named test, tests, __tests__, __mocks__ or
//   fixtures (a test's helpers and fixtures serve its tests, which test records trace);
// - configs: a file named like a tool's config (vite.config.ts, eslint.config.js, .prettierrc.js) and a type
//   declaration file (*.d.ts);
// - generated files: one whose first five lines say @generated, or say generated and do not edit.
//
// A source file is traced when a technical record (a record of a technical-specification kind, Lathe's or the
// product's own, that has a file column) names it, or names a folder that holds it. Paths are compared from the repo
// root, as records write them, after dropping a leading ./ and a trailing slash. It reads only names and the first
// lines of each file; it never reads code for record IDs, which code needs not carry.
import { existsSync } from 'node:fs';
import { glob, open } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG_FILE } from '../config.ts';

/** The folders never read for source files, at any depth. */
const SKIPPED_FOLDERS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage']);

/** The folders whose files serve tests, at any depth: left out as tests. */
const TEST_FOLDERS = new Set(['test', 'tests', '__tests__', '__mocks__', 'fixtures']);

/** A tool's config file by its name: name.config.ext, name.setup.ext, or a dotfile such as .eslintrc.cjs. */
const CONFIG_NAME = /(^|\.)config\.[cm]?[jt]sx?$|^\.[^/]*rc(\.[cm]?[jt]s)?$|\.d\.[cm]?ts$/;

/** A generated file's header: @generated, or generated and do not edit, in its first lines. */
const GENERATED = (head: string) => /@generated/.test(head) || (/\bgenerated\b/i.test(head) && /\bdo not edit\b/i.test(head));

/** Path as records write it: from the repo root, forward slashes, no leading ./ and no trailing slash. */
export const normalizePath = (file: string) => path.posix.normalize(file.split(path.sep).join('/').replace(/^\.\//, '')).replace(/\/+$/, '');

async function head(file: string): Promise<string> {
  const handle = await open(file, 'r');
  try {
    const buffer = Buffer.alloc(1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString('utf8').split('\n').slice(0, 5).join('\n');
  } finally {
    await handle.close();
  }
}

/** The product's source files, from the root, sorted: what the source globs match, less what is left out. */
export async function sourceFiles(root: string, source: readonly string[], tests: readonly string[]): Promise<string[]> {
  const skip = (entry: string) => {
    const name = path.basename(entry);
    if (entry === '' || entry === '.') return false;
    return SKIPPED_FOLDERS.has(name) || (name.startsWith('.') && !path.extname(name)) || existsSync(path.join(root, entry, CONFIG_FILE));
  };
  const testFiles = new Set<string>();
  for await (const file of glob([...tests], { cwd: root, exclude: skip })) testFiles.add(normalizePath(String(file)));
  const found = new Set<string>();
  for await (const file of glob([...source], { cwd: root, exclude: skip })) {
    const rel = normalizePath(String(file));
    const parts = rel.split('/');
    const name = parts[parts.length - 1];
    if (testFiles.has(rel) || parts.slice(0, -1).some((p) => TEST_FOLDERS.has(p)) || CONFIG_NAME.test(name)) continue;
    found.add(rel);
  }
  const files = await Promise.all([...found].map(async (rel) => {
    try {
      return GENERATED(await head(path.join(root, rel))) ? null : rel;
    } catch {
      return null; // a folder the globs matched, or a file gone since
    }
  }));
  return files.filter((f): f is string => f !== null).sort();
}

/** Whether one of the named paths is the file or a folder holding it. */
export function isTraced(file: string, named: ReadonlySet<string>): boolean {
  for (let at = file; at !== '.' && at !== ''; at = path.posix.dirname(at)) if (named.has(at)) return true;
  return named.has('.') || named.has('');
}
