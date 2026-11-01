import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_INTERFACE_IDENTITY } from './identities.generated.ts';
import { removeInterface } from './handlers.generated.ts';

/** The interface to remove. */
export type RemoveInterface = { id: string };

export const REMOVE_INTERFACE = {
  ...REMOVE_INTERFACE_IDENTITY,
  input: {
    id: column('interface', 'id', 'required'),
  },
  handler: removeInterface,
} satisfies CommandDefinition<RemoveInterface>;
