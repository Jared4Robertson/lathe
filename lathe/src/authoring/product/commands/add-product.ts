import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ProductRow } from '../../../platform/data/tables.ts';
import { newProduct, type RoleInput } from '../model.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_PRODUCT_IDENTITY } from './identities.generated.ts';

/** A new product: its row, and its roles. */
export type AddProduct = Pick<ProductRow, 'id' | 'title' | 'description' | 'icon' | 'color' | 'notes'> & { roles?: RoleInput[] };

export const ADD_PRODUCT = {
  ...ADD_PRODUCT_IDENTITY,
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
} satisfies CommandDefinition<AddProduct>;

export function addProduct(tx: Transaction, input: AddProduct): void {
  const products = new ProductRepository(tx);
  const { roles = [], ...row } = input;
  const product = products.create(newProduct(row, roles));
  holdToRules(tx, product);
  products.save(product);
}
