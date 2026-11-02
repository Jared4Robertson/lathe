import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ViewTestRow } from '../../../platform/data/tables.ts';
import { ADD_VIEW_TEST_IDENTITY } from './identities.generated.ts';
import { addViewTest } from './handlers.generated.ts';

export type AddViewTest = Pick<ViewTestRow, 'id' | 'title' | 'view_requirement_id' | 'level' | 'state' | 'when' | 'then' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'notes'> & { starts_from?: string[] };

export const ADD_VIEW_TEST = {
  ...ADD_VIEW_TEST_IDENTITY,
  input: {
    id: column('view_test', 'id', 'required'),
    title: column('view_test', 'title', 'required'),
    view_requirement_id: column('view_test', 'view_requirement_id', 'required'),
    level: column('view_test', 'level', 'required'),
    state: column('view_test', 'state', 'required'),
    when: column('view_test', 'when', 'required'),
    then: column('view_test', 'then', 'required'),
    file: column('view_test', 'file', 'optional'),
    manual_reason: column('view_test', 'manual_reason', 'optional'),
    size: column('view_test', 'size', 'optional'),
    smoke: column('view_test', 'smoke', 'optional'),
    external: column('view_test', 'external', 'optional'),
    notes: column('view_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addViewTest,
} satisfies CommandDefinition<AddViewTest>;
