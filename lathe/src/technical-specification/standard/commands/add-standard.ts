import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { StandardRow } from '../../../platform/data/tables.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { StandardRepository } from '../repository.ts';
import { ADD_STANDARD_IDENTITY } from './identities.generated.ts';

/** A new standard: its row, under its product or a platform domain of it. */
export type AddStandard = Pick<StandardRow, 'id' | 'title' | 'product_id' | 'domain_id' | 'type' | 'description'>;

export const ADD_STANDARD = {
  ...ADD_STANDARD_IDENTITY,
  input: {
    id: column('standard', 'id', 'required'),
    title: column('standard', 'title', 'required'),
    product_id: column('standard', 'product_id', 'optional'),
    domain_id: column('standard', 'domain_id', 'optional'),
    type: column('standard', 'type', 'required'),
    description: column('standard', 'description', 'required'),
  },
  handler: addStandard,
} satisfies CommandDefinition<AddStandard>;

export function addStandard(tx: Transaction, input: AddStandard): void {
  const standards = new StandardRepository(tx);
  if ((input.product_id === undefined) === (input.domain_id === undefined)) {
    tx.refuse('parent', `standard ${input.id} sits under its product or a platform domain of it: give exactly one of product_id and domain_id`);
  }
  if (input.product_id !== undefined && tx.record(input.product_id)?.kind !== 'product') tx.refuse('missing', `there is no product ${input.product_id}`);
  if (input.domain_id !== undefined && tx.record(input.domain_id)?.kind !== 'domain') tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const standard = standards.create({ root: input.id, standard: input, rules: [], ruleTests: [] });
  standards.save(standard);
}
