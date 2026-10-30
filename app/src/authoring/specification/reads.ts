import type { SpecificationKind } from '../../../../lathe/src/authoring/specification/model';
import type { SpecificationPage } from '../../../../lathe/src/authoring/specification/read-model';
import { useRead, type Read } from '../../record/read';

// The Specification aggregate's reads as its page makes them (LA-AUT-RM25): a specification whole as its page shows
// it, by the ID of any record in it (get-specification), and the next free ID for a record under its parent (next-id).

/** The specification that holds the record, as its page reads it: read again whenever the data is (`version`). */
export const useSpecification = (id: string, version: unknown): Read<SpecificationPage> => useRead<SpecificationPage>('/api/specification/get-specification', { id }, version);

/** The next free ID for a record of the kind under its parent, as the editor suggests it. */
export const useNextSpecificationId = (kind: SpecificationKind, parent: string, version: unknown): Read<string> => useRead<string>('/api/specification/next-id', { kind, parent }, version);
