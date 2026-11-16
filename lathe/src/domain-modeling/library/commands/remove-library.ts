import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_LIBRARY_IDENTITY } from './identities.generated.ts';
import { removeLibrary } from './handlers.generated.ts';

/** The library to remove. */
export type RemoveLibrary = { id: string };

export const REMOVE_LIBRARY = {
  ...REMOVE_LIBRARY_IDENTITY,
  input: {
    id: column('library', 'id', 'required'),
  },
  handler: removeLibrary,
} satisfies CommandDefinition<RemoveLibrary>;
