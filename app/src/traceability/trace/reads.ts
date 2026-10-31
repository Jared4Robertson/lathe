import type { ProductTrace } from '../../../../lathe/src/traceability/trace/read-model';
import { useRead, type Read } from '../../record/read';

// The Trace read as the Trace stage makes it (LA-TRC-RM13): each use case of a product's space once,
// from its outcomes to its acceptance tests (list-trace-rows), with the gaps and tests of the checks' run the server keeps
// for the data.

/** The product's trace rows, as its Trace stage draws them: read again whenever the data is (`version`). */
export const useTraceRows = (product: string, version: unknown): Read<ProductTrace> => useRead<ProductTrace>('/api/trace/list-trace-rows', { product_id: product }, version);
