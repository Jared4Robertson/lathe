import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PolicyTestRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { CommandRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_POLICY_TEST_IDENTITY } from './identities.generated.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangePolicyTest = Pick<PolicyTestRow, 'id'> & {
  title?: string;
  level?: PolicyTestRow['level'];
  state?: PolicyTestRow['state'];
  file?: string | null;
  manual_reason?: string | null;
  size?: PolicyTestRow['size'] | null;
  smoke?: boolean | null;
  external?: boolean | null;
  when?: string;
  then?: string;
  notes?: string | null;
  starts_from?: string[];
};

export const CHANGE_POLICY_TEST: CommandDefinition<ChangePolicyTest> = {
  ...CHANGE_POLICY_TEST_IDENTITY,
  input: {
    id: column('policy_test', 'id', 'required'),
    title: column('policy_test', 'title', 'optional'),
    level: column('policy_test', 'level', 'optional'),
    state: column('policy_test', 'state', 'optional'),
    file: column('policy_test', 'file', 'clearable'),
    manual_reason: column('policy_test', 'manual_reason', 'clearable'),
    size: column('policy_test', 'size', 'clearable'),
    smoke: column('policy_test', 'smoke', 'clearable'),
    external: column('policy_test', 'external', 'clearable'),
    when: column('policy_test', 'when', 'optional'),
    then: column('policy_test', 'then', 'optional'),
    notes: column('policy_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changePolicyTest,
};

/** Changes the test's columns and the data sets it starts from. */
export function changePolicyTest(tx: Transaction, input: ChangePolicyTest): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('policy_test', input.id) ?? tx.refuse('missing', `there is no policy test ${input.id}`);
  command.policyTests = command.policyTests.map((test) =>
    test.row.id === input.id ? { row: changed(test.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? test.startsFrom } : test,
  );
  holdToRules(tx, command);
  commands.save(command);
}
