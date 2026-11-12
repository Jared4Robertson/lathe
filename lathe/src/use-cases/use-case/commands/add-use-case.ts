import { column, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { UseCaseRow } from '../../../platform/data/tables.ts';
import { ADD_USE_CASE_IDENTITY } from './identities.generated.ts';
import { addUseCase } from './handlers.generated.ts';

/** A new use case: its row, and its actors' role names in order. */
export type AddUseCase = Pick<UseCaseRow, 'id' | 'title' | 'capability_id' | 'goal' | 'result_id' | 'notes'> & { actors?: string[] };

export const ADD_USE_CASE = {
  ...ADD_USE_CASE_IDENTITY,
  input: {
    id: column('use_case', 'id', 'required'),
    title: column('use_case', 'title', 'required'),
    capability_id: column('use_case', 'capability_id', 'required'),
    goal: column('use_case', 'goal', 'required'),
    result_id: column('use_case', 'result_id', 'required'),
    notes: column('use_case', 'notes', 'optional'),
    actors: texts('The roles of the product that are its actors, in order: the first is the main actor.', 'optional'),
  },
  handler: addUseCase,
} satisfies CommandDefinition<AddUseCase>;
