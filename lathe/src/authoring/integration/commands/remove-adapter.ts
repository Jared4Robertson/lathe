import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_ADAPTER_IDENTITY } from './identities.generated.ts';
import { removeAdapter } from './handlers.generated.ts';

/** The adapter to remove. */
export type RemoveAdapter = { id: string };

export const REMOVE_ADAPTER = {
  ...REMOVE_ADAPTER_IDENTITY,
  input: {
    id: column('adapter', 'id', 'required'),
  },
  handler: removeAdapter,
} satisfies CommandDefinition<RemoveAdapter>;
