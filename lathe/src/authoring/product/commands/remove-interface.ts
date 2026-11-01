import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ProductRepository } from '../repository.ts';
import { REMOVE_INTERFACE_IDENTITY } from './identities.generated.ts';

/** The interface to remove. */
export type RemoveInterface = { id: string };

export const REMOVE_INTERFACE = {
  ...REMOVE_INTERFACE_IDENTITY,
  input: {
    id: column('interface', 'id', 'required'),
  },
  handler: removeInterface,
} satisfies CommandDefinition<RemoveInterface>;

/** Removes the interface from its product, with its roles and the use cases it offers. */
export function removeInterface(tx: Transaction, input: RemoveInterface): void {
  const products = new ProductRepository(tx);
  const product = products.loadHolding('interface', input.id) ?? tx.refuse('missing', `there is no interface ${input.id}`);
  product.interfaces = product.interfaces.filter((i) => i.row.id !== input.id);
  products.save(product);
}
