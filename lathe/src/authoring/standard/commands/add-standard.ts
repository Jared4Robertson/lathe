import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { StandardRow } from '../../../platform/data/tables.ts';
import { STANDARD_SLICE, newStandard } from '../model.ts';
import { StandardRepository } from '../repository.ts';

/** A new standard: its row. */
export type AddStandard = Pick<StandardRow, 'id' | 'title' | 'product_id' | 'description'>;

export const ADD_STANDARD: CommandDefinition<AddStandard> = {
  id: 'LA-AUT-CMD200',
  slice: STANDARD_SLICE,
  name: 'add-standard',
  description: 'Adds a standard to its product, with no rules yet.',
  method: 'POST',
  route: '/api/standard/add-standard',
  input: {
    id: column('standard', 'id', 'required'),
    title: column('standard', 'title', 'required'),
    product_id: column('standard', 'product_id', 'required'),
    description: column('standard', 'description', 'required'),
  },
  handler: addStandard,
};

/** Adds the standard, whole and new. */
export function addStandard(tx: Transaction, input: AddStandard): void {
  const standards = new StandardRepository(tx);
  const standard = standards.create(newStandard(input));
  standards.save(standard);
}
