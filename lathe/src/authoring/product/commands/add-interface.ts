// Add an interface (LA-AUT-CMD132): Adds an interface of a product: a way it is used, such as its web app, HTTP API or command line.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { InterfaceRow } from '../../../platform/data/tables.ts';
import { PRODUCT_SLICE } from '../model.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new interface. */
export type AddInterface = Pick<InterfaceRow, 'id' | 'title' | 'product_id' | 'kind' | 'description'>;

/** Add an interface (LA-AUT-CMD132). */
export const ADD_INTERFACE: CommandDefinition<AddInterface> = {
  id: 'LA-AUT-CMD132',
  slice: PRODUCT_SLICE,
  name: 'add-interface',
  description: 'Adds an interface of a product: a way it is used, such as its web app, HTTP API or command line.',
  method: 'POST',
  route: '/api/product/add-interface',
  input: {
    id: column('interface', 'id', 'required'),
    title: column('interface', 'title', 'required'),
    product_id: column('interface', 'product_id', 'required'),
    kind: column('interface', 'kind', 'required'),
    description: column('interface', 'description', 'required'),
  },
  handler: addInterface,
};

/** Adds the interface to its product. */
export function addInterface(tx: Transaction, input: AddInterface): void {
  const products = new ProductRepository(tx);
  if (tx.record(input.id)) tx.refuse('primary-key', `interface ${input.id} already exists`);
  const product = products.load(input.product_id) ?? tx.refuse('missing', `there is no product ${input.product_id}`);
  product.interfaces.push(input);
  holdToRules(tx, product);
  products.save(product);
}
