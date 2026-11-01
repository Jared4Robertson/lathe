import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_USE_CASE_IDENTITY } from './identities.generated.ts';
import { removeUseCase } from './handlers.generated.ts';

/** The use case to remove. */
export type RemoveUseCase = { id: string };

export const REMOVE_USE_CASE = {
  ...REMOVE_USE_CASE_IDENTITY,
  input: {
    id: column('use_case', 'id', 'required'),
  },
  handler: removeUseCase,
} satisfies CommandDefinition<RemoveUseCase>;
