// A write's data files, all or nothing (LA-PLT-STORE01). A command that changes several tables rewrites several data
// files; a crash between two of them must not leave the folder half old and half new. So a write puts every changed
// file's new text in a folder of its own inside the data folder (.lathe-write/, which ignores itself in git), then
// writes the journal there, the list of files to put in place and to remove, and only then renames each new file
// over its old one and removes the removed ones; last it deletes the folder.
//
// The journal is the commit point. The next load (or reload) after a crash finds the folder and settles it before it
// reads a file (settleWrite): with a journal, every new file is ready, so it finishes the renames and removals the
// write had left; without one, the write never reached its commit point, so it deletes the new files and the data is
// as it was. Either way it says what it did. A journal is itself written through a temporary file and a rename, so it
// is there whole or not at all.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** The folder of a write in progress, inside the data folder. */
export const WRITE_FOLDER = '.lathe-write';
const JOURNAL = 'journal.json';

/** One data file a write changes: its new text, or null when the write removes it. */
export interface FileChange {
  /** The data file's name in the data folder, such as use_case.jsonl. */
  file: string;
  text: string | null;
}

/** What settling a crashed write did. */
export interface Settled {
  /** finished: the journal was there, so the write was finished; rolled back: it was not, so the data is as before. */
  outcome: 'finished' | 'rolled back';
  /** The data files it put in place or removed (finished), or whose new text it discarded (rolled back). */
  files: string[];
  /** One line that says what it did, for the person whose load found it. */
  message: string;
}

interface Journal {
  write: string[];
  remove: string[];
}

/**
 * Writes the changes to the data folder all or nothing: every new file beside the data, then the journal, then the
 * renames and removals. A write left by a crash is settled first.
 */
export async function writeAll(dataDir: string, changes: readonly FileChange[]): Promise<void> {
  if (!changes.length) return;
  await settleWrite(dataDir);
  const folder = path.join(dataDir, WRITE_FOLDER);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, '.gitignore'), '*\n');
  const journal: Journal = { write: [], remove: [] };
  for (const change of changes) {
    if (change.text === null) {
      journal.remove.push(change.file);
      continue;
    }
    await writeFile(path.join(folder, change.file), change.text, { flush: true });
    journal.write.push(change.file);
  }
  await writeFile(path.join(folder, `${JOURNAL}.tmp`), JSON.stringify(journal), { flush: true });
  await rename(path.join(folder, `${JOURNAL}.tmp`), path.join(folder, JOURNAL));
  await finish(dataDir, journal);
}

// Puts each new file in place and removes each removed one, then deletes the write's folder. Each step can run again
// after a crash: a file already renamed has no new text left, and a removed file is not there.
async function finish(dataDir: string, journal: Journal): Promise<void> {
  const folder = path.join(dataDir, WRITE_FOLDER);
  for (const file of journal.write) {
    if (existsSync(path.join(folder, file))) await rename(path.join(folder, file), path.join(dataDir, file));
  }
  for (const file of journal.remove) await rm(path.join(dataDir, file), { force: true });
  await rm(folder, { recursive: true, force: true });
}

/**
 * Settles a write a crash left in the data folder, before anything reads it: finishes it when its journal is there,
 * else rolls it back. Returns what it did, or null when no write was left.
 */
export async function settleWrite(dataDir: string): Promise<Settled | null> {
  const folder = path.join(dataDir, WRITE_FOLDER);
  if (!existsSync(folder)) return null;
  const at = path.basename(dataDir);
  if (existsSync(path.join(folder, JOURNAL))) {
    const journal = JSON.parse(readFileSync(path.join(folder, JOURNAL), 'utf8')) as Journal;
    await finish(dataDir, journal);
    const files = [...journal.write, ...journal.remove].sort();
    return { outcome: 'finished', files, message: `Finished a write a crash interrupted in ${at}/: ${files.join(', ')} now hold the change it made.` };
  }
  const files = readdirSync(folder).filter((f) => f.endsWith('.jsonl')).sort();
  await rm(folder, { recursive: true, force: true });
  return {
    outcome: 'rolled back',
    files,
    message: `Rolled back a write a crash interrupted in ${at}/ before it changed any data file${files.length ? ` (its new ${files.join(', ')} discarded)` : ''}: the data is as it was before it.`,
  };
}
