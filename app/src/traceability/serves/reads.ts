import type { RecordServes } from '../../../../lathe/src/traceability/serves/read-model';
import { useRead, type Read } from '../../record/read';

// The Serves read as a record page's Serves line makes it (LA-TRC-RM12, get-serves): the business outcomes the record
// serves, worked out from the data on every read through the use cases that reach it.

/** What the record serves: read again whenever the data is (`version`). */
export const useServes = (id: string, version: unknown): Read<RecordServes> => useRead<RecordServes>('/api/serves/get-serves', { id }, version);
