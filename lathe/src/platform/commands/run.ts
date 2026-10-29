// The command runner: the one place a command's transaction starts. It checks the input against the command's
// fields, runs its handler in a transaction of its own, and commits; a refusal, of the input, the handler or the
// commit, changes nothing. A query runs the same way without a transaction: its handler is given its read model's
// reader, made over the current data (and, for a query that reads the checks' run, the run over that data).
import type { ReadView } from '../data/rules.ts';
import type { Store } from '../data/store.ts';
import type { Committed } from '../data/transaction.ts';
import { parseInput, type AnyCommand, type AnyQuery } from './definition.ts';

/** Runs the command on the store with the given arguments; throws InputError or StoreError when it is refused. */
export async function runCommand(store: Store, definition: AnyCommand, args: unknown): Promise<Committed> {
  const input = parseInput(store.schema, definition, args);
  const { committed } = await store.transact((tx) => definition.handler(tx, input));
  return committed;
}

/** Runs the query on the current data (a store's, or one with the checks' run) with the given arguments. */
export function runQuery(view: ReadView, definition: AnyQuery, args: unknown): unknown {
  return answerQuery(view, definition, parseInput(view.schema, definition, args));
}

/**
 * The query's answer over the data: its handler is given its read model's reader, made over the data (injected). A
 * query that reads the checks' run is refused over data that comes without one.
 */
export function answerQuery(view: ReadView, definition: AnyQuery, input: unknown): unknown {
  if (definition.checked && !view.checked) throw new Error(`${definition.id} reads the checks' run, and the data it was given comes without one: run the checks first.`);
  return definition.run((definition.reader ? definition.reader(view) : view) as never, input as never);
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
