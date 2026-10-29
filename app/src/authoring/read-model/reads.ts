import type { ReadModelKind } from '../../../../lathe/src/authoring/read-model/model';
import type { ReadModelPage } from '../../../../lathe/src/authoring/read-model/read-model';
import { useRead, type Read } from '../../record/read';

// The Read model aggregate's reads as its page makes them (LA-AUT-RM30): a read model whole as its page shows it, by
// the ID of any record in it (get-read-model), and the next free ID for a record under its parent (next-id).

/** The read model that holds the record, as its page reads it: read again whenever the data is (`version`). */
export const useReadModel = (id: string, version: unknown): Read<ReadModelPage> => useRead<ReadModelPage>('/api/read-model/get-read-model', { id }, version);

/** The next free ID for a record of the kind under its parent, as the editor suggests it. */
export const useNextReadModelId = (kind: ReadModelKind, parent: string, version: unknown): Read<string> => useRead<string>('/api/read-model/next-id', { kind, parent }, version);
