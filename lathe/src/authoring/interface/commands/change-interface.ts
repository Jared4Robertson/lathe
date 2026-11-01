import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { InterfaceRow } from '../../../platform/data/tables.ts';
import { changed } from '../../../platform/data/rows.ts';
import { InterfaceRepository } from '../repository.ts';
import { CHANGE_INTERFACE_IDENTITY } from './identities.generated.ts';

/** The interface's changes: a column given is set; a list given replaces its roles or the use cases it offers. */
export type ChangeInterface = Pick<InterfaceRow, 'id'> & { title?: string; kind?: InterfaceRow['kind']; description?: string; public?: boolean; actors?: string[]; offers?: string[] };

export const CHANGE_INTERFACE = {
  ...CHANGE_INTERFACE_IDENTITY,
  input: {
    id: column('interface', 'id', 'required'),
    title: column('interface', 'title', 'optional'),
    kind: column('interface', 'kind', 'optional'),
    description: column('interface', 'description', 'optional'),
    public: column('interface', 'public', 'optional'),
    actors: texts('The roles of the product that use it, in order. Replaces the list.', 'optional'),
    offers: ids('The use cases of the product it offers. Replaces the list.', 'optional'),
  },
  handler: changeInterface,
} satisfies CommandDefinition<ChangeInterface>;

/** Changes the interface's columns, roles or offered use cases. */
export function changeInterface(tx: Transaction, input: ChangeInterface): void {
  const interfaces = new InterfaceRepository(tx);
  const iface = interfaces.load(input.id) ?? tx.refuse('missing', `there is no interface ${input.id}`);
  iface.row = changed(iface.row, input, ['title', 'kind', 'description', 'public']);
  if (input.actors) iface.actors = input.actors;
  if (input.offers) iface.offers = [...input.offers].sort();
  interfaces.save(iface);
}
