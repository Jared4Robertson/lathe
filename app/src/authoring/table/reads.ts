import type { TablePage } from '../../../../lathe/src/authoring/table/read-model';
import { useRead, type Read } from '../../record/read';

// The Table aggregate's reads as its page makes them (LA-AUT-RM38): a table whole as its page shows it
// (get-table), and the next free ID for a table under its entity, read model or domain (next-id).

/** The table, as its page reads it: read again whenever the data is (`version`). */
export const useTable = (id: string, version: unknown): Read<TablePage> => useRead<TablePage>('/api/table/get-table', { id }, version);

/** The next free ID for a table under its parent, as the Add form suggests it. */
export const useNextTableId = (parent: string, version: unknown): Read<string> => useRead<string>('/api/table/next-id', { parent }, version);
