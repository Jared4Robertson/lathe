// The Product reader: the interface the Product aggregate's query handlers depend on to read the Product read model
// (LA-AUT-RM21), and today's implementation over the current data, built by the read model's projection. A handler
// reads through it only, never the aggregate's model or repository.
import type { ReadView } from '../../platform/data/rules.ts';
import { productPagesFrom, productSummariesFrom, type ProductPage, type ProductSummary } from './read-model.ts';

/** What the Product queries read. */
export interface ProductReader {
  /** The kind of the record with this ID, or undefined when there is none. */
  kindOf(id: string): string | undefined;
  /** The product that holds the record (itself, an open question or an interface in it) or declares the product kind of this name. */
  productHolding(id: string): string | undefined;
  /** The product's page. */
  page(product: string): ProductPage;
  /** Every product, as the nav lists it, by ID. */
  products(): ProductSummary[];
  /** The IDs in use of the kind. */
  ids(kind: 'question' | 'interface'): string[];
}

/** The reader over the current data. */
export function productReader(view: ReadView): ProductReader {
  const productOfDomain = (domain: string) => {
    const record = view.record(domain);
    return record?.kind === 'domain' ? String(record.row.product_id) : undefined;
  };
  return {
    kindOf: (id) => view.record(id)?.kind,
    productHolding: (id) => {
      const declared = view.rows('product_kind').find((k) => k.name === id);
      if (declared) return String(declared.product_id);
      const record = view.record(id);
      if (record?.kind === 'product') return id;
      if (record?.kind === 'interface') return String(record.row.product_id);
      if (record?.kind === 'question') return record.row.product_id !== undefined ? String(record.row.product_id) : productOfDomain(String(record.row.domain_id));
      return undefined;
    },
    page: (product) => productPagesFrom(view, product)[0],
    products: () => productSummariesFrom(view),
    ids: (kind) => view.rows(kind).map((r) => String(r.id)),
  };
}
