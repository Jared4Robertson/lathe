import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { InvariantTestRow } from '../../../platform/data/tables.ts';
import { CHANGE_INVARIANT_TEST_IDENTITY } from './identities.generated.ts';
import { changeInvariantTest } from './handlers.generated.ts';

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

export const CHANGE_INVARIANT_TEST = {
  ...CHANGE_INVARIANT_TEST_IDENTITY,
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
} satisfies CommandDefinition<ChangeInvariantTest>;
