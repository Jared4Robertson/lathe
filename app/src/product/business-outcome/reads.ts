import type { BusinessOutcomePage } from '../../../../lathe/src/product/business-outcome/read-model';
import { useRead, type Read } from '../../record/read';

// The Business outcome aggregate's reads as its page makes them (LA-PRD-RM36): an outcome's page (get-business-outcome),
// and the next free ID for an outcome of a product (next-id).

/** The outcome's page: read again whenever the data is (`version`). */
export const useBusinessOutcome = (id: string, version: unknown): Read<BusinessOutcomePage> => useRead<BusinessOutcomePage>('/api/business-outcome/get-business-outcome', { id }, version);

/** The next free ID for an outcome of the product, as the Add form suggests it. */
export const useNextBusinessOutcomeId = (product: string, version: unknown): Read<string> => useRead<string>('/api/business-outcome/next-id', { product_id: product }, version);
