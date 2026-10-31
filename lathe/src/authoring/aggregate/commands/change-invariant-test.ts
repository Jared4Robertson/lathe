import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { InvariantTestRow } from '../../../platform/data/tables.ts';
import { AGGREGATE_SLICE, changed } from '../model.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangeInvariantTest = Pick<InvariantTestRow, 'id'> & {
  title?: string;
  level?: InvariantTestRow['level'];
  state?: InvariantTestRow['state'];
  file?: string | null;
  manual_reason?: string | null;
  size?: InvariantTestRow['size'] | null;
  smoke?: boolean | null;
  external?: boolean | null;
  when?: string;
  then?: string;
  notes?: string | null;
  starts_from?: string[];
};

export const CHANGE_INVARIANT_TEST: CommandDefinition<ChangeInvariantTest> = {
  id: 'LA-AUT-CMD223',
  slice: AGGREGATE_SLICE,
  name: 'change-invariant-test',
  description: "Changes an invariant test's columns or the test data sets it starts from (the whole list).",
  method: 'POST',
  route: '/api/aggregate/change-invariant-test',
  input: {
    id: column('invariant_test', 'id', 'required'),
    title: column('invariant_test', 'title', 'optional'),
    level: column('invariant_test', 'level', 'optional'),
    state: column('invariant_test', 'state', 'optional'),
    file: column('invariant_test', 'file', 'clearable'),
    manual_reason: column('invariant_test', 'manual_reason', 'clearable'),
    size: column('invariant_test', 'size', 'clearable'),
    smoke: column('invariant_test', 'smoke', 'clearable'),
    external: column('invariant_test', 'external', 'clearable'),
    when: column('invariant_test', 'when', 'optional'),
    then: column('invariant_test', 'then', 'optional'),
    notes: column('invariant_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeInvariantTest,
};

/** Changes the test's columns and the data sets it starts from. */
export function changeInvariantTest(tx: Transaction, input: ChangeInvariantTest): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('invariant_test', input.id) ?? tx.refuse('missing', `there is no invariant test ${input.id}`);
  aggregate.invariantTests = aggregate.invariantTests.map((test) =>
    test.row.id === input.id ? { row: changed(test.row, input, ['title',  'level',  'state',  'file',  'manual_reason',  'size',  'smoke',  'external',  'when',  'then',  'notes']), startsFrom: input.starts_from ?? test.startsFrom } : test,
  );
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}
