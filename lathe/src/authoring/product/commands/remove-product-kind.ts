import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ProductRepository } from '../repository.ts';
import { REMOVE_PRODUCT_KIND_IDENTITY } from './identities.generated.ts';

/** The product kind to remove. */
export type RemoveProductKind = { name: string };

export const REMOVE_PRODUCT_KIND = {
  ...REMOVE_PRODUCT_KIND_IDENTITY,
  input: {
    name: column('product_kind', 'name', 'required'),
  },
  handler: removeProductKind,
} satisfies CommandDefinition<RemoveProductKind>;

/** Removes the kind and its fields from the product that declares it. */
export function removeProductKind(tx: Transaction, input: RemoveProductKind): void {
  const products = new ProductRepository(tx);
  const product = products.loadDeclaring(input.name) ?? tx.refuse('missing', `there is no product kind ${input.name}`);
  product.kinds = product.kinds.filter((k) => k.row.name !== input.name);
  products.save(product);
}
