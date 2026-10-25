// A record's history, from git (LA-EXP-UC12): the commits that touched its spec file, newest
// first, and one commit's diff of that file. It backs GET /api/history in api.ts.
//
// - The file is found from the specs (the record with that ID), never from a path in the request.
// - git runs with an argument array (no shell), inside the product root, with a time limit and an
//   output cap, and with nothing that writes: no optional locks, no prompts, no pager, no external
//   diff or text conversion. The git config is never read for changes or written.
// - A product folder that is not a git repo, or a machine without git, is an answer, not an error.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../config.ts';
import { parseRecordFile } from '../parse.ts';

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
      /** The spec file, relative to the product root. */
      file: string;
      /** Changes in the working tree not committed yet: 'modified', 'added' (staged or untracked), or null. */
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

/** The spec file of the record with this ID, relative to the product root, or null when no record has it. */
export async function recordFile(root: string, id: string): Promise<string | null> {
  const config = loadConfig(root);
  if (!existsSync(config.specsDir)) return null;
  const entries = await readdir(config.specsDir, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .map((e) => path.relative(config.root, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
  for (const file of files) {
    const parsed = parseRecordFile(await readFile(path.join(config.root, file), 'utf8'));
    if (parsed.ok && parsed.record.id === id) return file;
  }
  return null;
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

/** The working tree's state for the file: modified, added (staged or untracked) or clean. */
async function uncommittedState(root: string, file: string): Promise<'modified' | 'added' | null> {
  const status = await runGit(root, ['status', '--porcelain=v1', '--untracked-files=all', '--', file]);
  const line = status.stdout.split('\n').find((l) => l.trim());
  if (!line) return null;
  const code = line.slice(0, 2);
  return code === '??' || code.includes('A') ? 'added' : 'modified';
}

/** The commits that touched a record's spec file, newest first, `skip` in, with whether more remain. */
export async function recordHistory(root: string, id: string, skip = 0): Promise<HistoryAnswer> {
  const config = loadConfig(root);
  const file = await recordFile(config.root, id);
  if (!file) return { state: 'no-record', id };
  const repo = await repoState(config.root);
  if (!repo.ok) return { state: 'no-repo', id, file, message: repo.message };
  const log = await runGit(config.root, ['log', '--follow', '--no-color', LOG_FORMAT, `--skip=${Math.max(0, Math.floor(skip))}`, `--max-count=${HISTORY_PAGE + 1}`, '--', file]);
  // A repository with no commits yet answers with an error and no history: that is an empty list.
  const commits = log.code === 0 ? parseLog(log.stdout) : [];
  const uncommitted = await uncommittedState(config.root, file);
  return { state: 'ok', id, file, uncommitted, commits: commits.slice(0, HISTORY_PAGE), more: commits.length > HISTORY_PAGE };
}

/** One commit's diff of a record's spec file (following renames), or the uncommitted changes for "working". */
export async function recordDiff(root: string, id: string, commit: string): Promise<DiffAnswer> {
  const config = loadConfig(root);
  const file = await recordFile(config.root, id);
  if (!file) return { state: 'no-record', id };
  const repo = await repoState(config.root);
  if (!repo.ok) return { state: 'no-repo', id, file, message: repo.message };
  const flags = ['--no-color', '--no-ext-diff', '--no-textconv'];
  if (commit === 'working') {
    const state = await uncommittedState(config.root, file);
    if (!state) return { state: 'ok', id, file, commit, diff: '', truncated: false };
    // Against HEAD when the file is tracked; an untracked file is shown as wholly added.
    const tracked = await runGit(config.root, ['ls-files', '--error-unmatch', '--', file]);
    const hasHead = (await runGit(config.root, ['rev-parse', '--verify', '--quiet', 'HEAD'])).code === 0;
    const result = tracked.code === 0 && hasHead
      ? await runGit(config.root, ['diff', ...flags, 'HEAD', '--', file])
      : await runGit(config.root, ['diff', ...flags, '--no-index', '--', '/dev/null', file]);
    // `git diff --no-index` exits 1 when the files differ, as they always do here.
    if (result.code !== 0 && result.code !== 1) return { state: 'no-commit', id, file, commit };
    return { state: 'ok', id, file, commit, diff: result.stdout, truncated: result.truncated };
  }
  if (!COMMIT_PATTERN.test(commit)) return { state: 'no-commit', id, file, commit };
  // The file's own history, following renames, names the commit and the file's path(s) in it; a
  // commit that did not touch the file is not in it, so it shows nothing of other files.
  const touched = await fileCommits(config.root, file);
  const found = touched.find((c) => c.hash.startsWith(commit));
  if (!found) return { state: 'no-commit', id, file, commit };
  const result = await runGit(config.root, ['show', '-M', ...flags, '--format=', found.hash, '--', ...found.paths]);
  if (result.code !== 0 && !result.truncated) return { state: 'no-commit', id, file, commit };
  return { state: 'ok', id, file, commit: found.hash, diff: result.stdout.replace(/^\n+/, ''), truncated: result.truncated };
}

/** Every commit that touched the file, following renames, with the file's path or paths (old and new) in each. */
async function fileCommits(root: string, file: string): Promise<{ hash: string; paths: string[] }[]> {
  const log = await runGit(root, ['log', '--follow', '--no-color', '-M', '--name-status', `--format=${RECORD}%H`, '--', file]);
  if (log.code !== 0) return [];
  return log.stdout.split(RECORD).filter((r) => r.trim()).flatMap((r) => {
    const [hash, ...lines] = r.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!hash || !/^[0-9a-f]{40,64}$/.test(hash)) return [];
    const paths = lines.flatMap((l) => l.split('\t').slice(1)).filter(Boolean);
    return [{ hash, paths: paths.length > 0 ? [...new Set(paths)] : [file] }];
  });
}
