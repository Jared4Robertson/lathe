import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ConstraintTestRow } from '../../../platform/data/tables.ts';
import { CHANGE_CONSTRAINT_TEST_IDENTITY } from './identities.generated.ts';
import { changeConstraintTest } from './handlers.generated.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangeConstraintTest = Pick<ConstraintTestRow, 'id'> & { title?: ConstraintTestRow['title']; level?: ConstraintTestRow['level']; state?: ConstraintTestRow['state']; file?: ConstraintTestRow['file'] | null; manual_reason?: ConstraintTestRow['manual_reason'] | null; size?: ConstraintTestRow['size'] | null; smoke?: ConstraintTestRow['smoke'] | null; external?: ConstraintTestRow['external'] | null; accepts?: ConstraintTestRow['accepts']; refuses?: ConstraintTestRow['refuses']; notes?: ConstraintTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_CONSTRAINT_TEST = {
  ...CHANGE_CONSTRAINT_TEST_IDENTITY,
  input: {
    id: column('constraint_test', 'id', 'required'),
    title: column('constraint_test', 'title', 'optional'),
    level: column('constraint_test', 'level', 'optional'),
    state: column('constraint_test', 'state', 'optional'),
    file: column('constraint_test', 'file', 'clearable'),
    manual_reason: column('constraint_test', 'manual_reason', 'clearable'),
    size: column('constraint_test', 'size', 'clearable'),
    smoke: column('constraint_test', 'smoke', 'clearable'),
    external: column('constraint_test', 'external', 'clearable'),
    accepts: column('constraint_test', 'accepts', 'optional'),
    refuses: column('constraint_test', 'refuses', 'optional'),
    notes: column('constraint_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeConstraintTest,
} satisfies CommandDefinition<ChangeConstraintTest>;
