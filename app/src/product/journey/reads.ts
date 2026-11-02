import type { JourneyKind } from '../../../../lathe/src/product/journey/model';
import type { JourneyPage } from '../../../../lathe/src/product/journey/read-model';
import type { TraceJourney } from '../../../../lathe/src/traceability/trace/read-model';
import { useRead, type Read } from '../../record/read';

// The Journey aggregate's reads as its page makes them (LA-PRD-RM44): a journey whole as its page shows it, by the ID of
// any record in it (get-journey), and the next free ID for a journey, a step or the journey test under their parent
// (next-id). How far the journey is proved is the Trace read model's (get-journey-proof, LA-TRC-RM13), not the
// aggregate's: the page reads it beside its own.

/** The journey that holds the record, whole as its page shows it: read again whenever the data is (`version`). */
export const useJourney = (id: string, version: unknown): Read<JourneyPage> => useRead<JourneyPage>('/api/journey/get-journey', { id }, version);

/** The next free ID for a record of the kind under its parent, as the editor suggests it. */
export const useNextJourneyId = (kind: JourneyKind, parent: string, version: unknown): Read<string> => useRead<string>('/api/journey/next-id', { kind, parent }, version);

/** How far the journey is proved, rolled up from its steps and its journey test; nothing is read until the journey is known (null). */
export const useJourneyProof = (journey: string | null, version: unknown): Read<TraceJourney> => useRead<TraceJourney>('/api/trace/get-journey-proof', journey === null ? null : { id: journey }, version);
