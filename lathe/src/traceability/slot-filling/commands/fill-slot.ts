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
    record_id: id('The technical record, written by hand, that fills the slot; never a standard or its rule.', 'required'),
    slot_id: id('The slot it fills.', 'required'),
  },
  handler: fillSlot,
} satisfies CommandDefinition<FillSlot>;

/**
 * Adds the fill, new and whole; refused for a record a tooling record generates, since a fill is written by hand, and
 * for a standard or its rule, which is the rules code follows, not code (LA-STD-PRINCIPLES-R06).
 */
export function fillSlot(tx: Transaction, input: FillSlot): void {
  const fillings = new SlotFillingRepository(tx);
  if (fillings.load(fillingOf(input.record_id, input.slot_id))) tx.refuse('exists', `${input.record_id} already fills ${input.slot_id}`);
  const standard = tx.rows('standard').some((s) => s.id === input.record_id) ? 'a standard' : tx.rows('standard_rule').some((r) => r.id === input.record_id) ? 'a standard rule' : undefined;
  if (standard) tx.refuse('standard-fills-no-slot', `${input.record_id} is ${standard}, the rules that code follows and not code, so it cannot fill ${input.slot_id}: an engineering standard is accounted for through the records that meet its rules`);
  const generator = tx.rows('generates').find((g) => g.target_id === input.record_id);
  if (generator) tx.refuse('fill-is-hand-written', `${String(generator.source_id)} generates ${input.record_id}, so it is derived and cannot fill ${input.slot_id}: a fill is written by hand`);
  const filling = fillings.create({ root: fillingOf(input.record_id, input.slot_id), fills: { source_id: input.record_id, target_id: input.slot_id } });
  fillings.save(filling);
}
