import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { CHECK_SLICE } from '../model.ts';
import { CheckRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The check to remove. */
export type RemoveCheck = { name: string };

export const REMOVE_CHECK: CommandDefinition<RemoveCheck> = {
  id: 'LA-CHK-CMD03',
  slice: CHECK_SLICE,
  name: 'remove-check',
  description: "Removes a product's check row, so it no longer runs; Lathe's own checks are read-only.",
  method: 'POST',
  route: '/api/check/remove-check',
  input: {
    name: column('check', 'name', 'required'),
  },
  handler: removeCheck,
};

/** Removes the check whole; one of Lathe's own is refused by its rules (LA-CHK-INV02). */
export function removeCheck(tx: Transaction, input: RemoveCheck): void {
  const checks = new CheckRepository(tx);
  const check = checks.load(input.name) ?? tx.refuse('missing', `there is no check ${input.name}`);
  holdToRules(tx, check);
  checks.remove(check);
}
