import type { ValueObjectKind } from '../../../../lathe/src/authoring/value-object/model';
import type { ValueObjectPage } from '../../../../lathe/src/authoring/value-object/read-model';
import { useRead, type Read } from '../../record/read';

// The Value object aggregate's reads as its page makes them (LA-AUT-RM29): a value object whole as its page shows it,
// by the ID of any record in it (get-value-object), and the next free ID for a record under its parent (next-id).

/** The value object that holds the record, as its page reads it: read again whenever the data is (`version`). */
export const useValueObject = (id: string, version: unknown): Read<ValueObjectPage> => useRead<ValueObjectPage>('/api/value-object/get-value-object', { id }, version);

/** The next free ID for a record of the kind under its parent, as the editor suggests it. */
export const useNextValueObjectId = (kind: ValueObjectKind, parent: string, version: unknown): Read<string> => useRead<string>('/api/value-object/next-id', { kind, parent }, version);
