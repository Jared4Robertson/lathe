// The command runner: the one place a command's transaction starts. It checks the input against the command's
// fields, runs its handler in a transaction of its own, and commits; a refusal, of the input, the handler or the
// commit, changes nothing.
import type { Store } from '../data/store.ts';
import type { Committed } from '../data/transaction.ts';
import { parseInput, type AnyCommand, type AnyQuery } from './definition.ts';

/** Runs the command on the store with the given arguments; throws InputError or StoreError when it is refused. */
export async function runCommand(store: Store, definition: AnyCommand, args: unknown): Promise<Committed> {
  const input = parseInput(store.schema, definition, args);
  const { committed } = await store.transact((tx) => definition.handler(tx, input));
  return committed;
}

/** Runs the query on the store's current data with the given arguments. */
export function runQuery(store: Store, definition: AnyQuery, args: unknown): unknown {
  return definition.run(store, parseInput(store.schema, definition, args));
}

/** What a command changed, one line per row, then the files it wrote. */
export function committedText(committed: Committed): string {
  if (!committed.changes.length) return 'Nothing changed.';
  const verb = (c: Committed['changes'][number]) => (c.before === null ? 'Added' : c.after === null ? 'Removed' : 'Changed');
  return [
    ...committed.changes.map((c) => `${verb(c)} ${c.table} ${c.key}${c.after ? `: ${JSON.stringify(c.after)}` : ''}`),
    ...committed.files.map((f) => `Wrote ${f}`),
  ].join('\n');
}
