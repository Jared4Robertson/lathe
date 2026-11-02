import type { StorageRequirementKind } from '../../../../lathe/src/domain-modeling/storage-requirement/model';
import type { StorageRequirementPage } from '../../../../lathe/src/domain-modeling/storage-requirement/read-model';
import { useRead, type Read } from '../../record/read';

// The Storage requirement aggregate's reads as its page makes them (LA-MOD-RM42): a storage requirement whole, by the
// ID of any record in it (get-storage-requirement), and the next free ID for a requirement or its test (next-id).

/** The page of the storage requirement that holds the record: read again whenever the data is (`version`). */
export const useStorageRequirement = (id: string, version: unknown): Read<StorageRequirementPage> =>
  useRead<StorageRequirementPage>('/api/storage-requirement/get-storage-requirement', { id }, version);

/** The next free ID for a storage requirement (under an aggregate or read model) or its test, as the Add form suggests it. */
export const useNextStorageRequirementId = (kind: StorageRequirementKind, parent: string, version: unknown): Read<string> =>
  useRead<string>('/api/storage-requirement/next-id', { kind, parent }, version);
