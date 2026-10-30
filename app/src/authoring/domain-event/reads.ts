import type { DomainEventKind } from '../../../../lathe/src/authoring/domain-event/model';
import type { DomainEventPage } from '../../../../lathe/src/authoring/domain-event/read-model';
import { useRead, type Read } from '../../record/read';

// The Domain event aggregate's reads as its page makes them (LA-AUT-RM27): a domain event whole as its page shows it,
// by its ID or its event type's (get-domain-event), and the next free ID for a record of one of its kinds under its
// parent (next-id).

/** The domain event that holds the record, as its page reads it: read again whenever the data is (`version`). */
export const useDomainEvent = (id: string, version: unknown): Read<DomainEventPage> => useRead<DomainEventPage>('/api/domain-event/get-domain-event', { id }, version);

/** The next free ID for a record of the kind under its parent, as the editor suggests it. */
export const useNextDomainEventId = (kind: DomainEventKind, parent: string, version: unknown): Read<string> => useRead<string>('/api/domain-event/next-id', { kind, parent }, version);
