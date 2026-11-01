import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { InterfaceRow } from '../../../platform/data/tables.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_INTERFACE_IDENTITY } from './identities.generated.ts';

/** A new interface. */
export type AddInterface = Pick<InterfaceRow, 'id' | 'title' | 'product_id' | 'kind' | 'description' | 'public'> & { actors?: string[]; offers?: string[] };

export const ADD_INTERFACE = {
  ...ADD_INTERFACE_IDENTITY,
  input: {
    id: column('interface', 'id', 'required'),
    title: column('interface', 'title', 'required'),
    product_id: column('interface', 'product_id', 'required'),
    kind: column('interface', 'kind', 'required'),
    description: column('interface', 'description', 'required'),
    public: column('interface', 'public', 'required'),
    actors: texts('The roles of the product that use it, in order.', 'optional'),
    offers: ids('The use cases of the product it offers.', 'optional'),
  },
  handler: addInterface,
} satisfies CommandDefinition<AddInterface>;

/** Adds the interface to its product. */
export function addInterface(tx: Transaction, input: AddInterface): void {
  const products = new ProductRepository(tx);
  if (tx.record(input.id)) tx.refuse('primary-key', `interface ${input.id} already exists`);
  const product = products.load(input.product_id) ?? tx.refuse('missing', `there is no product ${input.product_id}`);
  const { actors = [], offers = [], ...row } = input;
  product.interfaces.push({ row, actors, offers: [...offers].sort() });
  holdToRules(tx, product);
  products.save(product);
}
