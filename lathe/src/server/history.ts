// A record's history, from git (LA-EXP-UC12): the commits that changed its rows, newest first, with the columns each
// changed, and its changes not committed yet. It backs GET /api/history in api.ts.
//
// - A record's rows are its own row in its kind's table, the part rows it owns (such as an entity's fields) and the
//   links it starts. In each of those tables the first column names the record: id, the owner column or source_id.
// - The files are found from the schema and the record's kind, never from a path in the request.
// - git runs with an argument array (no shell), inside the product root, with a time limit and an output cap, and
//   with nothing that writes: no optional locks, no prompts, no pager, no external diff or text conversion.
// - A product folder that is not a git repo, or a machine without git, is an answer, not an error.
import { spawn } from 'node:child_process';
import path from 'node:path';
import type { Row, Value } from '../platform/data/rows.ts';
import type { SchemaDescription, TableDescription } from '../platform/data/schema.ts';
import type { FieldChange, HistoryAnswer, HistoryChange, HistoryCommit } from './contract.ts';
import { compareIds } from '../platform/data/ids.ts';

/** How long one git command may run. */
export const GIT_TIME_LIMIT_MS = 5000;
/** The most output one git command may give; past it the output is cut and marked. */
export const GIT_OUTPUT_CAP = 512 * 1024;
/** Commits per page of the list. */
export const HISTORY_PAGE = 20;
/** How many commits' diffs are read at once. */
const DIFFS_AT_ONCE = 4;

/** A record ID, as the schema shapes them: capitals and digits in parts joined by hyphens. */
const RECORD_ID = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;

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

/** Whether the product root is inside a git work tree; the reason when it is not. */
async function repoState(root: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await runGit(root, ['rev-parse', '--is-inside-work-tree']);
  if (result.missing) return { ok: false, message: 'git is not installed on this machine, so there is no history to show.' };
  if (result.timedOut) return { ok: false, message: 'git took too long to answer.' };
  if (result.code !== 0 || result.stdout.trim() !== 'true') return { ok: false, message: 'The product folder is not a git repository, so its records have no history yet.' };
  return { ok: true };
}

/** The tables that hold a record's rows: its kind's table, the part tables it owns, and the link tables it starts. */
export function recordTables(schema: SchemaDescription, kind: string): TableDescription[] {
  const own = schema.tables[kind];
  if (!own) return [];
  const parts = Object.values(schema.tables).filter((t) =>
    t.role === 'part' && t.ownerColumn && t.foreignKeys.some((fk) => fk.table === kind && fk.columns.length === 1 && fk.columns[0] === t.ownerColumn));
  const links = Object.values(schema.relations)
    .filter((r) => r.pairs.some((p) => p.source === kind))
    .map((r) => schema.tables[r.name])
    .filter((t): t is TableDescription => !!t && t.role === 'link');
  return [own, ...parts.sort((a, b) => a.name.localeCompare(b.name)), ...links.sort((a, b) => a.name.localeCompare(b.name))];
}

/** The column that names the record in a table's rows: the first, which is id, the owner column or source_id. */
const identifying = (table: TableDescription) => table.columns[0].name;

const keyText = (table: TableDescription, row: Row) =>
  table.primaryKey.length === 1 ? String(row[table.primaryKey[0]]) : table.primaryKey.map((c) => `${c} ${row[c]}`).join(', ');
const keyOf = (table: TableDescription, row: Row) => table.primaryKey.map((c) => String(row[c] ?? '')).join('\u0000');

const same = (a: Value | undefined, b: Value | undefined) => JSON.stringify(a) === JSON.stringify(b);

/** Reads a unified diff of data files into the record's rows that it removed and added, then pairs them by key. */
export function changesInDiff(diff: string, tables: Map<string, TableDescription>, id: string): HistoryChange[] {
  const removed = new Map<string, { table: TableDescription; row: Row }>();
  const added = new Map<string, { table: TableDescription; row: Row }>();
  let table: TableDescription | undefined;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const file = line.split(' b/').at(-1) ?? '';
      table = tables.get(path.posix.basename(file).replace(/\.jsonl$/, ''));
      continue;
    }
    if (!table || line.startsWith('+++') || line.startsWith('---')) continue;
    const sign = line[0];
    if (sign !== '+' && sign !== '-') continue;
    let row: unknown;
    try {
      row = JSON.parse(line.slice(1));
    } catch {
      continue;
    }
    if (typeof row !== 'object' || row === null || Array.isArray(row)) continue;
    if ((row as Row)[identifying(table)] !== id) continue;
    (sign === '+' ? added : removed).set(`${table.name}\u0001${keyOf(table, row as Row)}`, { table, row: row as Row });
  }
  const changes: HistoryChange[] = [];
  const allFields = (t: TableDescription, row: Row, side: 'before' | 'after'): FieldChange[] =>
    t.columns.filter((c) => row[c.name] !== undefined).map((c) => ({ name: c.name, [side]: row[c.name] }));
  for (const [key, after] of added) {
    const before = removed.get(key);
    if (!before) {
      changes.push({ table: after.table.name, key: keyText(after.table, after.row), change: 'added', fields: allFields(after.table, after.row, 'after') });
      continue;
    }
    const fields: FieldChange[] = after.table.columns
      .filter((c) => !same(before.row[c.name], after.row[c.name]))
      .map((c) => {
        const f: FieldChange = { name: c.name };
        if (before.row[c.name] !== undefined) f.before = before.row[c.name];
        if (after.row[c.name] !== undefined) f.after = after.row[c.name];
        return f;
      });
    if (fields.length) changes.push({ table: after.table.name, key: keyText(after.table, after.row), change: 'changed', fields });
  }
  for (const [key, before] of removed) {
    if (!added.has(key)) changes.push({ table: before.table.name, key: keyText(before.table, before.row), change: 'removed', fields: allFields(before.table, before.row, 'before') });
  }
  // The record's own row first, then the tables in order.
  const order = [...tables.keys()];
  return changes.sort((a, b) => order.indexOf(a.table) - order.indexOf(b.table) || compareIds(a.key, b.key));
}

const FIELD = '\x1f';
const RECORD = '\x1e';
const LOG_FORMAT = `--format=%H${FIELD}%h${FIELD}%aI${FIELD}%an${FIELD}%s${RECORD}`;

/** Parses `git log` output written with LOG_FORMAT. */
export function parseLog(text: string): Omit<HistoryCommit, 'changes' | 'truncated'>[] {
  return text.split(RECORD).map((r) => r.replace(/^\s+/, '')).filter(Boolean).flatMap((r) => {
    const [hash, short, date, author, subject] = r.split(FIELD);
    return hash && /^[0-9a-f]{40,64}$/.test(hash) ? [{ hash, short, date, author, subject: (subject ?? '').trim() }] : [];
  });
}

/**
 * The pattern git's -G takes (a basic regular expression) for a line whose first column holds the ID: the line starts
 * with {"<column>":"<ID>" and then a comma or the line's end. An ID is capitals, digits and hyphens, so it needs no
 * escaping. The opening brace is written as [{]: a bare leading { is accepted by macOS's regex library but refused by
 * glibc's ("Invalid preceding regular expression"), and \{ means an interval in a basic regular expression.
 */
export const firstColumnPattern = (id: string) => `^[{]"[a-z_]*":"${id}"[,}]`;

export async function inBatches<T, R>(items: T[], size: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) results.push(...(await Promise.all(items.slice(i, i + size).map(task))));
  return results;
}

/**
 * The commits that changed the record's rows, newest first, `skip` in, with what each changed, the changes not
 * committed yet, and whether older commits remain. `kind` is the record's kind, or undefined when no record has the ID.
 */
export async function recordHistory(root: string, dataDir: string, schema: SchemaDescription, id: string, kind: string | undefined, skip = 0): Promise<HistoryAnswer> {
  if (!kind || !RECORD_ID.test(id)) return { state: 'no-record', id };
  const tables = recordTables(schema, kind);
  const byName = new Map(tables.map((t) => [t.name, t]));
  const files = tables.map((t) => path.relative(root, path.join(dataDir, `${t.name}.jsonl`)).split(path.sep).join('/'));
  const repo = await repoState(root);
  if (!repo.ok) return { state: 'no-repo', id, files: files.slice(0, 1), message: repo.message };

  const log = await runGit(root, ['log', '--no-color', LOG_FORMAT, '-G', firstColumnPattern(id), `--skip=${Math.max(0, Math.floor(skip))}`, `--max-count=${HISTORY_PAGE + 1}`, '--', ...files]);
  // A repository with no commits yet answers with an error and no history: that is an empty list.
  const listed = log.code === 0 ? parseLog(log.stdout) : [];
  const page = listed.slice(0, HISTORY_PAGE);
  const flags = ['--no-color', '--no-ext-diff', '--no-textconv', '--unified=0'];
  const commits = await inBatches(page, DIFFS_AT_ONCE, async (c): Promise<HistoryCommit> => {
    const shown = await runGit(root, ['show', '--format=', ...flags, c.hash, '--', ...files]);
    return { ...c, changes: changesInDiff(shown.stdout, byName, id), truncated: shown.truncated };
  });

  // Not committed: the tracked files' changes against HEAD, and untracked files as wholly added.
  const hasHead = (await runGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD'])).code === 0;
  let working = hasHead ? (await runGit(root, ['diff', ...flags, 'HEAD', '--', ...files])).stdout : '';
  const untracked = await runGit(root, ['ls-files', '--others', '--exclude-standard', '--', ...files]);
  for (const file of untracked.stdout.split('\n').filter(Boolean)) {
    // `git diff --no-index` exits 1 when the files differ, as they always do here.
    const whole = await runGit(root, ['diff', ...flags, '--no-index', '--', '/dev/null', file]);
    working += `\n${whole.stdout.replace(/^diff --git a\/\S+ b\/(\S+)/m, `diff --git a/${file} b/${file}`)}`;
  }
  return { state: 'ok', id, files, uncommitted: changesInDiff(working, byName, id), commits, more: listed.length > HISTORY_PAGE };
}
