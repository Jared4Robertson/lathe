// The command runner: the one place a command's transaction starts. It checks the input against the command's
// fields, runs its handler in a transaction of its own, and commits; a refusal, of the input, the handler or the
// commit, changes nothing. A query runs the same way without a transaction: its handler is given its read model's
// reader, made over the current data (and, for a query that reads the checks' run, the run over that data).
import type { CheckedProblems, ReadView } from '../data/rules.ts';
import type { Store } from '../data/store.ts';
import type { Committed } from '../data/transaction.ts';
import { parseInput, type AnyCommand, type AnyQuery } from './definition.ts';

/** A command that reads the checks' run is never one of several in a write: each runs alone, after the checks. */
function refuseChecked(definition: AnyCommand): void {
  if (definition.checked) throw new Error(`${definition.id} reads the checks' run, so it runs alone, never as one of several commands in a write.`);
}

/**
 * Runs the command on the store with the given arguments; throws InputError or StoreError when it is refused. A command
 * that reads the checks' run (`checked`) is given the problems they found before the write, and refused without them.
 */
export async function runCommand(store: Store, definition: AnyCommand, args: unknown, checked?: CheckedProblems): Promise<Committed> {
  if (definition.checked && !checked) throw new Error(`${definition.id} reads the checks' run, and it was given none: run the checks first.`);
  const input = parseInput(store.schema, definition, args);
  const { committed } = await store.transact((tx) => definition.handler(tx, input), checked);
  return committed;
}

/**
 * Runs several commands as one write: each input checked against its command's fields before anything runs, then each
 * handler in order in one transaction, and one commit. A refusal of any of them changes nothing; a change set from one
 * write is one reload for every reader.
 */
export async function runCommands(store: Store, steps: readonly (readonly [AnyCommand, unknown])[]): Promise<Committed> {
  for (const [definition] of steps) refuseChecked(definition);
  const inputs = steps.map(([definition, args]) => [definition, parseInput(store.schema, definition, args)] as const);
  const { committed } = await store.transact(async (tx) => {
    for (const [definition, input] of inputs) await definition.handler(tx, input);
  });
  return committed;
}

/** One command of an undo (server/undo.ts): it applies only while its record is there (`present`) or is not (`absent`). */
export interface ConditionalStep {
  definition: AnyCommand;
  input: unknown;
  id: string;
  when: 'present' | 'absent';
}

/**
 * Runs the steps as one write, each only when its record is as it expects at that point (a record an earlier step
 * removed with its parent is not removed again), and one commit: any refusal changes nothing.
 */
export async function runConditionally(store: Store, steps: readonly ConditionalStep[]): Promise<Committed> {
  for (const step of steps) refuseChecked(step.definition);
  const inputs = steps.map((s) => ({ ...s, input: parseInput(store.schema, s.definition, s.input) }));
  const { committed } = await store.transact(async (tx) => {
    for (const step of inputs) {
      if ((tx.record(step.id) !== undefined) !== (step.when === 'present')) continue;
      await step.definition.handler(tx, step.input);
    }
  });
  return committed;
}

/** Runs the query on the current data (a store's, or one with the checks' run) with the given arguments. */
export function runQuery(view: ReadView, definition: AnyQuery, args: unknown): unknown {
  return answerQuery(view, definition, parseInput(view.schema, definition, args));
}

/**
 * The query's answer over the data: its handler is given its read model's reader, made over the data (injected), or
 * the one its holder keeps for it (Store.readerOf). A query that reads the checks' run, or a baseline, is refused over
 * data that comes without one.
 */
export function answerQuery(view: ReadView, definition: AnyQuery, input: unknown): unknown {
  if (definition.checked && !view.checked) throw new Error(`${definition.id} reads the checks' run, and the data it was given comes without one: run the checks first.`);
  if (definition.baseline && !view.baseline) throw new Error(`${definition.id} reads the data at a baseline, and the data it was given comes without one: read the baseline first.`);
  const reader = view.readerOf ? view.readerOf(definition.reader) : definition.reader(view);
  return definition.run(reader as never, input as never);
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
