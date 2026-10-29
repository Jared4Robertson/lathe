// Remove a pattern (LA-AUT-CMD192): Removes a pattern whole: its settings, rules and rule tests, and the links they start. Refused while anything outside it references what is in it, such as a follower.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { PATTERN_SLICE } from '../model.ts';
import { PatternRepository } from '../repository.ts';

/** The pattern to remove. */
export type RemovePattern = { id: string };

/** Remove a pattern (LA-AUT-CMD192). */
export const REMOVE_PATTERN: CommandDefinition<RemovePattern> = {
  id: 'LA-AUT-CMD192',
  slice: PATTERN_SLICE,
  name: 'remove-pattern',
  description: 'Removes a pattern whole: its settings, rules and rule tests, and the links they start. Refused while anything outside it references what is in it, such as a follower.',
  method: 'POST',
  route: '/api/pattern/remove-pattern',
  input: {
    id: column('pattern', 'id', 'required'),
  },
  handler: removePattern,
};

/** Removes the pattern whole. */
export function removePattern(tx: Transaction, input: RemovePattern): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.load(input.id) ?? tx.refuse('missing', `there is no pattern ${input.id}`);
  patterns.remove(pattern);
}
