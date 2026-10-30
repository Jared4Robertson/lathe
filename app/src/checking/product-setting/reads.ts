import type { Limits } from '../../../../lathe/src/checking/product-setting/read-model';
import { useRead, type Read } from '../../record/read';

// The Product setting aggregate's read as the Product page makes it (LA-CHK-RM11): a product's limits, its own or the
// defaults (get-limits).

/** The product's limits, as its Limits section reads them: read again whenever the data is (`version`). */
export const useLimits = (product: string, version: unknown): Read<Limits> => useRead<Limits>('/api/product-setting/get-limits', { product_id: product }, version);
