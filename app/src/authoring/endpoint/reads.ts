import type { EndpointKind } from '../../../../lathe/src/authoring/endpoint/model';
import type { EndpointPage } from '../../../../lathe/src/authoring/endpoint/read-model';
import { useRead, type Read } from '../../record/read';

// The Endpoint aggregate's reads as its page makes them (LA-AUT-RM33): an endpoint whole as its page shows it, by the ID
// of any record in it (get-endpoint), and the next free ID for a record of one of its kinds under its parent (next-id).

/** The endpoint that holds the record, as its page reads it: read again whenever the data is (`version`). */
export const useEndpoint = (id: string, version: unknown): Read<EndpointPage> => useRead<EndpointPage>('/api/endpoint/get-endpoint', { id }, version);

/** The next free ID for a record of the kind under its parent, as the editor suggests it. */
export const useNextEndpointId = (kind: EndpointKind, parent: string, version: unknown): Read<string> => useRead<string>('/api/endpoint/next-id', { kind, parent }, version);
