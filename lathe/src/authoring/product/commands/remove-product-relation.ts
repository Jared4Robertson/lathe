import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ProductRelationRow } from '../../../platform/data/tables.ts';
import { relationKey } from '../model.ts';
import { ProductRepository } from '../repository.ts';
import { REMOVE_PRODUCT_RELATION_IDENTITY } from './identities.generated.ts';

/** The product relation pair to remove. */
export type RemoveProductRelation = Pick<ProductRelationRow, 'name' | 'source_kind' | 'target_kind'>;

export const REMOVE_PRODUCT_RELATION: CommandDefinition<RemoveProductRelation> = {
  ...REMOVE_PRODUCT_RELATION_IDENTITY,
  input: {
    name: column('product_relation', 'name', 'required'),
    source_kind: column('product_relation', 'source_kind', 'required'),
    target_kind: column('product_relation', 'target_kind', 'required'),
  },
  handler: removeProductRelation,
};

/** Removes the pair from the product that declares it. */
export function removeProductRelation(tx: Transaction, input: RemoveProductRelation): void {
  const products = new ProductRepository(tx);
  const product = products.loadDeclaringRelation(input) ?? tx.refuse('missing', `there is no product relation ${relationKey(input)}`);
  product.relations = product.relations.filter((r) => relationKey(r) !== relationKey(input));
  products.save(product);
}
