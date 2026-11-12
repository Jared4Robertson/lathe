// What each record-keeping use case's tests share: its command is refused with its reason when it names a record that is
// not there, changing nothing, and then applied to a data set built with the aggregate's own commands.
import { expect } from 'vitest';
import { ALL_COMMANDS } from '../../../src/commands.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';

/** One command of one aggregate, run on a store the setup gives. */
export interface Keeping {
  /** The store the command runs on. */
  set: () => Promise<Store>;
  /** The command's ID. */
  command: string;
  /** Its input when it is applied. */
  input: Record<string, unknown>;
  /** Its input naming a record that is not there. */
  missing: Record<string, unknown>;
  /** The table the refusal must leave as it was. */
  table: string;
  /** What the store holds once it is applied. */
  applied: (store: Store) => void;
}

/** Runs the command with a record that is not there, expecting its refusal and no change, then applies it. */
export async function keep(keeping: Keeping): Promise<void> {
  const definition = ALL_COMMANDS.find((c) => c.id === keeping.command);
  if (!definition) throw new Error(`there is no command ${keeping.command}`);
  const store = await keeping.set();
  const before = JSON.stringify(store.rows(keeping.table));
  const refusal = await runCommand(store, definition, keeping.missing).then(
    () => Promise.reject(new Error(`${definition.name} was not refused`)),
    (error: unknown) => error as StoreError,
  );
  expect(refusal).toBeInstanceOf(StoreError);
  expect(refusal.problems[0]).toMatchObject({ rule: 'missing' });
  expect(JSON.stringify(store.rows(keeping.table))).toBe(before);
  await runCommand(store, definition, keeping.input);
  keeping.applied(store);
}
