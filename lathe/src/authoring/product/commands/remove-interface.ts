import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { PRODUCT_SLICE } from '../model.ts';
import { ProductRepository } from '../repository.ts';

/** The interface to remove. */
export type RemoveInterface = { id: string };

export const REMOVE_INTERFACE: CommandDefinition<RemoveInterface> = {
  id: 'LA-AUT-CMD134',
  slice: PRODUCT_SLICE,
  name: 'remove-interface',
  description: 'Removes an interface. Refused while a flow goes through it, or anything else references it.',
  method: 'POST',
  route: '/api/product/remove-interface',
  input: {
    id: column('interface', 'id', 'required'),
  },
  handler: removeInterface,
};

/** Removes the interface from its product. */
export function removeInterface(tx: Transaction, input: RemoveInterface): void {
  const products = new ProductRepository(tx);
  const product = products.loadHolding('interface', input.id) ?? tx.refuse('missing', `there is no interface ${input.id}`);
  product.interfaces = product.interfaces.filter((i) => i.id !== input.id);
  products.save(product);
}
