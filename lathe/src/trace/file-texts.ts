import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

// The text of the product's files as the loads read them (the files records name, the test files, the source files'
// heads and the routes in them), kept for the process by each file's size, change time and inode, so a load after a
// change reads again only the files that changed, and what is worked out from a file's text (its test cases, the routes
// it names, whether it names an ID) is worked out once per version of the file (LA-PLT-UC01-R03). Every load still
// looks at every file: a file is read again whenever its size, change time or inode differ from those it was read at.

interface Kept { version: string; text: Promise<string>; derived: Map<string, unknown> }
const kept = new Map<string, Kept>();
/** How many files are kept: a few products' worth. */
const KEPT_FILES = 20_000;

/** What a path is now: a file with its version, a folder, or nothing. */
export function entryOf(file: string | null): { type: 'file'; version: string } | { type: 'folder' | null } {
  if (!file) return { type: null };
  try {
    const info = statSync(file, { bigint: true });
    if (info.isFile()) return { type: 'file', version: `${info.size}:${info.mtimeNs}:${info.ctimeNs}:${info.ino}` };
    return { type: info.isDirectory() ? 'folder' : null };
  } catch {
    return { type: null };
  }
}

function keptFor(file: string, version: string): Kept {
  let known = kept.get(file);
  if (!known || known.version !== version) {
    const text = readFile(file, 'utf8');
    known = { version, text, derived: new Map() };
    text.catch(() => kept.delete(file));
    kept.delete(file);
    if (kept.size >= KEPT_FILES) kept.delete(kept.keys().next().value!);
    kept.set(file, known);
  }
  return known;
}

/** A file's text, read again only when the file changed since it was last read; throws as readFile does when it is gone. */
export async function textOf(file: string): Promise<string> {
  const entry = entryOf(file);
  if (entry.type !== 'file') return readFile(file, 'utf8');
  return keptFor(file, entry.version).text;
}

/** What `work` makes of a file's text, under a name of its own, made once per version of the file. */
export async function fromText<T>(file: string, name: string, work: (text: string) => T): Promise<T> {
  const entry = entryOf(file);
  if (entry.type !== 'file') return work(await readFile(file, 'utf8'));
  const known = keptFor(file, entry.version);
  const text = await known.text;
  if (!known.derived.has(name)) known.derived.set(name, work(text));
  return known.derived.get(name) as T;
}
