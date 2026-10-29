import type { EntryPointPage } from '../../../../lathe/src/authoring/entry-point/read-model';
import { useRead, type Read } from '../../record/read';

// The Entry point aggregate's reads as its page makes them (LA-AUT-RM40): an entry point's page (get-entry-point), and
// the next free ID for an entry point of a domain (next-id).

/** The entry point's page: read again whenever the data is (`version`). */
export const useEntryPoint = (id: string, version: unknown): Read<EntryPointPage> => useRead<EntryPointPage>('/api/entry-point/get-entry-point', { id }, version);

/** The next free ID for an entry point of the domain, as the Add form suggests it. */
export const useNextEntryPointId = (domain: string, version: unknown): Read<string> => useRead<string>('/api/entry-point/next-id', { domain_id: domain }, version);
