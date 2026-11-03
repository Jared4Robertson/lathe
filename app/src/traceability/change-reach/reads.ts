import type { ChangeReach } from '../../../../lathe/src/traceability/change-reach/read-model';
import { useRead, type Read } from '../../record/read';

export type { ChangeReach };

// The Change reach read as a record page's Change reach section and the Graph's light make it (LA-TRC-RM14,
// get-reach): what a change of the record would touch, worked out with the checks' run the server keeps for the
// data.

/** What changing the record would touch, or nothing read for null: read again whenever the data is (`version`). */
export const useChangeReach = (id: string | null, version: unknown): Read<ChangeReach> =>
  useRead<ChangeReach>('/api/change-reach/get-reach', id === null ? null : { ids: id }, version);
