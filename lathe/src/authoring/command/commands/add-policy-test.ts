// Add a policy test (LA-AUT-CMD252): Adds the test of a policy, with the test data sets it starts from.
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PolicyTestRow } from '../../../platform/data/tables.ts';
import { COMMAND_SLICE } from '../model.ts';
import { CommandRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new policy test, with the test data sets it starts from. */
export type AddPolicyTest = Pick<PolicyTestRow, 'id' | 'title' | 'policy_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'when' | 'then' | 'notes'> & { starts_from?: string[] };

/** Add a policy test (LA-AUT-CMD252). */
export const ADD_POLICY_TEST: CommandDefinition<AddPolicyTest> = {
  id: 'LA-AUT-CMD252',
  slice: COMMAND_SLICE,
  name: 'add-policy-test',
  description: 'Adds the test of a policy, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/command/add-policy-test',
  input: {
    id: column('policy_test', 'id', 'required'),
    title: column('policy_test', 'title', 'required'),
    policy_id: column('policy_test', 'policy_id', 'required'),
    level: column('policy_test', 'level', 'required'),
    state: column('policy_test', 'state', 'required'),
    file: column('policy_test', 'file', 'optional'),
    manual_reason: column('policy_test', 'manual_reason', 'optional'),
    size: column('policy_test', 'size', 'optional'),
    smoke: column('policy_test', 'smoke', 'optional'),
    external: column('policy_test', 'external', 'optional'),
    when: column('policy_test', 'when', 'required'),
    then: column('policy_test', 'then', 'required'),
    notes: column('policy_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addPolicyTest,
};

/** Adds the test under its policy. */
export function addPolicyTest(tx: Transaction, input: AddPolicyTest): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('policy', input.policy_id) ?? tx.refuse('missing', `there is no policy ${input.policy_id}`);
  const { starts_from = [], ...row } = input;
  command.policyTests.push({ row, startsFrom: starts_from });
  holdToRules(tx, command);
  commands.save(command);
}
