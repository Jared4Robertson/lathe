import type { DomainKind } from '../../../../lathe/src/authoring/domain/model';
import type { DomainPage } from '../../../../lathe/src/authoring/domain/read-model';
import { useRead, type Read } from '../../record/read';

// The Domain aggregate's reads as its page makes them (LA-AUT-RM24): a domain whole as its page shows it, by the ID of
// any record in it (get-domain), and the next free ID for a record of one of its numbered kinds under its parent
// (next-id).

/** The domain that holds the record, as its page reads it: read again whenever the data is (`version`). */
export const useDomain = (id: string, version: unknown): Read<DomainPage> => useRead<DomainPage>('/api/domain/get-domain', { id }, version);

/** The next free ID for a record of the kind under its parent, as the editor suggests it. */
export const useNextDomainId = (kind: Exclude<DomainKind, 'domain'>, parent: string, version: unknown): Read<string> => useRead<string>('/api/domain/next-id', { kind, parent }, version);
