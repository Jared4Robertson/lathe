import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { PatternRepository } from '../repository.ts';
import { REMOVE_PATTERN_IDENTITY } from './identities.generated.ts';

/** The pattern to remove. */
export type RemovePattern = { id: string };

export const REMOVE_PATTERN: CommandDefinition<RemovePattern> = {
  ...REMOVE_PATTERN_IDENTITY,
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
