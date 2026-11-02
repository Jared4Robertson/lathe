import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_REPOSITORY_IDENTITY } from './identities.generated.ts';
import { removeRepository } from './handlers.generated.ts';

/** The repository to remove. */
export type RemoveRepository = { id: string };

export const REMOVE_REPOSITORY = {
  ...REMOVE_REPOSITORY_IDENTITY,
  input: {
    id: column('repository', 'id', 'required'),
  },
  handler: removeRepository,
} satisfies CommandDefinition<RemoveRepository>;
