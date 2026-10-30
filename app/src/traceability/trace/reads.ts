import type { ProductTraces } from '../../../../lathe/src/traceability/trace/read-model';
import { useRead, type Read } from '../../record/read';

// The Trace read as the Trace stage makes it (LA-TRC-RM11): each obligation of a product's space with its chain, gaps
// and whether only proof is asked of it, and the records coverage reports untraced (list-traces), worked out by the
// checks' run the server keeps for the data.

/** The product's traces, as its Trace stage draws them: read again whenever the data is (`version`). */
export const useTraces = (product: string, version: unknown): Read<ProductTraces> => useRead<ProductTraces>('/api/trace/list-traces', { product_id: product }, version);
