// Remove a product kind (LA-AUT-CMD124): Removes a product kind's declaration with its fields. Refused while the product has records of the kind, or a relation or kind names it.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { PRODUCT_SLICE } from '../model.ts';
import { ProductRepository } from '../repository.ts';

/** The product kind to remove. */
export type RemoveProductKind = { name: string };

/** Remove a product kind (LA-AUT-CMD124). */
export const REMOVE_PRODUCT_KIND: CommandDefinition<RemoveProductKind> = {
  id: 'LA-AUT-CMD124',
  slice: PRODUCT_SLICE,
  name: 'remove-product-kind',
  description: "Removes a product kind's declaration with its fields. Refused while the product has records of the kind, or a relation or kind names it.",
  method: 'POST',
  route: '/api/product/remove-product-kind',
  input: {
    name: column('product_kind', 'name', 'required'),
  },
  handler: removeProductKind,
};

/** Removes the kind and its fields from the product that declares it. */
export function removeProductKind(tx: Transaction, input: RemoveProductKind): void {
  const products = new ProductRepository(tx);
  const product = products.loadDeclaring(input.name) ?? tx.refuse('missing', `there is no product kind ${input.name}`);
  product.kinds = product.kinds.filter((k) => k.row.name !== input.name);
  products.save(product);
}
