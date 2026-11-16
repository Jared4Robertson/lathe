import type { LibraryPage } from '../../../../lathe/src/domain-modeling/library/read-model';
import { useRead, type Read } from '../../record/read';

// The Library aggregate's reads as its page makes them (LA-MOD-RM46): a library's page (get-library), and the next free ID for
// a library of a domain (next-id).

/** The library's page: read again whenever the data is (`version`). */
export const useLibrary = (id: string, version: unknown): Read<LibraryPage> => useRead<LibraryPage>('/api/library/get-library', { id }, version);

/** The next free ID for a library of the domain, as the Add form suggests it. */
export const useNextLibraryId = (domain: string, version: unknown): Read<string> => useRead<string>('/api/library/next-id', { domain_id: domain }, version);
