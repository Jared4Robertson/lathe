import type { ProductTrace, TraceJourney } from '../../../../lathe/src/traceability/trace/read-model';
import { useRead, type Read } from '../../record/read';

// The Trace read as the Trace stage makes it (LA-TRC-RM13): each use case of a product's space once,
// from its outcomes to its acceptance tests (list-traced-use-cases), with the gaps and tests of the checks' run the server keeps
// for the data.

/** The product's trace rows, as its Trace stage draws them: read again whenever the data is (`version`). */
export const useTraceRows = (product: string, version: unknown): Read<ProductTrace> => useRead<ProductTrace>('/api/trace/list-traced-use-cases', { product_id: product }, version);

/** Every journey's proof of the product, in one read (LA-TRC-QRY21). */
export const useJourneyProofs = (product: string, version: unknown): Read<{ product: string; journeys: TraceJourney[] }> => useRead<{ product: string; journeys: TraceJourney[] }>('/api/trace/list-journey-proofs', { product_id: product }, version);
