import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_CAPABILITY_IDENTITY } from './identities.generated.ts';
import { removeCapability } from './handlers.generated.ts';

/** The capability to remove. */
export type RemoveCapability = { id: string };

export const REMOVE_CAPABILITY = {
  ...REMOVE_CAPABILITY_IDENTITY,
  input: {
    id: column('capability', 'id', 'required'),
  },
  handler: removeCapability,
} satisfies CommandDefinition<RemoveCapability>;
