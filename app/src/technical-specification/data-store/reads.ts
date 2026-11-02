import type { DataStorePage } from '../../../../lathe/src/technical-specification/data-store/read-model';
import { useRead, type Read } from '../../record/read';

// The Data store aggregate's reads as its page makes them (LA-TEC-RM43): a data store's page (get-data-store), and the
// next free ID for a data store under a product or a domain (next-id).

/** The data store's page: read again whenever the data is (`version`). */
export const useDataStore = (id: string, version: unknown): Read<DataStorePage> => useRead<DataStorePage>('/api/data-store/get-data-store', { id }, version);

/** The next free ID for a data store under the product or domain, as the Add form suggests it. */
export const useNextDataStoreId = (parent: string, version: unknown): Read<string> => useRead<string>('/api/data-store/next-id', { kind: 'data_store', parent }, version);
