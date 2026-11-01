import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ReadModelRepository } from '../repository.ts';
import { REMOVE_PROJECTION_IDENTITY } from './identities.generated.ts';

/** The projection to remove. */
export type RemoveProjection = { id: string };

export const REMOVE_PROJECTION = {
  ...REMOVE_PROJECTION_IDENTITY,
  input: {
    id: column('projection', 'id', 'required'),
  },
  handler: removeProjection,
} satisfies CommandDefinition<RemoveProjection>;

/** Removes the projection from its read model. */
export function removeProjection(tx: Transaction, input: RemoveProjection): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('projection', input.id) ?? tx.refuse('missing', `there is no projection ${input.id}`);
  readModel.projection = null;
  readModels.save(readModel);
}
