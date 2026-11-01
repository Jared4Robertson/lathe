import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { FlowTestRow } from '../../../platform/data/tables.ts';
import { CHANGE_FLOW_TEST_IDENTITY } from './identities.generated.ts';
import { changeFlowTest } from './handlers.generated.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangeFlowTest = Pick<FlowTestRow, 'id'> & { title?: FlowTestRow['title']; level?: FlowTestRow['level']; state?: FlowTestRow['state']; steps?: FlowTestRow['steps']; expected_result?: FlowTestRow['expected_result']; file?: FlowTestRow['file'] | null; manual_reason?: FlowTestRow['manual_reason'] | null; size?: FlowTestRow['size'] | null; smoke?: FlowTestRow['smoke'] | null; external?: FlowTestRow['external'] | null; notes?: FlowTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_FLOW_TEST = {
  ...CHANGE_FLOW_TEST_IDENTITY,
  input: {
    id: column('flow_test', 'id', 'required'),
    title: column('flow_test', 'title', 'optional'),
    level: column('flow_test', 'level', 'optional'),
    state: column('flow_test', 'state', 'optional'),
    file: column('flow_test', 'file', 'clearable'),
    manual_reason: column('flow_test', 'manual_reason', 'clearable'),
    size: column('flow_test', 'size', 'clearable'),
    smoke: column('flow_test', 'smoke', 'clearable'),
    external: column('flow_test', 'external', 'clearable'),
    steps: column('flow_test', 'steps', 'optional'),
    expected_result: column('flow_test', 'expected_result', 'optional'),
    notes: column('flow_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeFlowTest,
} satisfies CommandDefinition<ChangeFlowTest>;
