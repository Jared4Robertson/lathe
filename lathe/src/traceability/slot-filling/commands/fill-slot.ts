import { id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { fillingOf } from '../model.ts';
import { SlotFillingRepository } from '../repository.ts';
import { FILL_SLOT_IDENTITY } from './identities.generated.ts';

/** The technical record and the slot it fills. */
export type FillSlot = { record_id: string; slot_id: string };

export const FILL_SLOT = {
  ...FILL_SLOT_IDENTITY,
  input: {
    record_id: id('The technical record, written by hand, that fills the slot.', 'required'),
    slot_id: id('The slot it fills.', 'required'),
  },
  handler: fillSlot,
} satisfies CommandDefinition<FillSlot>;

/** Adds the fill, new and whole; refused for a record a tooling record generates, since a fill is written by hand. */
export function fillSlot(tx: Transaction, input: FillSlot): void {
  const fillings = new SlotFillingRepository(tx);
  if (fillings.loadFilling(input.record_id, input.slot_id)) tx.refuse('exists', `${input.record_id} already fills ${input.slot_id}`);
  const generator = tx.rows('generates').find((g) => g.target_id === input.record_id);
  if (generator) tx.refuse('fill-is-hand-written', `${String(generator.source_id)} generates ${input.record_id}, so it is derived and cannot fill ${input.slot_id}: a fill is written by hand`);
  const filling = fillings.create({ root: fillingOf(input.record_id, input.slot_id), record: input.record_id, slot: input.slot_id });
  fillings.save(filling);
}
