// Change an interface (LA-AUT-CMD133): Changes an interface's title, kind or description.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { InterfaceRow } from '../../../platform/data/tables.ts';
import { PRODUCT_SLICE, changed } from '../model.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The interface's changes: a column given is set. */
export type ChangeInterface = Pick<InterfaceRow, 'id'> & { title?: string; kind?: InterfaceRow['kind']; description?: string };

/** Change an interface (LA-AUT-CMD133). */
export const CHANGE_INTERFACE: CommandDefinition<ChangeInterface> = {
  id: 'LA-AUT-CMD133',
  slice: PRODUCT_SLICE,
  name: 'change-interface',
  description: "Changes an interface's title, kind or description.",
  method: 'POST',
  route: '/api/product/change-interface',
  input: {
    id: column('interface', 'id', 'required'),
    title: column('interface', 'title', 'optional'),
    kind: column('interface', 'kind', 'optional'),
    description: column('interface', 'description', 'optional'),
  },
  handler: changeInterface,
};

/** Changes the interface's columns. */
export function changeInterface(tx: Transaction, input: ChangeInterface): void {
  const products = new ProductRepository(tx);
  const product = products.loadHolding('interface', input.id) ?? tx.refuse('missing', `there is no interface ${input.id}`);
  product.interfaces = product.interfaces.map((i) => (i.id === input.id ? changed(i, input, ['title', 'kind', 'description']) : i));
  holdToRules(tx, product);
  products.save(product);
}
