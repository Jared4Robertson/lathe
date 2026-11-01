import { column, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { UseCaseRow } from '../../../platform/data/tables.ts';
import { newUseCase } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_USE_CASE_IDENTITY } from './identities.generated.ts';

/** A new use case: its row, and its actors' role names in order. */
export type AddUseCase = Pick<UseCaseRow, 'id' | 'title' | 'capability_id' | 'goal' | 'notes'> & { actors?: string[] };

export const ADD_USE_CASE: CommandDefinition<AddUseCase> = {
  ...ADD_USE_CASE_IDENTITY,
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

export function addUseCase(tx: Transaction, input: AddUseCase): void {
  const useCases = new UseCaseRepository(tx);
  const { actors = [], ...row } = input;
  const useCase = useCases.create(newUseCase(row, actors));
  holdToRules(tx, useCase);
  useCases.save(useCase);
}
