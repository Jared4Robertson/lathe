import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { InterfaceRow } from '../../../platform/data/tables.ts';
import { changed } from '../../../platform/data/rows.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_INTERFACE_IDENTITY } from './identities.generated.ts';

/** The interface's changes: a column given is set. */
export type ChangeInterface = Pick<InterfaceRow, 'id'> & { title?: string; kind?: InterfaceRow['kind']; description?: string; public?: boolean };

export const CHANGE_INTERFACE = {
  ...CHANGE_INTERFACE_IDENTITY,
  input: {
    id: column('interface', 'id', 'required'),
    title: column('interface', 'title', 'optional'),
    kind: column('interface', 'kind', 'optional'),
    description: column('interface', 'description', 'optional'),
    public: column('interface', 'public', 'optional'),
  },
  handler: changeInterface,
} satisfies CommandDefinition<ChangeInterface>;

/** Changes the interface's columns. */
export function changeInterface(tx: Transaction, input: ChangeInterface): void {
  const products = new ProductRepository(tx);
  const product = products.loadHolding('interface', input.id) ?? tx.refuse('missing', `there is no interface ${input.id}`);
  product.interfaces = product.interfaces.map((i) => (i.id === input.id ? changed(i, input, ['title', 'kind', 'description', 'public']) : i));
  holdToRules(tx, product);
  products.save(product);
}
