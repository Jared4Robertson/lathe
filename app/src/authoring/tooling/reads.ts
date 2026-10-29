import type { ToolingPage } from '../../../../lathe/src/authoring/tooling/read-model';
import { useRead, type Read } from '../../record/read';

// The Tooling aggregate's reads as its page makes them (LA-AUT-RM41): a tooling record's page (get-tooling), and
// the next free ID for a tooling record of a domain (next-id).

/** The tooling record's page: read again whenever the data is (`version`). */
export const useTooling = (id: string, version: unknown): Read<ToolingPage> => useRead<ToolingPage>('/api/tooling/get-tooling', { id }, version);

/** The next free ID for a tooling record of the domain, as the Add form suggests it. */
export const useNextToolingId = (domain: string, version: unknown): Read<string> => useRead<string>('/api/tooling/next-id', { domain_id: domain }, version);
