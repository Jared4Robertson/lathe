import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_ENTRY_POINT_IDENTITY } from './identities.generated.ts';
import { removeEntryPoint } from './handlers.generated.ts';

/** The entry point to remove. */
export type RemoveEntryPoint = { id: string };

export const REMOVE_ENTRY_POINT = {
  ...REMOVE_ENTRY_POINT_IDENTITY,
  input: {
    id: column('entry_point', 'id', 'required'),
  },
  handler: removeEntryPoint,
} satisfies CommandDefinition<RemoveEntryPoint>;
