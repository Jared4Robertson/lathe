import { createContext, useContext } from 'react';
import type { ProductChanges, RecordChange } from '../../../lathe/src/exploring/record-changes/read-model';
import type { ReadRefusal } from '../../../lathe/src/server/contract';
import { readModelChanges } from '../record/read';
import { byIdOrder, type RecordIndex } from '../exploring/record-summaries/record-index';
import { rollupText } from './rollup';

export type { RecordChange };

// What changed in the product (LA-EXP-UC15): the Record changes read (LA-EXP-RM07, list-record-changes), the one record
// diff Lathe has, between the data now and a baseline the server reads from git, and the live changes as the data
// reloads. Three baselines: the last commit (the default), where the branch left the default branch, and the moment
// the Reader last looked at the product, kept in the session setting as the commit it was on and each record's digest
// then (a LookMark). The live changes are the records whose digest (RecordSummary.digest) differs from one reload to
// the next, each noted with when it landed: the stages mark them (marks.ts), Follow glides to them, and the Changes
// panel puts them first.

/** The baselines Highlight changes compares with. */
export type Since = 'commit' | 'branch' | 'looked';
export const SINCES: readonly Since[] = ['commit', 'branch', 'looked'];
/** Each baseline as the picker names it. */
export const SINCE_LABELS: Record<Since, string> = { commit: 'Since the last commit', branch: 'Since the branch left main', looked: 'Since I last looked' };

/** The moment the Reader last looked at a product: the commit it was on (null with no git) and each record's digest then. */
export interface LookMark { commit: string | null; digests: Record<string, string>; at: string }

/** One live change: a record that changed as the data reloaded, when it landed, and what it was. */
export interface LiveMark {
  id: string;
  change: RecordChange['change'];
  kind: string;
  title: string;
  product: string | null;
  /** When it landed: the clock (Date.now) for the panel's "just now", the page's (performance.now) for the marks' animation. */
  at: number;
  t: number;
}

/** A record's change with nothing known of its rows: added, removed or changed, by its digest. */
const recordLevel = (id: string, kind: string, title: string, change: RecordChange['change']): RecordChange =>
  ({ id, kind, title, change, fields: [], parts: [], links: { added: [], removed: [] } });

/** Every record that changed from one read of the space to the next, by its digest. */
export function reloadChanges(before: RecordIndex, after: RecordIndex): RecordChange[] {
  const out: RecordChange[] = [];
  for (const r of after.byId.values()) {
    const was = before.byId.get(r.id);
    if (!was) out.push(recordLevel(r.id, r.kind, r.title, 'added'));
    else if (was.digest !== r.digest) out.push(recordLevel(r.id, r.kind, r.title, 'changed'));
  }
  for (const r of before.byId.values()) if (!after.byId.has(r.id)) out.push(recordLevel(r.id, r.kind, r.title, 'removed'));
  return out.sort(byIdOrder);
}

// ---------- Baselines ----------

/** What Highlight changes compares with: the changes since the baseline and what names it, or why there is none. */
export type Baseline =
  | { state: 'loading' }
  | { state: 'none'; message: string }
  | { state: 'ok'; changes: RecordChange[]; label: string; detail: string };

/** The answers asked, by product and baseline, each with its read model's changes when it was asked (record/read.ts). */
const known = new Map<string, { changes: string; answer: Promise<ProductChanges | ReadRefusal> }>();

const ROUTE = '/api/record-changes/list-record-changes';

/** Asks the Record changes read for the product's changes since a baseline, again only once its read model changed. */
export function fetchChanges(product: string, since: string): Promise<ProductChanges | ReadRefusal> {
  const key = `${product}\u0000${since}`;
  const changes = readModelChanges(ROUTE);
  const cached = known.get(key);
  if (cached?.changes === changes) return cached.answer;
  const answer = (async (): Promise<ProductChanges | ReadRefusal> => {
    const res = await fetch(`${ROUTE}?${new URLSearchParams({ product_id: product, since })}`, { headers: { accept: 'application/json' } });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || typeof body !== 'object' || !('baseline' in body)) return { error: body?.error ?? `The server answered ${res.status}.` };
    return body as ProductChanges;
  })();
  known.set(key, { changes, answer });
  answer.catch(() => { if (known.get(key)?.answer === answer) known.delete(key); });
  return answer;
}

const shortDay = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/** The changes of the space's records since the look: those whose digest differs from the one the look kept, with what the read knows of each. */
function sinceLook(index: RecordIndex, mark: LookMark, read: RecordChange[]): RecordChange[] {
  const detail = new Map(read.map((c) => [c.id, c]));
  const out: RecordChange[] = [];
  for (const r of index.byId.values()) {
    const was = mark.digests[r.id];
    if (was === r.digest) continue;
    const change = was === undefined ? 'added' : 'changed';
    const known = detail.get(r.id);
    out.push(known && (known.change === change || change === 'changed') ? { ...known, change } : recordLevel(r.id, r.kind, r.title, change));
  }
  for (const id of Object.keys(mark.digests)) {
    if (index.byId.has(id)) continue;
    out.push(detail.get(id) ?? recordLevel(id, '', id, 'removed'));
  }
  return out.sort(byIdOrder);
}

/** The changes since the Reader's choice of baseline, with how the panel and the card name it. */
export async function loadBaseline(index: RecordIndex, product: string, since: Since, mark: LookMark | undefined): Promise<Baseline> {
  if (since === 'looked') {
    if (!mark) return { state: 'none', message: "You haven't looked at this product before in this session." };
    const detail = `you last looked, ${shortDay(mark.at)}`;
    if (mark.commit === null) return { state: 'ok', changes: sinceLook(index, mark, []), label: 'since you last looked', detail };
    const answer = await fetchChanges(product, mark.commit);
    if (!('baseline' in answer)) return { state: 'none', message: answer.error };
    return { state: 'ok', changes: sinceLook(index, mark, answer.changes), label: 'since you last looked', detail };
  }
  const answer = await fetchChanges(product, since);
  if (!('baseline' in answer)) return { state: 'none', message: answer.error };
  const { baseline } = answer;
  if (baseline.state !== 'ok') return { state: 'none', message: baseline.message };
  const detail = `${baseline.short} ${baseline.subject}`;
  return since === 'commit'
    ? { state: 'ok', changes: answer.changes, label: 'since the last commit', detail }
    : { state: 'ok', changes: answer.changes, label: `since the branch left ${baseline.base ?? 'main'}`, detail };
}

/** The moment now, as a LookMark: the last commit (null with no git) and each record's digest. */
export async function markNow(index: RecordIndex, product: string): Promise<LookMark> {
  const at = new Date().toISOString();
  const digests = Object.fromEntries([...index.byId.values()].map((r) => [r.id, r.digest]));
  const head = await fetchChanges(product, 'commit').catch(() => null);
  const commit = head && 'baseline' in head && head.baseline.state === 'ok' ? head.baseline.commit : null;
  return { commit, digests, at };
}

// ---------- Live changes ----------

/** The live changes since the page loaded: each record's latest, until the Reader looks at its product. */
export function createLiveStore() {
  const marks = new Map<string, LiveMark>();
  const listeners = new Set<() => void>();
  let version = 0;
  const changed = () => { version++; for (const l of listeners) l(); };
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    version: () => version,
    get: (id: string) => marks.get(id),
    all: () => [...marks.values()],
    /** Notes a reload's changes, each record's product read from the data after it (before it, for one removed). */
    note(changes: readonly RecordChange[], productOf: (id: string) => string | null) {
      if (changes.length === 0) return;
      const at = Date.now();
      const t = performance.now();
      for (const c of changes) {
        const was = marks.get(c.id);
        // A record added and then changed is still new; one added and then removed was never there.
        if (was?.change === 'added' && c.change === 'removed') { marks.delete(c.id); continue; }
        const change = was?.change === 'added' && c.change === 'changed' ? 'added' : was?.change === 'removed' && c.change === 'added' ? 'changed' : c.change;
        marks.set(c.id, { id: c.id, change, kind: c.kind, title: c.title, product: productOf(c.id), at, t });
      }
      changed();
    },
    /** The Reader looked at the product: its marks go. */
    clear(product: string) {
      let any = false;
      for (const [id, m] of marks) if (m.product === product) { marks.delete(id); any = true; }
      if (any) changed();
    },
  };
}
export type LiveStore = ReturnType<typeof createLiveStore>;

// ---------- What the page shares ----------

/** Claude's changes under review (LA-EXP-UC15-R08): one turn's changed records, which Highlight changes then shows alone and the Next and Previous change keys walk. */
export interface Review {
  /** How the panel and the card name it: "Claude's changes, turn 3". */
  label: string;
  changes: readonly RecordChange[];
}

/** The changes the app shares (ChangesProvider in App.tsx): Highlight changes, its baseline's diff, Follow and the live store. */
export interface ChangesApi {
  /** The product in view, or null on the picker. */
  product: string | null;
  highlight: boolean;
  setHighlight: (on: boolean) => void;
  since: Since;
  setSince: (since: Since) => void;
  follow: boolean;
  /** Turns Follow on or off; `note` says why it went off, for the note under the toggle. */
  setFollow: (on: boolean, note?: string) => void;
  /** Why Follow went off last, shown for a few seconds. */
  followNote: string | null;
  baseline: Baseline;
  /** The product's changes from the baseline, in ID order, and each by ID. */
  changes: readonly RecordChange[];
  byId: ReadonlyMap<string, RecordChange>;
  live: LiveStore;
  /** The turn of Claude's being reviewed, whose changes replace the baseline's and the live marks while it lasts; null when none. */
  review: Review | null;
  setReview: (review: Review | null) => void;
}

const NONE: ChangesApi = {
  product: null, highlight: false, setHighlight: () => {}, since: 'commit', setSince: () => {}, follow: false, setFollow: () => {}, followNote: null,
  baseline: { state: 'loading' }, changes: [], byId: new Map(), live: createLiveStore(), review: null, setReview: () => {},
};
export const ChangesContext = createContext<ChangesApi>(NONE);
export const useChanges = () => useContext(ChangesContext);

/** How many records changed, by change, for the panel's toggle and heading: "1 new · 3 changed · 1 removed". */
export function changeCounts(changes: readonly RecordChange[]) {
  const n = { added: 0, changed: 0, removed: 0 };
  for (const c of changes) n[c.change]++;
  return n;
}
export function countsText(changes: readonly RecordChange[]): string {
  return rollupText(changeCounts(changes)) || 'No changes';
}

/** "just now", "4 min ago", "2 h ago". */
export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}
