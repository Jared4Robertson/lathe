// The side bar's History (LA-EXP-UC12-R05): the client of GET /api/history, and a unified diff
// read into lines to draw. The answers' shapes are those of lathe/src/server/history.ts.

export interface HistoryCommit { hash: string; short: string; date: string; author: string; subject: string }

export type HistoryAnswer =
  | { state: 'no-record'; id: string }
  | { state: 'no-repo'; id: string; file: string; message: string }
  | { state: 'ok'; id: string; file: string; uncommitted: 'modified' | 'added' | null; commits: HistoryCommit[]; more: boolean };

export type DiffAnswer =
  | { state: 'no-record'; id: string }
  | { state: 'no-repo'; id: string; file: string; message: string }
  | { state: 'no-commit'; id: string; file: string; commit: string }
  | { state: 'ok'; id: string; file: string; commit: string; diff: string; truncated: boolean };

/** "working" names the changes not committed yet. */
export const WORKING = 'working';

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new Error('This server has no history API.');
  const body = await res.json();
  if (!res.ok && !(body && typeof body === 'object' && 'state' in body)) throw new Error(body?.error ?? `The server answered ${res.status}.`);
  return body as T;
}

export const fetchHistory = (id: string, skip = 0, signal?: AbortSignal) =>
  getJson<HistoryAnswer>(`/api/history?id=${encodeURIComponent(id)}${skip > 0 ? `&skip=${skip}` : ''}`, signal);

export const fetchDiff = (id: string, commit: string, signal?: AbortSignal) =>
  getJson<DiffAnswer>(`/api/history?id=${encodeURIComponent(id)}&commit=${encodeURIComponent(commit)}`, signal);

export type DiffLineKind = 'add' | 'remove' | 'context' | 'hunk' | 'meta';
export interface DiffLine { kind: DiffLineKind; text: string }

/**
 * A unified diff as lines to draw: the file headers (`diff --git`, `index`, `---`, `+++`, modes and
 * renames) as meta, `@@` lines as hunks, then added, removed and unchanged lines.
 */
export function diffLines(diff: string): DiffLine[] {
  const lines = diff.replace(/\n$/, '').split('\n');
  let inHunk = false;
  return lines.filter((l, i) => l !== '' || i < lines.length - 1).map((text) => {
    if (text.startsWith('@@')) { inHunk = true; return { kind: 'hunk', text }; }
    if (text.startsWith('diff --git')) inHunk = false;
    if (!inHunk) return { kind: 'meta', text };
    if (text.startsWith('+')) return { kind: 'add', text };
    if (text.startsWith('-')) return { kind: 'remove', text };
    return { kind: 'context', text };
  });
}

/** A commit's date as the list shows it: "Oct 25, 2026". */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
