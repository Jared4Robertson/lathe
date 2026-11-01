import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { InvariantTestRow } from '../../../platform/data/tables.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_INVARIANT_TEST_IDENTITY } from './identities.generated.ts';

export type AddInvariantTest = Pick<InvariantTestRow, 'id' | 'title' | 'invariant_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'when' | 'then' | 'notes'> & { starts_from?: string[] };

export const ADD_INVARIANT_TEST: CommandDefinition<AddInvariantTest> = {
  ...ADD_INVARIANT_TEST_IDENTITY,
  input: {
    id: column('invariant_test', 'id', 'required'),
    title: column('invariant_test', 'title', 'required'),
    invariant_id: column('invariant_test', 'invariant_id', 'required'),
    level: column('invariant_test', 'level', 'required'),
    state: column('invariant_test', 'state', 'required'),
    file: column('invariant_test', 'file', 'optional'),
    manual_reason: column('invariant_test', 'manual_reason', 'optional'),
    size: column('invariant_test', 'size', 'optional'),
    smoke: column('invariant_test', 'smoke', 'optional'),
    external: column('invariant_test', 'external', 'optional'),
    when: column('invariant_test', 'when', 'required'),
    then: column('invariant_test', 'then', 'required'),
    notes: column('invariant_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addInvariantTest,
};

export function addInvariantTest(tx: Transaction, input: AddInvariantTest): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('invariant', input.invariant_id) ?? tx.refuse('missing', `there is no invariant ${input.invariant_id}`);
  const { starts_from = [], ...row } = input;
  aggregate.invariantTests.push({ row, startsFrom: starts_from });
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}
