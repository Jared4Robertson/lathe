import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { SpecificationTestRow } from '../../../platform/data/tables.ts';
import { CHANGE_SPECIFICATION_TEST_IDENTITY } from './identities.generated.ts';
import { changeSpecificationTest } from './handlers.generated.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangeSpecificationTest = Pick<SpecificationTestRow, 'id'> & { title?: SpecificationTestRow['title']; level?: SpecificationTestRow['level']; state?: SpecificationTestRow['state']; file?: SpecificationTestRow['file'] | null; manual_reason?: SpecificationTestRow['manual_reason'] | null; size?: SpecificationTestRow['size'] | null; smoke?: SpecificationTestRow['smoke'] | null; external?: SpecificationTestRow['external'] | null; when?: SpecificationTestRow['when']; then?: SpecificationTestRow['then']; notes?: SpecificationTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_SPECIFICATION_TEST = {
  ...CHANGE_SPECIFICATION_TEST_IDENTITY,
  input: {
    id: column('specification_test', 'id', 'required'),
    title: column('specification_test', 'title', 'optional'),
    level: column('specification_test', 'level', 'optional'),
    state: column('specification_test', 'state', 'optional'),
    file: column('specification_test', 'file', 'clearable'),
    manual_reason: column('specification_test', 'manual_reason', 'clearable'),
    size: column('specification_test', 'size', 'clearable'),
    smoke: column('specification_test', 'smoke', 'clearable'),
    external: column('specification_test', 'external', 'clearable'),
    when: column('specification_test', 'when', 'optional'),
    then: column('specification_test', 'then', 'optional'),
    notes: column('specification_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeSpecificationTest,
} satisfies CommandDefinition<ChangeSpecificationTest>;
