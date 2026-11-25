import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { GuaranteeTestRow } from '../../../platform/data/tables.ts';
import { ADD_GUARANTEE_TEST_IDENTITY } from './identities.generated.ts';
import { addGuaranteeTest } from './handlers.generated.ts';

export type AddGuaranteeTest = Pick<GuaranteeTestRow, 'id' | 'title' | 'guarantee_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'when' | 'then' | 'notes'> & { starts_from?: string[] };

export const ADD_GUARANTEE_TEST = {
  ...ADD_GUARANTEE_TEST_IDENTITY,
  input: {
    id: column('guarantee_test', 'id', 'required'),
    title: column('guarantee_test', 'title', 'required'),
    guarantee_id: column('guarantee_test', 'guarantee_id', 'required'),
    level: column('guarantee_test', 'level', 'required'),
    state: column('guarantee_test', 'state', 'required'),
    file: column('guarantee_test', 'file', 'optional'),
    manual_reason: column('guarantee_test', 'manual_reason', 'optional'),
    size: column('guarantee_test', 'size', 'optional'),
    smoke: column('guarantee_test', 'smoke', 'optional'),
    external: column('guarantee_test', 'external', 'optional'),
    when: column('guarantee_test', 'when', 'required'),
    then: column('guarantee_test', 'then', 'required'),
    notes: column('guarantee_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addGuaranteeTest,
} satisfies CommandDefinition<AddGuaranteeTest>;
