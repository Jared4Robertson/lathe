import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { COMMAND_SLICE } from '../model.ts';
import { CommandRepository } from '../repository.ts';

/** The policy to remove. */
export type RemovePolicy = { id: string };

export const REMOVE_POLICY: CommandDefinition<RemovePolicy> = {
  id: 'LA-AUT-CMD248',
  slice: COMMAND_SLICE,
  name: 'remove-policy',
  description: 'Removes a policy with its event handler and test and the links they start. Refused while anything else references them.',
  method: 'POST',
  route: '/api/command/remove-policy',
  input: {
    id: column('policy', 'id', 'required'),
  },
  handler: removePolicy,
};

/** Removes the policy, its event handler and its test from its command. */
export function removePolicy(tx: Transaction, input: RemovePolicy): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('policy', input.id) ?? tx.refuse('missing', `there is no policy ${input.id}`);
  command.policies = command.policies.filter((p) => p.row.id !== input.id);
  command.eventHandlers = command.eventHandlers.filter((h) => h.row.policy_id !== input.id);
  command.policyTests = command.policyTests.filter((t) => t.row.policy_id !== input.id);
  commands.save(command);
}
