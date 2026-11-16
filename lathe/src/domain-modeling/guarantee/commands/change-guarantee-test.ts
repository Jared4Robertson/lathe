import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { GuaranteeTestRow } from '../../../platform/data/tables.ts';
import { CHANGE_GUARANTEE_TEST_IDENTITY } from './identities.generated.ts';
import { changeGuaranteeTest } from './handlers.generated.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangeGuaranteeTest = Pick<GuaranteeTestRow, 'id'> & { title?: GuaranteeTestRow['title']; level?: GuaranteeTestRow['level']; state?: GuaranteeTestRow['state']; file?: GuaranteeTestRow['file'] | null; manual_reason?: GuaranteeTestRow['manual_reason'] | null; size?: GuaranteeTestRow['size'] | null; smoke?: GuaranteeTestRow['smoke'] | null; external?: GuaranteeTestRow['external'] | null; when?: GuaranteeTestRow['when']; then?: GuaranteeTestRow['then']; notes?: GuaranteeTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_GUARANTEE_TEST = {
  ...CHANGE_GUARANTEE_TEST_IDENTITY,
  input: {
    id: column('guarantee_test', 'id', 'required'),
    title: column('guarantee_test', 'title', 'optional'),
    level: column('guarantee_test', 'level', 'optional'),
    state: column('guarantee_test', 'state', 'optional'),
    file: column('guarantee_test', 'file', 'clearable'),
    manual_reason: column('guarantee_test', 'manual_reason', 'clearable'),
    size: column('guarantee_test', 'size', 'clearable'),
    smoke: column('guarantee_test', 'smoke', 'clearable'),
    external: column('guarantee_test', 'external', 'clearable'),
    when: column('guarantee_test', 'when', 'optional'),
    then: column('guarantee_test', 'then', 'optional'),
    notes: column('guarantee_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeGuaranteeTest,
} satisfies CommandDefinition<ChangeGuaranteeTest>;
