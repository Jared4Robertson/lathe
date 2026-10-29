// A record's History in the wiki card (LA-V96-R26): the client of GET /api/history. The answers' shapes are
// those of lathe/src/server/contract.ts: the commits that changed a record's rows, each with the
// fields it changed.
import type { HistoryAnswer, HistoryChange, HistoryCommit, Value } from '../../../lathe/src/server/contract';

export type { HistoryAnswer, HistoryChange, HistoryCommit };

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

/** A value as the history shows it: text as written, anything else as JSON. */
export const valueText = (value: Value | undefined) => (value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value));

/** What a change did, in a few words: "statement, title changed", "added", "removed". */
export function changeSummary(change: HistoryChange): string {
  if (change.change !== 'changed') return change.change;
  return `${change.fields.map((f) => f.name.replaceAll('_', ' ')).join(', ')} changed`;
}

/** A commit's date as the list shows it: "Oct 25, 2026". */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
