// Add a use case (LA-AUT-CMD100): Adds a use case under a capability, with its actors in order, the main actor first.
import { column, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { UseCaseRow } from '../../../platform/data/tables.ts';
import { newUseCase, USE_CASE_SLICE } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new use case: its row, and its actors' role names in order. */
export type AddUseCase = Pick<UseCaseRow, 'id' | 'title' | 'capability_id' | 'goal' | 'notes'> & { actors?: string[] };

/** Add a use case (LA-AUT-CMD100). */
export const ADD_USE_CASE: CommandDefinition<AddUseCase> = {
  id: 'LA-AUT-CMD100',
  slice: USE_CASE_SLICE,
  name: 'add-use-case',
  description: 'Adds a use case under a capability, with its actors in order, the main actor first.',
  method: 'POST',
  route: '/api/use-case/add-use-case',
  input: {
    id: column('use_case', 'id', 'required'),
    title: column('use_case', 'title', 'required'),
    capability_id: column('use_case', 'capability_id', 'required'),
    goal: column('use_case', 'goal', 'required'),
    notes: column('use_case', 'notes', 'optional'),
    actors: texts('The roles of the product that are its actors, in order: the first is the main actor.', 'optional'),
  },
  handler: addUseCase,
};

/** Adds the use case, whole and new, with its actors. */
export function addUseCase(tx: Transaction, input: AddUseCase): void {
  const useCases = new UseCaseRepository(tx);
  const { actors = [], ...row } = input;
  const useCase = useCases.create(newUseCase(row, actors));
  holdToRules(tx, useCase);
  useCases.save(useCase);
}
