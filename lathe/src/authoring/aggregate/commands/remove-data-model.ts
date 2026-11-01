import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { AggregateRepository } from '../repository.ts';
import { REMOVE_DATA_MODEL_IDENTITY } from './identities.generated.ts';

/** The data model to remove. */
export type RemoveDataModel = { id: string };

export const REMOVE_DATA_MODEL = {
  ...REMOVE_DATA_MODEL_IDENTITY,
  input: {
    id: column('data_model', 'id', 'required'),
  },
  handler: removeDataModel,
} satisfies CommandDefinition<RemoveDataModel>;

/** Removes the data model from its entity. */
export function removeDataModel(tx: Transaction, input: RemoveDataModel): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('data_model', input.id) ?? tx.refuse('missing', `there is no data model ${input.id}`);
  aggregate.dataModels = aggregate.dataModels.filter((d) => d.row.id !== input.id);
  aggregates.save(aggregate);
}
