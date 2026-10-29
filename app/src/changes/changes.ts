import { createContext, useContext } from 'react';
import { applyDelta, recordChanges, rowDelta, type Delta, type RecordChange, type Tables } from '../../../lathe/src/changes';
import type { BaselineAnswer } from '../../../lathe/src/server/baseline';
import type { SpecIndex, SpecSource } from '../specs/data';

export type { BaselineAnswer, Delta, RecordChange, Tables };

// What changed in the product (LA-EXP-UC13): the engine's one record diff (lathe/src/changes.ts) between the data now
// and a baseline, and the live changes as the data reloads. Three baselines: the last commit (the default), where the
// branch left the default branch, and the moment the Reader last looked at the product, kept in the session setting
// as the commit it was on and the rows that differed from it then (a LookMark). The live changes are the diff of each
// reload against the data before it, each noted with when it landed: the stages mark them (marks.ts), Follow glides
// to them, and the Changes panel puts them first.

/** The baselines the Changes lens compares with. */
export type Since = 'commit' | 'branch' | 'looked';
export const SINCES: readonly Since[] = ['commit', 'branch', 'looked'];
/** Each baseline as the picker names it. */
export const SINCE_LABELS: Record<Since, string> = { commit: 'Since the last commit', branch: 'Since the branch left main', looked: 'Since I last looked' };

/** The moment the Reader last looked at a product: the commit it was on (null with no git) and the rows that differed from it then. */
export interface LookMark { commit: string | null; delta: Delta; at: string }

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

// ---------- The product's rows ----------

/** The product folder's rows as served: the source whose data folder holds the product's own record. */
export function productSource(index: SpecIndex, product: string): SpecSource | null {
  const file = index.byId.get(product)?.file;
  if (!file) return null;
  const dir = file.slice(0, file.lastIndexOf('/'));
  return index.workspace.sources.find((s) => s.dataDir.replace(/\/+$/, '') === dir) ?? null;
}

/** Every record change from one load of the workspace to the next, folder by folder. */
export function reloadChanges(before: SpecIndex, after: SpecIndex): RecordChange[] {
  const was = new Map(before.workspace.sources.map((s) => [s.dataDir, s.tables]));
  return after.workspace.sources.flatMap((s) => recordChanges(after.workspace.schema, was.get(s.dataDir) ?? {}, s.tables));
}

// ---------- Baselines ----------

/** What the lens compares with: the baseline's rows and what names it, or why there is none. */
export type Baseline =
  | { state: 'loading' }
  | { state: 'none'; message: string }
  | { state: 'ok'; tables: Tables; label: string; detail: string };

const known = new Map<string, Promise<BaselineAnswer>>();

/** Asks the server for the product's rows at a baseline; a commit's are asked for once, the moving ones on every `fresh`. */
export function fetchBaseline(product: string, since: 'commit' | 'branch' | { commit: string }, fresh = false): Promise<BaselineAnswer> {
  const key = `${product}\u0000${typeof since === 'string' ? since : since.commit}`;
  const cached = known.get(key);
  if (cached && (!fresh || typeof since !== 'string')) return cached;
  const asked = (async (): Promise<BaselineAnswer> => {
    const res = await fetch(`/api/baseline?product=${encodeURIComponent(product)}&since=${encodeURIComponent(typeof since === 'string' ? since : since.commit)}`, { headers: { accept: 'application/json' } });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || typeof body !== 'object' || !('state' in body)) return { state: 'no-commit', message: body?.error ?? `The server answered ${res.status}.` };
    return body as BaselineAnswer;
  })();
  known.set(key, asked);
  asked.catch(() => known.delete(key));
  return asked;
}

const shortDay = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/** The baseline's rows for the Reader's choice, with how the panel and the card name it. */
export async function loadBaseline(index: SpecIndex, product: string, since: Since, mark: LookMark | undefined, fresh: boolean): Promise<Baseline> {
  const schema = index.workspace.schema;
  if (since === 'looked') {
    if (!mark) return { state: 'none', message: "You haven't looked at this product before in this session." };
    const at = `you last looked, ${shortDay(mark.at)}`;
    if (mark.commit === null) return { state: 'ok', tables: applyDelta(schema, {}, mark.delta), label: 'since you last looked', detail: at };
    const answer = await fetchBaseline(product, { commit: mark.commit });
    if (answer.state !== 'ok') return { state: 'none', message: answer.message };
    return { state: 'ok', tables: applyDelta(schema, answer.tables, mark.delta), label: 'since you last looked', detail: at };
  }
  const answer = await fetchBaseline(product, since, fresh);
  if (answer.state !== 'ok') return { state: 'none', message: answer.message };
  const detail = `${answer.short} ${answer.subject}`;
  return since === 'commit'
    ? { state: 'ok', tables: answer.tables, label: 'since the last commit', detail }
    : { state: 'ok', tables: answer.tables, label: `since the branch left ${answer.base ?? 'main'}`, detail };
}

/** The moment now, as a LookMark: the last commit and the rows that differ from it (every row, with no git). */
export async function markNow(index: SpecIndex, product: string): Promise<LookMark | null> {
  const source = productSource(index, product);
  if (!source) return null;
  const schema = index.workspace.schema;
  const at = new Date().toISOString();
  const head = await fetchBaseline(product, 'commit', true).catch(() => null);
  if (head?.state === 'ok') return { commit: head.commit, delta: rowDelta(schema, head.tables, source.tables), at };
  return { commit: null, delta: rowDelta(schema, {}, source.tables), at };
}

/** The changes from a baseline to the product's rows now. */
export function changesSince(index: SpecIndex, product: string, baseline: Tables): RecordChange[] {
  const source = productSource(index, product);
  return source ? recordChanges(index.workspace.schema, baseline, source.tables) : [];
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

/** The changes the app shares (ChangesProvider in App.tsx): the lens, its baseline's diff, Follow and the live store. */
export interface ChangesApi {
  /** The product in view, or null on the picker. */
  product: string | null;
  lens: boolean;
  setLens: (on: boolean) => void;
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
}

const NONE: ChangesApi = {
  product: null, lens: false, setLens: () => {}, since: 'commit', setSince: () => {}, follow: false, setFollow: () => {}, followNote: null,
  baseline: { state: 'loading' }, changes: [], byId: new Map(), live: createLiveStore(),
};
export const ChangesContext = createContext<ChangesApi>(NONE);
export const useChanges = () => useContext(ChangesContext);

/** How many records changed, by change, for the panel's toggle and heading: "3 changed · 1 new · 1 removed". */
export function changeCounts(changes: readonly RecordChange[]) {
  const n = { added: 0, changed: 0, removed: 0 };
  for (const c of changes) n[c.change]++;
  return n;
}
export function countsText(changes: readonly RecordChange[]): string {
  const n = changeCounts(changes);
  const parts = [n.changed && `${n.changed} changed`, n.added && `${n.added} new`, n.removed && `${n.removed} removed`].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No changes';
}

/** "just now", "4 min ago", "2 h ago". */
export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}
