// Generated from data/ by `npm run generate`. Do not edit.
// The test-data-set commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const TEST_DATA_SET_FIELDS = {
  '/api/test-data-set/add-test-data-set': {
    id: { kind: 'column', table: 'test_data_set', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'test_data_set', column: 'title', required: true, clearable: false },
    domain_id: { kind: 'column', table: 'test_data_set', column: 'domain_id', required: true, clearable: false },
    environment: { kind: 'column', table: 'test_data_set', column: 'environment', required: true, clearable: false },
    accounts: { kind: 'column', table: 'test_data_set', column: 'accounts', required: false, clearable: false },
    records: { kind: 'column', table: 'test_data_set', column: 'records', required: true, clearable: false },
    prepare: { kind: 'column', table: 'test_data_set', column: 'prepare', required: true, clearable: false },
    reset: { kind: 'column', table: 'test_data_set', column: 'reset', required: true, clearable: false },
    file: { kind: 'column', table: 'test_data_set', column: 'file', required: false, clearable: false },
    description: { kind: 'column', table: 'test_data_set', column: 'description', required: true, clearable: false },
  },
  '/api/test-data-set/change-test-data-set': {
    id: { kind: 'column', table: 'test_data_set', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'test_data_set', column: 'title', required: false, clearable: false },
    environment: { kind: 'column', table: 'test_data_set', column: 'environment', required: false, clearable: false },
    accounts: { kind: 'column', table: 'test_data_set', column: 'accounts', required: false, clearable: true },
    records: { kind: 'column', table: 'test_data_set', column: 'records', required: false, clearable: false },
    prepare: { kind: 'column', table: 'test_data_set', column: 'prepare', required: false, clearable: false },
    reset: { kind: 'column', table: 'test_data_set', column: 'reset', required: false, clearable: false },
    file: { kind: 'column', table: 'test_data_set', column: 'file', required: false, clearable: true },
    description: { kind: 'column', table: 'test_data_set', column: 'description', required: false, clearable: false },
  },
  '/api/test-data-set/remove-test-data-set': {
    id: { kind: 'column', table: 'test_data_set', column: 'id', required: true, clearable: false },
  },
  '/api/test-data-set/move-test-data-set': {
    id: { kind: 'column', table: 'test_data_set', column: 'id', required: true, clearable: false },
    domain_id: { kind: 'column', table: 'test_data_set', column: 'domain_id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
