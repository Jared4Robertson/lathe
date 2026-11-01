import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { SlotRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { PatternRepository } from '../repository.ts';
import { CHANGE_SLOT_IDENTITY } from './identities.generated.ts';

/** The slot's changes: a column given is set. */
export type ChangeSlot = Pick<SlotRow, 'id'> & { title?: SlotRow['title']; statement?: SlotRow['statement'] };

export const CHANGE_SLOT = {
  ...CHANGE_SLOT_IDENTITY,
  input: {
    id: column('slot', 'id', 'required'),
    title: column('slot', 'title', 'optional'),
    statement: column('slot', 'statement', 'optional'),
  },
  handler: changeSlot,
} satisfies CommandDefinition<ChangeSlot>;

/** Changes the slot's columns. */
export function changeSlot(tx: Transaction, input: ChangeSlot): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('slot', input.id) ?? tx.refuse('missing', `there is no slot ${input.id}`);
  pattern.slots = pattern.slots.map((s) => (s.id === input.id ? changed(s, input, ['title', 'statement']) : s));
  patterns.save(pattern);
}
