import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { SpecificationTestRow } from '../../../platform/data/tables.ts';
import { ADD_SPECIFICATION_TEST_IDENTITY } from './identities.generated.ts';
import { addSpecificationTest } from './handlers.generated.ts';

export type AddSpecificationTest = Pick<SpecificationTestRow, 'id' | 'title' | 'specification_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'when' | 'then' | 'notes'> & { starts_from?: string[] };

export const ADD_SPECIFICATION_TEST = {
  ...ADD_SPECIFICATION_TEST_IDENTITY,
  input: {
    id: column('specification_test', 'id', 'required'),
    title: column('specification_test', 'title', 'required'),
    specification_id: column('specification_test', 'specification_id', 'required'),
    level: column('specification_test', 'level', 'required'),
    state: column('specification_test', 'state', 'required'),
    file: column('specification_test', 'file', 'optional'),
    manual_reason: column('specification_test', 'manual_reason', 'optional'),
    size: column('specification_test', 'size', 'optional'),
    smoke: column('specification_test', 'smoke', 'optional'),
    external: column('specification_test', 'external', 'optional'),
    when: column('specification_test', 'when', 'required'),
    then: column('specification_test', 'then', 'required'),
    notes: column('specification_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addSpecificationTest,
} satisfies CommandDefinition<AddSpecificationTest>;
