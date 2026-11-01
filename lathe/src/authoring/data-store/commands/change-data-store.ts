import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { DataStoreRow } from '../../../platform/data/tables.ts';
import { CHANGE_DATA_STORE_IDENTITY } from './identities.generated.ts';
import { changeDataStore } from './handlers.generated.ts';

/** The data store's changes: a column given is set. */
export type ChangeDataStore = Pick<DataStoreRow, 'id'> & { title?: DataStoreRow['title']; kind?: DataStoreRow['kind']; description?: DataStoreRow['description'] };

export const CHANGE_DATA_STORE = {
  ...CHANGE_DATA_STORE_IDENTITY,
  input: {
    id: column('data_store', 'id', 'required'),
    title: column('data_store', 'title', 'optional'),
    kind: column('data_store', 'kind', 'optional'),
    description: column('data_store', 'description', 'optional'),
  },
  handler: changeDataStore,
} satisfies CommandDefinition<ChangeDataStore>;
