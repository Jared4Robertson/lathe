import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { SlotRow } from '../../../platform/data/tables.ts';
import { PatternRepository } from '../repository.ts';
import { ADD_SLOT_IDENTITY } from './identities.generated.ts';

/** A new slot. */
export type AddSlot = Pick<SlotRow, 'id' | 'title' | 'pattern_id' | 'statement'>;

export const ADD_SLOT = {
  ...ADD_SLOT_IDENTITY,
  input: {
    id: column('slot', 'id', 'required'),
    title: column('slot', 'title', 'required'),
    pattern_id: column('slot', 'pattern_id', 'required'),
    statement: column('slot', 'statement', 'required'),
  },
  handler: addSlot,
} satisfies CommandDefinition<AddSlot>;

/** Adds the slot to its pattern. */
export function addSlot(tx: Transaction, input: AddSlot): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.load(input.pattern_id) ?? tx.refuse('missing', `there is no pattern ${input.pattern_id}`);
  pattern.slots.push(input);
  patterns.save(pattern);
}
