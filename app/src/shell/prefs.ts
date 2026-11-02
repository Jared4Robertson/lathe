import { useSyncExternalStore } from 'react';

// The plumbing under the app's aggregates: the base of their repositories (kept in browser storage, storage.ts), the
// hook that reads one, and how a command refuses an instance that breaks its aggregate's rules.

export const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
export const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** One way an instance breaks its aggregate's rule: the rule's name, which its record is matched by, and what is wrong. */
export interface RuleProblem { rule: string; message: string }

/** A command broke one of its aggregate's rules: the change is refused and nothing is saved. */
export class RuleBroken extends Error {
  readonly problems: readonly RuleProblem[];
  constructor(problems: readonly RuleProblem[]) {
    super(problems.map((p) => p.message).join(' '));
    this.problems = problems;
  }
}

/** Refuses an instance with every problem its rules find. */
export function refuseBroken(problems: readonly RuleProblem[]): void {
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

  /**
   * The aggregate, whole: the same value until its stored text changes, so it is a stable snapshot for
   * useSyncExternalStore. A read may drop stale state from storage, so the text is taken again after it.
   */
  readonly load = (): T => {
    if (!this.#cached || this.#cached.stored !== this.stored()) {
      const value = this.read();
      this.#cached = { stored: this.stored(), value };
    }
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
