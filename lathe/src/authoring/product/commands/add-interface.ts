import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { InterfaceRow } from '../../../platform/data/tables.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_INTERFACE_IDENTITY } from './identities.generated.ts';

/** A new interface. */
export type AddInterface = Pick<InterfaceRow, 'id' | 'title' | 'product_id' | 'kind' | 'description'>;

export const ADD_INTERFACE: CommandDefinition<AddInterface> = {
  ...ADD_INTERFACE_IDENTITY,
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
