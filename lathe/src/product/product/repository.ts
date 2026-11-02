// ProductRepository (LA-PRD-REPO01): loads and saves the Product aggregate whole, in its own tables only. A record
// inside a product (an open question) or one of its declarations (a product kind, a product relation) is reached
// through the product that holds it.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { PRODUCT_TABLES, productRows, productsFrom, type Product } from './model.ts';

export class ProductRepository extends AggregateRepository<Product> {
  constructor(tx: Transaction) {
    super(tx, 'ProductRepository', PRODUCT_TABLES);
  }

  protected read(rootId: string): Product | undefined {
    return productsFrom((table) => this.files.rows(table), (domain) => this.productOfDomain(domain), rootId)[0];
  }

  protected rowsOf(product: Product): InstanceRows {
    return productRows(product);
  }

  // The product a domain sits in: the domain is Domain's record, read, never loaded.
  private productOfDomain(domain: string): string | undefined {
    const record = this.tx.record(domain);
    return record?.kind === 'domain' ? String(record.row.product_id) : undefined;
  }

  /** Loads the product that holds the open question with this ID; undefined when there is no such question. */
  loadHoldingQuestion(id: string): Product | undefined {
    const row = this.files.find('question', { id });
    if (!row) return undefined;
    const product = row.product_id !== undefined ? String(row.product_id) : this.productOfDomain(String(row.domain_id));
    return product === undefined ? undefined : this.load(product);
  }

  /** Loads the product that declares the product kind of this name; undefined when no product declares it. */
  loadDeclaring(kindName: string): Product | undefined {
    const row = this.files.find('product_kind', { name: kindName });
    return row ? this.load(String(row.product_id)) : undefined;
  }

  /** Loads the product that declares the relation pair; undefined when no product declares it. */
  loadDeclaringRelation(key: { name: string; source_kind: string; target_kind: string }): Product | undefined {
    const row = this.files.find('product_relation', key);
    return row ? this.load(String(row.product_id)) : undefined;
  }
}
