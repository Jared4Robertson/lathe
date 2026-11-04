import type { IntegrationKind } from '../../../../lathe/src/interface-design/integration/model';
import type { IntegrationPage } from '../../../../lathe/src/interface-design/integration/read-model';
import { useRead, type Read } from '../../record/read';

// The Integration aggregate's reads as its page makes them (LA-IXD-RM34): an integration whole as its page shows it, by
// the ID of any record in it (get-integration), and the next free ID for a record of one of its kinds under its parent
// (next-id).

/** The integration that holds the record, as its page reads it: read again whenever the data is (`version`). */
export const useIntegration = (id: string, version: unknown): Read<IntegrationPage> => useRead<IntegrationPage>('/api/integration/get-integration', { id }, version);

/** The next free ID for a record of the kind under its parent, as the editor suggests it. */
export const useNextIntegrationId = (kind: IntegrationKind, parent: string, version: unknown): Read<string> => useRead<string>('/api/integration/next-id', { kind, parent }, version);
