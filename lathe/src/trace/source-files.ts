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
import { readdir } from 'node:fs/promises';
import { fromText } from './file-texts.ts';
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

/**
 * Every file in the folder (from the root, '' for the root itself) and the folders under it, from the root, depth
 * first in the order the folders list them. Links are not followed, as fs.glob does not follow them; a folder `skip`
 * names (by its path from the root and its name) is left out with everything in it. One walk serves the globs
 * (matching): fs.glob walks the tree again for each pattern, ten times slower.
 */
export async function walkFiles(root: string, skip: (folder: string, name: string) => boolean, from = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, from), { withFileTypes: true });
  const found = await Promise.all(entries.map(async (entry): Promise<string[]> => {
    const rel = from ? `${from}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return skip(rel, entry.name) ? [] : walkFiles(root, skip, rel);
    return entry.isFile() ? [rel] : [];
  }));
  return found.flat();
}

/** The files that match one of the globs (from the root, as fs.glob reads them). */
export function matching(files: readonly string[], globs: readonly string[]): string[] {
  const patterns = globs.map((glob) => glob.replace(/^\.\//, ''));
  return files.filter((file) => patterns.some((glob) => path.posix.matchesGlob(file, glob)));
}

/** The product's source files, from the root, sorted: what the source globs match, less what is left out. */
export async function sourceFiles(root: string, source: readonly string[], tests: readonly string[]): Promise<string[]> {
  // One walk of the tree: a folder is skipped by its name, or when it holds its own config (another product).
  const all = await walkFiles(root, (folder, name) => SKIPPED_FOLDERS.has(name) || name.startsWith('.') || existsSync(path.join(root, folder, CONFIG_FILE)));
  const isTest = (file: string) => tests.some((glob) => path.posix.matchesGlob(file, glob));
  const found = matching(all, source).filter((rel) => {
    const parts = rel.split('/');
    return !(parts.slice(0, -1).some((p) => TEST_FOLDERS.has(p)) || CONFIG_NAME.test(parts[parts.length - 1]) || isTest(rel));
  });
  const files = await Promise.all(found.map(async (rel) => {
    try {
      return GENERATED(await fromText(path.join(root, rel), 'head', (text) => text.slice(0, 1024).split('\n').slice(0, 5).join('\n'))) ? null : rel;
    } catch {
      return null; // a file gone since
    }
  }));
  return files.filter((f): f is string => f !== null).sort();
}

/** Whether one of the named paths is the file or a folder holding it. */
export function isTraced(file: string, named: ReadonlySet<string>): boolean {
  for (let at = file; at !== '.' && at !== ''; at = path.posix.dirname(at)) if (named.has(at)) return true;
  return named.has('.') || named.has('');
}
