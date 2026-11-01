import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { InterfaceRepository } from '../repository.ts';
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

/** Takes the interface out with every row under it; the repository refuses while anything else references it. */
export function removeInterface(tx: Transaction, input: RemoveInterface): void {
  const interfaces = new InterfaceRepository(tx);
  const iface = interfaces.load(input.id) ?? tx.refuse('missing', `there is no interface ${input.id}`);
  interfaces.remove(iface);
}
