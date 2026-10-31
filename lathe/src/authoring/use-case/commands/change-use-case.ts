import { column, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { UseCaseRow } from '../../../platform/data/tables.ts';
import { changed, USE_CASE_SLICE } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The use case's changes: a column given is set, null clears an optional one; actors, when given, replace the list. */
export type ChangeUseCase = Pick<UseCaseRow, 'id'> & { title?: string; goal?: string; notes?: string | null; actors?: string[] };

export const CHANGE_USE_CASE: CommandDefinition<ChangeUseCase> = {
  id: 'LA-AUT-CMD101',
  slice: USE_CASE_SLICE,
  name: 'change-use-case',
  description: "Changes a use case's title, goal or notes, or its actors (the whole list, in order). Its capability changes only by Move a use case.",
  method: 'POST',
  route: '/api/use-case/change-use-case',
  input: {
    id: column('use_case', 'id', 'required'),
    title: column('use_case', 'title', 'optional'),
    goal: column('use_case', 'goal', 'optional'),
    notes: column('use_case', 'notes', 'clearable'),
    actors: texts('The roles of the product that are its actors, in order: the first is the main actor. Replaces the list.', 'optional'),
  },
  handler: changeUseCase,
};

/** Changes the use case's own columns and actors. */
export function changeUseCase(tx: Transaction, input: ChangeUseCase): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.load(input.id) ?? tx.refuse('missing', `there is no use case ${input.id}`);
  useCase.useCase = changed(useCase.useCase, input, ['title', 'goal', 'notes']);
  if (input.actors) useCase.actors = input.actors;
  holdToRules(tx, useCase);
  useCases.save(useCase);
}
