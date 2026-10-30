import type { ProductProblems } from '../../../../lathe/src/checking/problems/read-model';
import { useRead, type Read } from '../../record/read';

// The Problems read as the Checks panel makes it (LA-CHK-RM01): a product's problems by check, errors first, the
// workspace's by check, and the counts (list-problems), worked out by the checks' run the server keeps for the data.

/** The product's problems, as its Checks panel lists them: read again whenever the data is (`version`). */
export const useProblems = (product: string, version: unknown): Read<ProductProblems> => useRead<ProductProblems>('/api/problems/list-problems', { product_id: product }, version);
