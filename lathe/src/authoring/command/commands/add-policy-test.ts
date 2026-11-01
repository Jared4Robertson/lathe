import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PolicyTestRow } from '../../../platform/data/tables.ts';
import { CommandRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_POLICY_TEST_IDENTITY } from './identities.generated.ts';

export type AddPolicyTest = Pick<PolicyTestRow, 'id' | 'title' | 'policy_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'when' | 'then' | 'notes'> & { starts_from?: string[] };

export const ADD_POLICY_TEST = {
  ...ADD_POLICY_TEST_IDENTITY,
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
} satisfies CommandDefinition<AddPolicyTest>;

export function addPolicyTest(tx: Transaction, input: AddPolicyTest): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('policy', input.policy_id) ?? tx.refuse('missing', `there is no policy ${input.policy_id}`);
  const { starts_from = [], ...row } = input;
  command.policyTests.push({ row, startsFrom: starts_from });
  holdToRules(tx, command);
  commands.save(command);
}
