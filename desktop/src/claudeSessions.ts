// Claude Code's own files, read for the chat panel (LA-PLT-UC19): where the user's `claude` CLI is,
// the sessions it saved for a folder (its session store, ~/.claude/projects/<folder>/<id>.jsonl),
// each by title and date, and which sessions another Claude client has open now (its registry of
// running sessions, ~/.claude/sessions/<pid>.json), so the panel can warn before two clients write
// one transcript. Lathe only reads these files; the CLI writes them. Whether the CLI is signed in comes from the CLI
// itself (`claude auth status --json`), never from its files or the environment.
import { execFile } from 'node:child_process';
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import path from 'node:path';
import { promptText } from './chat.ts';

/** The session store's folder for a working folder: every character but letters and digits becomes "-". */
export const projectDirName = (folder: string) => folder.replace(/[^A-Za-z0-9]/g, '-');

export interface SessionSummary {
  id: string;
  title: string;
  /** When the transcript was last written, in ms. */
  updated: number;
  /** Another client has it open (its process is running), or it was written in the last minute. */
  openElsewhere: 'running' | 'recent' | null;
}

/** How recently a transcript must have been written for the panel to say it may be open elsewhere. */
export const RECENT_MS = 60_000;
/** How much of each end of a transcript the picker reads for its title. */
const PEEK = 64 * 1024;

function readEnds(file: string, size: number): { head: string; tail: string } {
  const fd = openSync(file, 'r');
  try {
    const read = (start: number, length: number) => {
      const buffer = Buffer.alloc(length);
      const n = readSync(fd, buffer, 0, length, start);
      return buffer.subarray(0, n).toString('utf8');
    };
    const head = read(0, Math.min(PEEK, size));
    const tail = size > PEEK ? read(size - PEEK, PEEK) : head;
    return { head, tail };
  } finally {
    closeSync(fd);
  }
}

const parse = (line: string): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(line) as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/** A session's title from its transcript's ends: the name it was given, else its summary, else its first prompt. Null for a transcript with no prompt. */
export function sessionTitle(head: string, tail: string): string | null {
  let named: string | null = null;
  let summary: string | null = null;
  for (const line of tail.split('\n')) {
    const entry = parse(line);
    if (!entry) continue;
    if (entry.type === 'custom-title' && typeof entry.customTitle === 'string' && entry.customTitle.trim()) named = entry.customTitle.trim();
    if (entry.type === 'summary' && typeof entry.summary === 'string' && entry.summary.trim()) summary = entry.summary.trim();
  }
  if (named ?? summary) return named ?? summary;
  for (const line of head.split('\n')) {
    const entry = parse(line);
    if (!entry || entry.type !== 'user' || entry.isMeta || entry.isSidechain) continue;
    const text = promptText((entry.message as { content?: unknown } | undefined)?.content);
    if (text) {
      const first = text.replace(/\s+/g, ' ').trim();
      return first.length > 80 ? `${first.slice(0, 79)}…` : first;
    }
  }
  return null;
}

/** The sessions running in other Claude clients now, by session ID, from the CLI's registry; `isAlive` checks a process ID. */
export function runningSessions(registry: string, isAlive: (pid: number) => boolean, except: ReadonlySet<number> = new Set()): Set<string> {
  const ids = new Set<string>();
  let files: string[];
  try {
    files = readdirSync(registry).filter((f) => f.endsWith('.json'));
  } catch {
    return ids;
  }
  for (const file of files) {
    const entry = parse(readFileSync(path.join(registry, file), 'utf8'));
    const pid = entry?.pid;
    if (typeof entry?.sessionId === 'string' && typeof pid === 'number' && !except.has(pid) && isAlive(pid)) ids.add(entry.sessionId);
  }
  return ids;
}

/** Whether a process is running, by its ID. */
export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: it runs, as another user.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** The folder's saved sessions, newest first, each with its title and date, and whether it may be open elsewhere. */
export function listSessions(store: string, folder: string, running: ReadonlySet<string>, now = Date.now()): SessionSummary[] {
  const dir = path.join(store, projectDirName(folder));
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => /^[0-9a-f-]{36}\.jsonl$/i.test(f));
  } catch {
    return [];
  }
  const sessions: SessionSummary[] = [];
  for (const file of files) {
    const full = path.join(dir, file);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size === 0) continue;
    const { head, tail } = readEnds(full, stat.size);
    const title = sessionTitle(head, tail);
    if (!title) continue;
    const id = file.slice(0, -'.jsonl'.length);
    const openElsewhere = running.has(id) ? 'running' : now - stat.mtimeMs < RECENT_MS ? 'recent' : null;
    sessions.push({ id, title, updated: stat.mtimeMs, openElsewhere });
  }
  return sessions.sort((a, b) => b.updated - a.updated);
}

/** A saved session's transcript file, if the folder has it. */
export function transcriptFile(store: string, folder: string, id: string): string | null {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const file = path.join(store, projectDirName(folder), `${id}.jsonl`);
  return existsSync(file) ? file : null;
}

/**
 * Where the user's `claude` is: the path settings.json names, else the first found on the PATH or in the
 * places its installers put it. An app started from the Finder gets a short PATH, so those places count.
 */
export function findClaude(configured: string | undefined, home: string, pathVar: string | undefined, exists: (file: string) => boolean = existsSync): string | null {
  if (configured) return exists(configured) ? configured : null;
  const dirs = [
    ...(pathVar ?? '').split(path.delimiter).filter(Boolean),
    path.join(home, '.local', 'bin'),
    path.join(home, '.claude', 'local'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ];
  for (const dir of dirs) {
    const file = path.join(dir, process.platform === 'win32' ? 'claude.exe' : 'claude');
    if (exists(file)) return file;
  }
  return null;
}

/**
 * Whether `claude auth status --json` says the CLI is signed in (LA-PLT-UC19-R10): false only when it says it is not
 * and has no other way in (no API key or helper), null when its answer cannot be read.
 */
export function signedInFrom(output: string): boolean | null {
  try {
    const status = JSON.parse(output) as { loggedIn?: unknown; authMethod?: unknown };
    if (status.loggedIn === true) return true;
    if (status.loggedIn === false) return status.authMethod === 'none' || status.authMethod === undefined ? false : null;
    return null;
  } catch {
    return null;
  }
}

/** How long the sign-in check may take before the chat stops waiting for it. */
const STATUS_TIMEOUT_MS = 10_000;

/** Asks the CLI whether it is signed in; null when it cannot tell. It reads only the answer's sign-in fields. */
export function claudeSignedIn(command: string, env: NodeJS.ProcessEnv): Promise<boolean | null> {
  return new Promise((resolve) => {
    execFile(command, ['auth', 'status', '--json'], { env, timeout: STATUS_TIMEOUT_MS, maxBuffer: 64 * 1024 }, (_error, stdout) => resolve(signedInFrom(String(stdout ?? ''))));
  });
}
