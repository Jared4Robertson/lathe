import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_READER_IDENTITY } from './identities.generated.ts';
import { removeReader } from './handlers.generated.ts';

/** The reader to remove. */
export type RemoveReader = { id: string };

export const REMOVE_READER = {
  ...REMOVE_READER_IDENTITY,
  input: {
    id: column('reader', 'id', 'required'),
  },
  handler: removeReader,
} satisfies CommandDefinition<RemoveReader>;
