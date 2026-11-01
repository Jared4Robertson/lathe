import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { StandardRow } from '../../../platform/data/tables.ts';
import { newStandard } from '../model.ts';
import { StandardRepository } from '../repository.ts';
import { ADD_STANDARD_IDENTITY } from './identities.generated.ts';

/** A new standard: its row. */
export type AddStandard = Pick<StandardRow, 'id' | 'title' | 'product_id' | 'type' | 'description'>;

export const ADD_STANDARD = {
  ...ADD_STANDARD_IDENTITY,
  input: {
    id: column('standard', 'id', 'required'),
    title: column('standard', 'title', 'required'),
    product_id: column('standard', 'product_id', 'required'),
    type: column('standard', 'type', 'required'),
    description: column('standard', 'description', 'required'),
  },
  handler: addStandard,
} satisfies CommandDefinition<AddStandard>;

/** Adds the standard, whole and new. */
export function addStandard(tx: Transaction, input: AddStandard): void {
  const standards = new StandardRepository(tx);
  const standard = standards.create(newStandard(input));
  standards.save(standard);
}
