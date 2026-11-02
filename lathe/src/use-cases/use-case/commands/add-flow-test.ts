import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { FlowTestRow } from '../../../platform/data/tables.ts';
import { ADD_FLOW_TEST_IDENTITY } from './identities.generated.ts';
import { addFlowTest } from './handlers.generated.ts';

export type AddFlowTest = Pick<FlowTestRow, 'id' | 'title' | 'flow_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'steps' | 'expected_result' | 'notes'> & { starts_from?: string[] };

export const ADD_FLOW_TEST = {
  ...ADD_FLOW_TEST_IDENTITY,
  input: {
    id: column('flow_test', 'id', 'required'),
    title: column('flow_test', 'title', 'required'),
    flow_id: column('flow_test', 'flow_id', 'required'),
    level: column('flow_test', 'level', 'required'),
    state: column('flow_test', 'state', 'required'),
    file: column('flow_test', 'file', 'optional'),
    manual_reason: column('flow_test', 'manual_reason', 'optional'),
    size: column('flow_test', 'size', 'optional'),
    smoke: column('flow_test', 'smoke', 'optional'),
    external: column('flow_test', 'external', 'optional'),
    steps: column('flow_test', 'steps', 'required'),
    expected_result: column('flow_test', 'expected_result', 'required'),
    notes: column('flow_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addFlowTest,
} satisfies CommandDefinition<AddFlowTest>;
