import type { ExtensionRecordPage } from '../../../../lathe/src/product/extension-record/read-model';
import { useRead, type Read } from '../../record/read';

// The Extension record aggregate's reads as its page makes them (LA-PRD-RM39): a record of a product's own kind as its
// page shows it (get-extension-record), and the next free ID for a record of a kind under its parent (next-id).

/** The record's page: read again whenever the data is (`version`). */
export const useExtensionRecord = (id: string, version: unknown): Read<ExtensionRecordPage> => useRead<ExtensionRecordPage>('/api/extension-record/get-extension-record', { id }, version);

/** The next free ID for a record of the product kind under the parent, as the Add form suggests it. */
export const useNextExtensionRecordId = (kind: string, parent: string, version: unknown): Read<string> => useRead<string>('/api/extension-record/next-id', { kind, parent }, version);
