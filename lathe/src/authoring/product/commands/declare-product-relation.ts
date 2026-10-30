// Declare a product relation (LA-AUT-CMD125): Declares a pair of kinds a relation of the product's own may link: a new name gets its own link table, a name Lathe has gains the pair.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ProductRelationRow } from '../../../platform/data/tables.ts';
import { PRODUCT_SLICE, relationKey } from '../model.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new product relation pair. */
export type DeclareProductRelation = Pick<ProductRelationRow, 'name' | 'source_kind' | 'target_kind' | 'product_id' | 'role' | 'forward_label' | 'reverse_label' | 'description'>;

/** Declare a product relation (LA-AUT-CMD125). */
export const DECLARE_PRODUCT_RELATION: CommandDefinition<DeclareProductRelation> = {
  id: 'LA-AUT-CMD125',
  slice: PRODUCT_SLICE,
  name: 'declare-product-relation',
  description: "Declares a pair of kinds a relation of the product's own may link: a new name gets its own link table, a name Lathe has gains the pair.",
  method: 'POST',
  route: '/api/product/declare-product-relation',
  input: {
    name: column('product_relation', 'name', 'required'),
    source_kind: column('product_relation', 'source_kind', 'required'),
    target_kind: column('product_relation', 'target_kind', 'required'),
    product_id: column('product_relation', 'product_id', 'required'),
    role: column('product_relation', 'role', 'optional'),
    forward_label: column('product_relation', 'forward_label', 'required'),
    reverse_label: column('product_relation', 'reverse_label', 'required'),
    description: column('product_relation', 'description', 'required'),
  },
  handler: declareProductRelation,
};

/** Adds the relation pair to the product that declares it. */
export function declareProductRelation(tx: Transaction, input: DeclareProductRelation): void {
  const products = new ProductRepository(tx);
  const product = products.load(input.product_id) ?? tx.refuse('missing', `there is no product ${input.product_id}`);
  if (products.loadDeclaringRelation(input)) tx.refuse('primary-key', `product relation ${relationKey(input)} is declared already`);
  product.relations.push(input);
  holdToRules(tx, product);
  products.save(product);
}
