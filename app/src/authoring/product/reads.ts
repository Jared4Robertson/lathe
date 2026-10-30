import type { ProductPage, ProductSummary } from '../../../../lathe/src/authoring/product/read-model';
import { useRead, type Read } from '../../record/read';

// The Product aggregate's reads as its page and the nav make them (LA-AUT-RM21): a product's page, by the ID of any
// record in it (get-product), every product as a space (list-products), and the next free ID for an open question or
// an interface under its parent (next-id).

/** The page of the product that holds the record: read again whenever the data is (`version`). */
export const useProduct = (id: string, version: unknown): Read<ProductPage> => useRead<ProductPage>('/api/product/get-product', { id }, version);

/** Every product, as the nav's space rail lists it. */
export const useProducts = (version: unknown): Read<ProductSummary[]> => useRead<ProductSummary[]>('/api/product/list-products', {}, version);

/** The product's interfaces, each with its kind (list-interfaces), as the pages that name an interface show it. */
export const useInterfaces = (product: string, version: unknown): Read<{ id: string; title: string; kind: string }[]> =>
  useRead<{ id: string; title: string; kind: string }[]>('/api/product/list-interfaces', { product_id: product }, version);

/** The next free ID for an open question or an interface under its parent, as the Add form suggests it. */
export const useNextProductId = (kind: 'question' | 'interface', parent: string, version: unknown): Read<string> => useRead<string>('/api/product/next-id', { kind, parent }, version);
