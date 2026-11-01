import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_DATA_STORE_IDENTITY } from './identities.generated.ts';
import { removeDataStore } from './handlers.generated.ts';

/** The data store to remove. */
export type RemoveDataStore = { id: string };

export const REMOVE_DATA_STORE = {
  ...REMOVE_DATA_STORE_IDENTITY,
  input: {
    id: column('data_store', 'id', 'required'),
  },
  handler: removeDataStore,
} satisfies CommandDefinition<RemoveDataStore>;
