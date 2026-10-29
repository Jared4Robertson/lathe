// Remove a policy test (LA-AUT-CMD254): Removes a policy test with the links it starts. Refused while anything else references it, such as a business outcome it measures.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { COMMAND_SLICE } from '../model.ts';
import { CommandRepository } from '../repository.ts';

/** The test to remove. */
export type RemovePolicyTest = { id: string };

/** Remove a policy test (LA-AUT-CMD254). */
export const REMOVE_POLICY_TEST: CommandDefinition<RemovePolicyTest> = {
  id: 'LA-AUT-CMD254',
  slice: COMMAND_SLICE,
  name: 'remove-policy-test',
  description: 'Removes a policy test with the links it starts. Refused while anything else references it, such as a business outcome it measures.',
  method: 'POST',
  route: '/api/command/remove-policy-test',
  input: {
    id: column('policy_test', 'id', 'required'),
  },
  handler: removePolicyTest,
};

/** Removes the test from its policy. */
export function removePolicyTest(tx: Transaction, input: RemovePolicyTest): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('policy_test', input.id) ?? tx.refuse('missing', `there is no policy test ${input.id}`);
  command.policyTests = command.policyTests.filter((t) => t.row.id !== input.id);
  commands.save(command);
}
