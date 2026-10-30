import type { AggregateKind } from '../../../../lathe/src/authoring/aggregate/model';
import type { AggregatePage } from '../../../../lathe/src/authoring/aggregate/read-model';
import { useRead, type Read } from '../../record/read';

// The Aggregate aggregate's reads as its page makes them (LA-AUT-RM26): an aggregate whole as its page shows it, by the
// ID of any record in it (get-aggregate), and the next free ID for a record of one of its kinds under its parent
// (next-id).

/** The aggregate that holds the record, as its page reads it: read again whenever the data is (`version`). */
export const useAggregate = (id: string, version: unknown): Read<AggregatePage> => useRead<AggregatePage>('/api/aggregate/get-aggregate', { id }, version);

/** The next free ID for a record of the kind under its parent, as the editor suggests it. */
export const useNextAggregateId = (kind: AggregateKind, parent: string, version: unknown): Read<string> => useRead<string>('/api/aggregate/next-id', { kind, parent }, version);
