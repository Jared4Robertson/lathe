import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { AGGREGATE_SLICE } from '../model.ts';
import { AggregateRepository } from '../repository.ts';

/** The entity to remove. */
export type RemoveEntity = { id: string };

export const REMOVE_ENTITY: CommandDefinition<RemoveEntity> = {
  id: 'LA-AUT-CMD215',
  slice: AGGREGATE_SLICE,
  name: 'remove-entity',
  description: 'Removes an entity with its fields, its data model and the links they start. Refused while anything else references them: a command under it, its table, or another entity that holds it.',
  method: 'POST',
  route: '/api/aggregate/remove-entity',
  input: {
    id: column('entity', 'id', 'required'),
  },
  handler: removeEntity,
};

/** Removes the entity and its data model from its aggregate. */
export function removeEntity(tx: Transaction, input: RemoveEntity): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('entity', input.id) ?? tx.refuse('missing', `there is no entity ${input.id}`);
  aggregate.entities = aggregate.entities.filter((e) => e.row.id !== input.id);
  aggregate.dataModels = aggregate.dataModels.filter((d) => d.row.entity_id !== input.id);
  aggregates.save(aggregate);
}
