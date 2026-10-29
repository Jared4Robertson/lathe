// Remove an adapter (LA-AUT-CMD340): Removes an adapter with the links it starts and the packages it uses. Refused while anything else references them.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { INTEGRATION_SLICE } from '../model.ts';
import { IntegrationRepository } from '../repository.ts';

/** The adapter to remove. */
export type RemoveAdapter = { id: string };

/** Remove an adapter (LA-AUT-CMD340). */
export const REMOVE_ADAPTER: CommandDefinition<RemoveAdapter> = {
  id: 'LA-AUT-CMD340',
  slice: INTEGRATION_SLICE,
  name: 'remove-adapter',
  description: 'Removes an adapter with the links it starts and the packages it uses. Refused while anything else references them.',
  method: 'POST',
  route: '/api/integration/remove-adapter',
  input: {
    id: column('adapter', 'id', 'required'),
  },
  handler: removeAdapter,
};

/** Removes the adapter from its integration. */
export function removeAdapter(tx: Transaction, input: RemoveAdapter): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.loadHolding('adapter', input.id) ?? tx.refuse('missing', `there is no adapter ${input.id}`);
  integration.adapter = null;
  integrations.save(integration);
}
