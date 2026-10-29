// Remove a data model (LA-AUT-CMD221): Removes a data model with the links it starts and the packages it uses. Refused while anything else references it.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { AGGREGATE_SLICE } from '../model.ts';
import { AggregateRepository } from '../repository.ts';

/** The data model to remove. */
export type RemoveDataModel = { id: string };

/** Remove a data model (LA-AUT-CMD221). */
export const REMOVE_DATA_MODEL: CommandDefinition<RemoveDataModel> = {
  id: 'LA-AUT-CMD221',
  slice: AGGREGATE_SLICE,
  name: 'remove-data-model',
  description: 'Removes a data model with the links it starts and the packages it uses. Refused while anything else references it.',
  method: 'POST',
  route: '/api/aggregate/remove-data-model',
  input: {
    id: column('data_model', 'id', 'required'),
  },
  handler: removeDataModel,
};

/** Removes the data model from its entity. */
export function removeDataModel(tx: Transaction, input: RemoveDataModel): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('data_model', input.id) ?? tx.refuse('missing', `there is no data model ${input.id}`);
  aggregate.dataModels = aggregate.dataModels.filter((d) => d.row.id !== input.id);
  aggregates.save(aggregate);
}
