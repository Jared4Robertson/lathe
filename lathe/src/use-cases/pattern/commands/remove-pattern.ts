import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_PATTERN_IDENTITY } from './identities.generated.ts';
import { removePattern } from './handlers.generated.ts';

/** The pattern to remove. */
export type RemovePattern = { id: string };

export const REMOVE_PATTERN = {
  ...REMOVE_PATTERN_IDENTITY,
  input: {
    id: column('pattern', 'id', 'required'),
  },
  handler: removePattern,
} satisfies CommandDefinition<RemovePattern>;
