import type { ProductDelivery } from '../../../../lathe/src/traceability/delivery/read-model';
import { useRead, type Read } from '../../record/read';

// The Delivery read as the Trace stage's Delivery view makes it (LA-TRC-RM13): each use case of a product's space once,
// from its outcomes to its acceptance tests (list-delivery), with the gaps and tests of the checks' run the server keeps
// for the data.

/** The product's Delivery, as its Delivery view draws it: read again whenever the data is (`version`). */
export const useDelivery = (product: string, version: unknown): Read<ProductDelivery> => useRead<ProductDelivery>('/api/delivery/list-delivery', { product_id: product }, version);
