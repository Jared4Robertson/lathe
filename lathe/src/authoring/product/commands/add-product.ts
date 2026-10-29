// Add a product (LA-AUT-CMD120): Adds a product, the root of a set of specifications, with its roles.
import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ProductRow } from '../../../platform/data/tables.ts';
import { PRODUCT_SLICE, newProduct, type RoleInput } from '../model.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new product: its row, and its roles. */
export type AddProduct = Pick<ProductRow, 'id' | 'title' | 'description' | 'icon' | 'color' | 'notes'> & { roles?: RoleInput[] };

/** Add a product (LA-AUT-CMD120). */
export const ADD_PRODUCT: CommandDefinition<AddProduct> = {
  id: 'LA-AUT-CMD120',
  slice: PRODUCT_SLICE,
  name: 'add-product',
  description: 'Adds a product, the root of a set of specifications, with its roles.',
  method: 'POST',
  route: '/api/product/add-product',
  input: {
    id: column('product', 'id', 'required'),
    title: column('product', 'title', 'required'),
    description: column('product', 'description', 'required'),
    icon: column('product', 'icon', 'optional'),
    color: column('product', 'color', 'optional'),
    notes: column('product', 'notes', 'optional'),
    roles: parts('role', ['name', 'description'], 'The roles its records name, such as Owner or Librarian, each with its name and description.', 'optional'),
  },
  handler: addProduct,
};

/** Adds the product, whole and new, with its roles. */
export function addProduct(tx: Transaction, input: AddProduct): void {
  const products = new ProductRepository(tx);
  const { roles = [], ...row } = input;
  const product = products.create(newProduct(row, roles));
  holdToRules(tx, product);
  products.save(product);
}
