import type { StandardKind } from '../../../../lathe/src/authoring/standard/model';
import type { StandardPage } from '../../../../lathe/src/authoring/standard/read-model';
import { useRead, type Read } from '../../record/read';

// The Standard aggregate's reads as its page makes them (LA-AUT-RM23): a standard whole as its page shows it, by the ID of
// any record in it (get-standard), and the next free ID for a rule or rule test under its parent (next-id).

/** The standard that holds the record, as its page reads it: read again whenever the data is (`version`). */
export const useStandard = (id: string, version: unknown): Read<StandardPage> => useRead<StandardPage>('/api/standard/get-standard', { id }, version);

/** The next free ID for a record of the kind under its parent, as the editor suggests it. */
export const useNextStandardId = (kind: Exclude<StandardKind, 'standard'>, parent: string, version: unknown): Read<string> => useRead<string>('/api/standard/next-id', { kind, parent }, version);
