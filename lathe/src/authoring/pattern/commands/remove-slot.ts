import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { PatternRepository } from '../repository.ts';
import { REMOVE_SLOT_IDENTITY } from './identities.generated.ts';

/** The slot to remove. */
export type RemoveSlot = { id: string };

export const REMOVE_SLOT = {
  ...REMOVE_SLOT_IDENTITY,
  input: {
    id: column('slot', 'id', 'required'),
  },
  handler: removeSlot,
} satisfies CommandDefinition<RemoveSlot>;

/** Removes the slot from its pattern; the store refuses it while a record still fills it. */
export function removeSlot(tx: Transaction, input: RemoveSlot): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('slot', input.id) ?? tx.refuse('missing', `there is no slot ${input.id}`);
  pattern.slots = pattern.slots.filter((s) => s.id !== input.id);
  patterns.save(pattern);
}
