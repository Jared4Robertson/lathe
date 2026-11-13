import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { toDomain } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ReadModelRow } from '../../../platform/data/tables.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { MOVE_READ_MODEL_IDENTITY } from './identities.generated.ts';
import { carryUseCasesWith } from '../../../use-cases/use-case/commands/move-use-case.ts';

/** The read model and the domain it moves to. */
export type MoveReadModel = Pick<ReadModelRow, 'id' | 'domain_id'>;

export const MOVE_READ_MODEL = {
  ...MOVE_READ_MODEL_IDENTITY,
  input: {
    id: column('read_model', 'id', 'required'),
    domain_id: column('read_model', 'domain_id', 'required'),
  },
  handler: moveReadModel,
} satisfies CommandDefinition<MoveReadModel>;

// Renamed under the new domain first, then carryUseCasesWith brings along each use case with one of its queries as its result.
export function moveReadModel(tx: Transaction, input: MoveReadModel): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.id) ?? tx.refuse('missing', `there is no read model ${input.id}`);
  const queries = readModel.queries.map((q) => q.row.id);
  const renames = toDomain(tx, { id: input.id, label: 'read model', domainId: readModel.readModel.domain_id }, input.domain_id);
  readModel.readModel = { ...readModel.readModel, domain_id: input.domain_id };
  holdToRules(tx, readModel);
  readModels.save(readModel);
  readModels.carryRenames(renames);
  carryUseCasesWith(tx, queries.map((id) => renames.get(id) ?? id), input.domain_id);
}
