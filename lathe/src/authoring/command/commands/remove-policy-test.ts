import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { CommandRepository } from '../repository.ts';
import { REMOVE_POLICY_TEST_IDENTITY } from './identities.generated.ts';

/** The test to remove. */
export type RemovePolicyTest = { id: string };

export const REMOVE_POLICY_TEST = {
  ...REMOVE_POLICY_TEST_IDENTITY,
  input: {
    id: column('policy_test', 'id', 'required'),
  },
  handler: removePolicyTest,
} satisfies CommandDefinition<RemovePolicyTest>;

/** Removes the test from its policy. */
export function removePolicyTest(tx: Transaction, input: RemovePolicyTest): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('policy_test', input.id) ?? tx.refuse('missing', `there is no policy test ${input.id}`);
  command.policyTests = command.policyTests.filter((t) => t.row.id !== input.id);
  commands.save(command);
}
