// Move a use case (LA-AUT-CMD102): Moves a use case, with everything in it, under another capability of its domain.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { UseCaseRow } from '../../../platform/data/tables.ts';
import { USE_CASE_SLICE } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The use case and the capability it moves to. */
export type MoveUseCase = Pick<UseCaseRow, 'id' | 'capability_id'>;

/** Move a use case (LA-AUT-CMD102). */
export const MOVE_USE_CASE: CommandDefinition<MoveUseCase> = {
  id: 'LA-AUT-CMD102',
  slice: USE_CASE_SLICE,
  name: 'move-use-case',
  description: 'Moves a use case, with everything in it, under another capability of its domain.',
  method: 'POST',
  route: '/api/use-case/move-use-case',
  input: {
    id: column('use_case', 'id', 'required'),
    capability_id: column('use_case', 'capability_id', 'required'),
  },
  handler: moveUseCase,
};

/** Puts the use case under the other capability; what is in it keeps its IDs. */
export function moveUseCase(tx: Transaction, input: MoveUseCase): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.load(input.id) ?? tx.refuse('missing', `there is no use case ${input.id}`);
  if (useCase.useCase.capability_id === input.capability_id) tx.refuse('parent', `${input.id} is already under ${input.capability_id}`);
  useCase.useCase = { ...useCase.useCase, capability_id: input.capability_id };
  holdToRules(tx, useCase);
  useCases.save(useCase);
}
