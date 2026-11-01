import { id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { SlotFillingRepository } from '../repository.ts';
import { STOP_FILLING_SLOT_IDENTITY } from './identities.generated.ts';

/** The technical record and the slot it stops filling. */
export type StopFillingSlot = { record_id: string; slot_id: string };

export const STOP_FILLING_SLOT = {
  ...STOP_FILLING_SLOT_IDENTITY,
  input: {
    record_id: id('The technical record that fills the slot.', 'required'),
    slot_id: id('The slot it stops filling.', 'required'),
  },
  handler: stopFillingSlot,
} satisfies CommandDefinition<StopFillingSlot>;

/** Removes the fill whole. */
export function stopFillingSlot(tx: Transaction, input: StopFillingSlot): void {
  const fillings = new SlotFillingRepository(tx);
  const filling = fillings.loadFilling(input.record_id, input.slot_id) ?? tx.refuse('missing', `${input.record_id} does not fill ${input.slot_id}`);
  fillings.remove(filling);
}
