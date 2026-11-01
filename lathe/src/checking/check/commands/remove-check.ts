import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { CheckRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { REMOVE_CHECK_IDENTITY } from './identities.generated.ts';

/** The check to remove. */
export type RemoveCheck = { name: string };

export const REMOVE_CHECK = {
  ...REMOVE_CHECK_IDENTITY,
  input: {
    name: column('check', 'name', 'required'),
  },
  handler: removeCheck,
} satisfies CommandDefinition<RemoveCheck>;

/** Removes the check whole; one of Lathe's own is refused by its rules (LA-CHK-INV02). */
export function removeCheck(tx: Transaction, input: RemoveCheck): void {
  const checks = new CheckRepository(tx);
  const check = checks.load(input.name) ?? tx.refuse('missing', `there is no check ${input.name}`);
  holdToRules(tx, check);
  checks.remove(check);
}
