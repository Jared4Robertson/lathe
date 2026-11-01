import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ReadModelRepository } from '../repository.ts';
import { REMOVE_READ_MODEL_IDENTITY } from './identities.generated.ts';

/** The read model to remove. */
export type RemoveReadModel = { id: string };

export const REMOVE_READ_MODEL = {
  ...REMOVE_READ_MODEL_IDENTITY,
  input: {
    id: column('read_model', 'id', 'required'),
  },
  handler: removeReadModel,
} satisfies CommandDefinition<RemoveReadModel>;

/** Removes the read model whole. */
export function removeReadModel(tx: Transaction, input: RemoveReadModel): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.id) ?? tx.refuse('missing', `there is no read model ${input.id}`);
  readModels.remove(readModel);
}
