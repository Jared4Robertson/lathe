import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { AggregateRepository } from '../repository.ts';
import { REMOVE_ENTITY_IDENTITY } from './identities.generated.ts';

/** The entity to remove. */
export type RemoveEntity = { id: string };

export const REMOVE_ENTITY = {
  ...REMOVE_ENTITY_IDENTITY,
  input: {
    id: column('entity', 'id', 'required'),
  },
  handler: removeEntity,
} satisfies CommandDefinition<RemoveEntity>;

/** Removes the entity and its data model from its aggregate. */
export function removeEntity(tx: Transaction, input: RemoveEntity): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('entity', input.id) ?? tx.refuse('missing', `there is no entity ${input.id}`);
  aggregate.entities = aggregate.entities.filter((e) => e.row.id !== input.id);
  aggregate.dataModels = aggregate.dataModels.filter((d) => d.row.entity_id !== input.id);
  aggregates.save(aggregate);
}
