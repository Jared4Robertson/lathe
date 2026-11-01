import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { SpecificationRepository } from '../repository.ts';
import { REMOVE_SPECIFICATION_IDENTITY } from './identities.generated.ts';

/** The specification to remove. */
export type RemoveSpecification = { id: string };

export const REMOVE_SPECIFICATION: CommandDefinition<RemoveSpecification> = {
  ...REMOVE_SPECIFICATION_IDENTITY,
  input: {
    id: column('specification', 'id', 'required'),
  },
  handler: removeSpecification,
};

/** Removes the specification whole. */
export function removeSpecification(tx: Transaction, input: RemoveSpecification): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.load(input.id) ?? tx.refuse('missing', `there is no specification ${input.id}`);
  specifications.remove(specification);
}
