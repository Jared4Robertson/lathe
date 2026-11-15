import type { GuaranteeKind } from '../../../../lathe/src/domain-modeling/guarantee/model';
import type { GuaranteePage } from '../../../../lathe/src/domain-modeling/guarantee/read-model';
import { useRead, type Read } from '../../record/read';

// The Guarantee aggregate's reads as its page makes them (LA-MOD-RM44): a guarantee whole as its page shows it, by the
// ID of any record in it (get-guarantee), and the next free ID for a record under its parent (next-id).

/** The guarantee that holds the record, as its page reads it: read again whenever the data is (`version`). */
export const useGuarantee = (id: string, version: unknown): Read<GuaranteePage> => useRead<GuaranteePage>('/api/guarantee/get-guarantee', { id }, version);

/** The next free ID for a record of the kind under its parent, as the editor suggests it. */
export const useNextGuaranteeId = (kind: GuaranteeKind, parent: string, version: unknown): Read<string> => useRead<string>('/api/guarantee/next-id', { kind, parent }, version);
