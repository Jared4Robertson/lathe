// The browser's storage under the app's repositories: an aggregate's model names its keys in its storage setting, and
// its generated repository.ts is the only code that reads or writes them. Storage can be missing or throw (private
// windows, blocked site data), so every read and write is guarded and the app works without it: the repository then
// keeps its aggregate in memory alone. No imports: the desktop app's tests compile a model that names this, under Node.

type Store = 'local' | 'session';
const storage = (store: Store): Storage | null => {
  try { return store === 'local' ? window.localStorage : window.sessionStorage; } catch { return null; }
};

/** One part of an app aggregate kept in browser storage: its key and the storage that keeps it. */
export interface StoredPart { readonly key: string; readonly store: Store }
/** One part kept in memory alone: while the window is open, not through a reload. */
export interface MemoryPart { readonly store: 'memory' }
/**
 * Where an app aggregate is kept, its model's storage setting (LA-PAT-AGGREGATE-COMMANDS-R16): whole under one key, or
 * part by part, each under its own key or in memory. Its repository is generated from it and the model's
 * <aggregate>From (the aggregate from its stored form, anything malformed dropped for its defaults) and, when the stored
 * form is not the aggregate itself, <aggregate>Stored.
 */
export type BrowserStorage = StoredPart | { readonly [part: string]: StoredPart | MemoryPart };
/** An aggregate's stored form part by part, each value as read and not yet checked: what its <aggregate>From takes. */
export type StoredParts<S> = { readonly [P in keyof S]: unknown };

/** A part's stored text, or null: what a repository compares to see a change made outside it. */
export function storedText({ key, store }: StoredPart): string | null {
  try { return storage(store)?.getItem(key) ?? null; } catch { return null; }
}

/** A part's stored value, or null when there is none or it is not JSON. */
export function readStored(part: StoredPart): unknown {
  try {
    const raw = storedText(part);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/**
 * Keeps a part's value as JSON, unless its stored text is that already. Held, it writes only over a value already
 * stored: a part read in another form is rewritten in today's, so stale state never lasts.
 */
export function putStored(part: StoredPart, value: unknown, held = false): void {
  const text = JSON.stringify(value);
  const now = storedText(part);
  if (now === text || (held && now === null)) return;
  try { storage(part.store)?.setItem(part.key, text); } catch { /* storage unavailable */ }
}
