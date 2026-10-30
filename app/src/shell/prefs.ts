import { useSyncExternalStore } from 'react';

// The browser's storage, the plumbing under the app's repositories (an aggregate's own repository.ts is the only code
// that reads or writes its keys). Storage can be missing or throw (private windows, blocked site data), so every read
// and write is guarded and the app works without it: the repository then keeps its aggregate in memory alone.

export type Store = 'local' | 'session';
const storage = (store: Store): Storage | null => {
  try { return store === 'local' ? window.localStorage : window.sessionStorage; } catch { return null; }
};

export function readPref<T>(key: string, fallback: T, valid: (v: unknown) => v is T, store: Store = 'local'): T {
  try {
    const raw = storage(store)?.getItem(key);
    if (raw == null) return fallback;
    const value: unknown = JSON.parse(raw);
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown, store: Store = 'local') {
  try { storage(store)?.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

/** A key's stored text, or null: what a repository compares to see a change made outside it. */
export function storedText(key: string, store: Store = 'local'): string | null {
  try { return storage(store)?.getItem(key) ?? null; } catch { return null; }
}

export const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
export const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A command broke one of its aggregate's rules: the change is refused and nothing is saved. */
export class RuleBroken extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(problems.join(' '));
    this.problems = problems;
  }
}

/** Refuses an instance with every problem its rules find. */
export function refuseBroken(problems: readonly string[]): void {
  if (problems.length > 0) throw new RuleBroken(problems);
}

/**
 * The base of an app aggregate's repository: it loads the aggregate whole from the keys it is kept under and saves it
 * whole, and tells its readers after each save. A load reads the keys again only when their stored text changed (a
 * change made in another tab of the session, or by a test), so every reader shares one value.
 */
export abstract class BrowserRepository<T> {
  readonly #listeners = new Set<() => void>();
  #cached: { stored: string; value: T } | null = null;

  /** The stored text of every key the aggregate is kept under, joined. */
  protected abstract stored(): string;
  /** The aggregate as stored, with anything malformed dropped for its defaults. */
  protected abstract read(): T;
  /** Writes the aggregate whole. */
  protected abstract write(value: T): void;

  /** The aggregate, whole. */
  readonly load = (): T => {
    const stored = this.stored();
    if (!this.#cached || this.#cached.stored !== stored) this.#cached = { stored, value: this.read() };
    return this.#cached.value;
  };

  /** Saves the aggregate whole, and tells every reader. */
  save(value: T): void {
    this.write(value);
    this.#cached = { stored: this.stored(), value };
    for (const listener of this.#listeners) listener();
  }

  readonly subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  };
}

/** An aggregate as its repository holds it, read again after each save. */
export const useAggregate = <T,>(repository: BrowserRepository<T>): T => useSyncExternalStore(repository.subscribe, repository.load, repository.load);
