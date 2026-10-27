// A record's history, from git (LA-EXP-UC12): the commits that changed its row, newest first, and one commit's change
// of that row. It backs GET /api/history in api.ts.
//
// - A record is one line of its kind's data file, data/<kind>.jsonl, which starts {"id":"<ID>". The file is found
//   from the data, by the record's ID, never from a path in the request. A commit changed the row when its diff of
//   that file adds or removes a line holding the row (git log -G).
// - git runs with an argument array (no shell), inside the product root, with a time limit and an output cap, and
//   with nothing that writes: no optional locks, no prompts, no pager, no external diff or text conversion. The git
//   config is never read for changes or written.
// - A product folder that is not a git repo, or a machine without git, is an answer, not an error.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../config.ts';

/** How long one git command may run. */
export const GIT_TIME_LIMIT_MS = 5000;
/** The most output one git command may give; past it the output is cut and marked. */
export const GIT_OUTPUT_CAP = 512 * 1024;
/** Commits per page of the list. */
export const HISTORY_PAGE = 20;

export interface HistoryCommit {
  hash: string;
  short: string;
  /** ISO 8601, the author's date. */
  date: string;
  author: string;
  subject: string;
}

export type HistoryAnswer =
  | { state: 'no-record'; id: string }
  | { state: 'no-repo'; id: string; file: string; message: string }
  | {
      state: 'ok';
      id: string;
      /** The data file holding the record's row, relative to the product root. */
      file: string;
      /** The row's change in the working tree not committed yet: 'modified', 'added' (new since the last commit), or null. */
      uncommitted: 'modified' | 'added' | null;
      commits: HistoryCommit[];
      /** Whether older commits are left to load. */
      more: boolean;
    };

export type DiffAnswer =
  | { state: 'no-record'; id: string }
  | { state: 'no-repo'; id: string; file: string; message: string }
  | { state: 'no-commit'; id: string; file: string; commit: string }
  | { state: 'ok'; id: string; file: string; commit: string; diff: string; truncated: boolean };

/** What the history API takes as a commit: a hex hash of 4 to 40 characters, or "working" for the uncommitted changes. */
export const COMMIT_PATTERN = /^(?:[0-9a-f]{4,40}|working)$/;

const ID = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/;

interface GitResult { code: number | null; stdout: string; stderr: string; truncated: boolean; timedOut: boolean; missing: boolean }

/** Runs git with an argument array in `cwd`, never through a shell, cut at the cap and stopped at the time limit. */
export function runGit(cwd: string, args: string[], { timeout = GIT_TIME_LIMIT_MS, cap = GIT_OUTPUT_CAP } = {}): Promise<GitResult> {
  return new Promise((resolve) => {
    const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat', PAGER: 'cat', LC_ALL: 'C' };
    const child = spawn('git', args, { cwd, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    let size = 0;
    let truncated = false;
    let stderr = '';
    let timedOut = false;
    let missing = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeout);
    child.stdout.on('data', (chunk: Buffer) => {
      if (truncated) return;
      if (size + chunk.length > cap) {
        out.push(chunk.subarray(0, cap - size));
        size = cap;
        truncated = true;
        child.kill('SIGTERM');
        return;
      }
      out.push(chunk);
      size += chunk.length;
    });
    child.stderr.on('data', (chunk: Buffer) => { if (stderr.length < 4096) stderr += chunk.toString('utf8'); });
    child.on('error', (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') missing = true; });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout: Buffer.concat(out).toString('utf8'), stderr, truncated, timedOut, missing });
    });
  });
}

/** How a record's row starts in its data file: its id is the first column. */
const rowStart = (id: string) => `{"id":${JSON.stringify(id)},`;
/** A regular expression for git log -G that matches the row's line; an ID holds only capitals, digits and hyphens. */
const rowPattern = (id: string) => `^\\{"id":"${id}",`;

/** The data file holding the record with this ID, relative to the product root, or null when no record has it. */
export async function recordFile(root: string, id: string): Promise<string | null> {
  const config = loadConfig(root);
  if (!ID.test(id) || !existsSync(config.dataDir)) return null;
  const start = rowStart(id);
  for (const name of (await readdir(config.dataDir)).filter((f) => f.endsWith('.jsonl')).sort()) {
    const text = await readFile(path.join(config.dataDir, name), 'utf8');
    if (text.startsWith(start) || text.includes(`\n${start}`)) return path.relative(config.root, path.join(config.dataDir, name)).split(path.sep).join('/');
  }
  return null;
}

/** The lines of a unified diff that change the record's row, under the file's header; empty when none does. */
export function rowDiff(diff: string, id: string): string {
  const start = rowStart(id);
  const lines = diff.split('\n');
  const isHeader = (l: string) => l.startsWith('--- ') || l.startsWith('+++ ');
  const changed = lines.filter((l) => !isHeader(l) && (l.startsWith('+') || l.startsWith('-')) && l.slice(1).startsWith(start));
  return changed.length ? `${[...lines.filter(isHeader), ...changed].join('\n')}\n` : '';
}

/** Whether the product root is inside a git work tree; the reason when it is not. */
async function repoState(root: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await runGit(root, ['rev-parse', '--is-inside-work-tree']);
  if (result.missing) return { ok: false, message: 'git is not installed on this machine, so there is no history to show.' };
  if (result.timedOut) return { ok: false, message: 'git took too long to answer.' };
  if (result.code !== 0 || result.stdout.trim() !== 'true') return { ok: false, message: 'The product folder is not a git repository, so its records have no history yet.' };
  return { ok: true };
}

const FIELD = '\x1f';
const RECORD = '\x1e';

/** Parses `git log` output written with LOG_FORMAT. */
export function parseLog(text: string): HistoryCommit[] {
  return text.split(RECORD).map((r) => r.replace(/^\s+/, '')).filter(Boolean).flatMap((r) => {
    const [hash, short, date, author, subject] = r.split(FIELD);
    return hash && /^[0-9a-f]{40,64}$/.test(hash) ? [{ hash, short, date, author, subject: (subject ?? '').trim() }] : [];
  });
}
const LOG_FORMAT = `--format=%H${FIELD}%h${FIELD}%aI${FIELD}%an${FIELD}%s${RECORD}`;
const DIFF_FLAGS = ['--no-color', '--no-ext-diff', '--no-textconv'];

/** The row's uncommitted change against HEAD: 'added' when the row is new, 'modified' when it changed, or null. */
async function uncommitted(root: string, file: string, id: string): Promise<{ state: 'modified' | 'added' | null; diff: string; truncated: boolean }> {
  const tracked = (await runGit(root, ['ls-files', '--error-unmatch', '--', file])).code === 0;
  const hasHead = (await runGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD'])).code === 0;
  // An untracked file is shown as wholly added; `git diff --no-index` exits 1 when the files differ, as they do here.
  const result = tracked && hasHead
    ? await runGit(root, ['diff', ...DIFF_FLAGS, 'HEAD', '--', file])
    : await runGit(root, ['diff', ...DIFF_FLAGS, '--no-index', '--', '/dev/null', file]);
  const diff = rowDiff(result.stdout, id);
  if (!diff) return { state: null, diff: '', truncated: result.truncated };
  const start = rowStart(id);
  const removed = diff.split('\n').some((l) => l.startsWith('-') && !l.startsWith('--- ') && l.slice(1).startsWith(start));
  return { state: removed ? 'modified' : 'added', diff, truncated: result.truncated };
}

/** The commits that changed a record's row, newest first, `skip` in, with whether more remain. */
export async function recordHistory(root: string, id: string, skip = 0): Promise<HistoryAnswer> {
  const config = loadConfig(root);
  const file = await recordFile(config.root, id);
  if (!file) return { state: 'no-record', id };
  const repo = await repoState(config.root);
  if (!repo.ok) return { state: 'no-repo', id, file, message: repo.message };
  const log = await runGit(config.root, ['log', '--no-color', '-E', '-G', rowPattern(id), LOG_FORMAT, `--skip=${Math.max(0, Math.floor(skip))}`, `--max-count=${HISTORY_PAGE + 1}`, '--', file]);
  // A repository with no commits yet answers with an error and no history: that is an empty list.
  const commits = log.code === 0 ? parseLog(log.stdout) : [];
  const { state } = await uncommitted(config.root, file, id);
  return { state: 'ok', id, file, uncommitted: state, commits: commits.slice(0, HISTORY_PAGE), more: commits.length > HISTORY_PAGE };
}

/** One commit's change of a record's row, or its uncommitted change for "working". */
export async function recordDiff(root: string, id: string, commit: string): Promise<DiffAnswer> {
  const config = loadConfig(root);
  const file = await recordFile(config.root, id);
  if (!file) return { state: 'no-record', id };
  const repo = await repoState(config.root);
  if (!repo.ok) return { state: 'no-repo', id, file, message: repo.message };
  if (commit === 'working') {
    const working = await uncommitted(config.root, file, id);
    return { state: 'ok', id, file, commit, diff: working.diff, truncated: working.truncated };
  }
  if (!COMMIT_PATTERN.test(commit)) return { state: 'no-commit', id, file, commit };
  // The row's own history names the commit; a commit that did not change the row is not in it.
  const touched = await runGit(config.root, ['log', '--no-color', '-E', '-G', rowPattern(id), '--format=%H', '--', file]);
  const found = touched.code === 0 ? touched.stdout.split('\n').map((l) => l.trim()).find((h) => /^[0-9a-f]{40,64}$/.test(h) && h.startsWith(commit)) : undefined;
  if (!found) return { state: 'no-commit', id, file, commit };
  const result = await runGit(config.root, ['show', ...DIFF_FLAGS, '--format=', found, '--', file]);
  if (result.code !== 0 && !result.truncated) return { state: 'no-commit', id, file, commit };
  return { state: 'ok', id, file, commit: found, diff: rowDiff(result.stdout, id), truncated: result.truncated };
}
