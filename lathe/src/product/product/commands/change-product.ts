import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ProductRow } from '../../../platform/data/tables.ts';
import { rolesOf, type RoleInput } from '../model.ts';
import { changed } from '../../../platform/data/rows.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_PRODUCT_IDENTITY } from './identities.generated.ts';

/** The product's changes: a column given is set, null clears an optional one; roles, when given, replace the list. */
export type ChangeProduct = Pick<ProductRow, 'id'> & { title?: string; description?: string; icon?: string | null; color?: string | null; notes?: string | null; roles?: RoleInput[] };

export const CHANGE_PRODUCT = {
  ...CHANGE_PRODUCT_IDENTITY,
  input: {
    id: column('product', 'id', 'required'),
    title: column('product', 'title', 'optional'),
    description: column('product', 'description', 'optional'),
    icon: column('product', 'icon', 'clearable'),
    color: column('product', 'color', 'clearable'),
    notes: column('product', 'notes', 'clearable'),
    roles: parts('role', ['name', 'description'], 'The roles its records name, such as Owner or Librarian, each with its name and description. Replaces the list.', 'optional'),
  },
  handler: changeProduct,
} satisfies CommandDefinition<ChangeProduct>;

/** Changes the product's own columns and roles. */
export function changeProduct(tx: Transaction, input: ChangeProduct): void {
  const products = new ProductRepository(tx);
  const product = products.load(input.id) ?? tx.refuse('missing', `there is no product ${input.id}`);
  product.product = changed(product.product, input, ['title', 'description', 'icon', 'color', 'notes']);
  if (input.roles) product.roles = rolesOf(product.root, input.roles);
  holdToRules(tx, product);
  products.save(product);
}
