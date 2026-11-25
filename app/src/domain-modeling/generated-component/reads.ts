import type { GeneratedComponentPage } from '../../../../lathe/src/domain-modeling/generated-component/read-model';
import { useRead, type Read } from '../../record/read';

// The Generated component aggregate's reads as its page makes them (LA-MOD-RM45): a generated component's page (get-generated-component), and the next free ID for
// a generated component of a domain (next-id).

/** The generated component's page: read again whenever the data is (`version`). */
export const useGeneratedComponent = (id: string, version: unknown): Read<GeneratedComponentPage> => useRead<GeneratedComponentPage>('/api/generated-component/get-generated-component', { id }, version);

/** The next free ID for a generated component of the domain, as the Add form suggests it. */
export const useNextGeneratedComponentId = (domain: string, version: unknown): Read<string> => useRead<string>('/api/generated-component/next-id', { domain_id: domain }, version);
