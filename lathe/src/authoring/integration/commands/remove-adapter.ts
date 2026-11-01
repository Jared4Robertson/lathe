import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { IntegrationRepository } from '../repository.ts';
import { REMOVE_ADAPTER_IDENTITY } from './identities.generated.ts';

/** The adapter to remove. */
export type RemoveAdapter = { id: string };

export const REMOVE_ADAPTER: CommandDefinition<RemoveAdapter> = {
  ...REMOVE_ADAPTER_IDENTITY,
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
