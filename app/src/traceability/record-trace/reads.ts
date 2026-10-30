import type { RecordTrace } from '../../../../lathe/src/traceability/record-trace/read-model';
import { useRead, type Read } from '../../record/read';

export type { RecordTrace };

// The Record trace read as the Record page pattern's Traceability section makes it (LA-TRC-RM06, get-record-trace):
// an obligation's chain and how each owing domain stands on it, a use case's requirements judged, a test's run by, and
// the record's other links by relation, worked out with the checks' run the server keeps for the data.

/** The record's traceability: read again whenever the data is (`version`). */
export const useRecordTrace = (id: string, version: unknown): Read<RecordTrace> => useRead<RecordTrace>('/api/record-trace/get-record-trace', { id }, version);
