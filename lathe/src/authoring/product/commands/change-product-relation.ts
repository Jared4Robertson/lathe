import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ProductRelationRow } from '../../../platform/data/tables.ts';
import { changed, relationKey } from '../model.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_PRODUCT_RELATION_IDENTITY } from './identities.generated.ts';

/** The pair's changes: a column given is set, null clears its role. */
export type ChangeProductRelation = Pick<ProductRelationRow, 'name' | 'source_kind' | 'target_kind'> & { role?: ProductRelationRow['role'] | null; forward_label?: string; reverse_label?: string; description?: string };

export const CHANGE_PRODUCT_RELATION = {
  ...CHANGE_PRODUCT_RELATION_IDENTITY,
  input: {
    name: column('product_relation', 'name', 'required'),
    source_kind: column('product_relation', 'source_kind', 'required'),
    target_kind: column('product_relation', 'target_kind', 'required'),
    role: column('product_relation', 'role', 'clearable'),
    forward_label: column('product_relation', 'forward_label', 'optional'),
    reverse_label: column('product_relation', 'reverse_label', 'optional'),
    description: column('product_relation', 'description', 'optional'),
  },
  handler: changeProductRelation,
} satisfies CommandDefinition<ChangeProductRelation>;

/** Changes the pair's role, labels and description. */
export function changeProductRelation(tx: Transaction, input: ChangeProductRelation): void {
  const products = new ProductRepository(tx);
  const product = products.loadDeclaringRelation(input) ?? tx.refuse('missing', `there is no product relation ${relationKey(input)}`);
  product.relations = product.relations.map((r) => (relationKey(r) === relationKey(input) ? changed(r, input, ['role', 'forward_label', 'reverse_label', 'description']) : r));
  holdToRules(tx, product);
  products.save(product);
}
