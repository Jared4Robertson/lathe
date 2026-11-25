// Generated from data/ by `npm run generate`. Do not edit.
// The guarantee commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const GUARANTEE_FIELDS = {
  '/api/guarantee/add-guarantee': {
    id: { kind: 'column', table: 'guarantee', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'guarantee', column: 'title', required: true, clearable: false },
    domain_id: { kind: 'column', table: 'guarantee', column: 'domain_id', required: true, clearable: false },
    statement: { kind: 'column', table: 'guarantee', column: 'statement', required: true, clearable: false },
    kept_by: { kind: 'ids', description: 'The building blocks that keep it: technical records and data stores, by ID.', required: false, clearable: false },
  },
  '/api/guarantee/change-guarantee': {
    id: { kind: 'column', table: 'guarantee', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'guarantee', column: 'title', required: false, clearable: false },
    statement: { kind: 'column', table: 'guarantee', column: 'statement', required: false, clearable: false },
    kept_by: { kind: 'ids', description: 'The building blocks that keep it.', required: false, clearable: false },
  },
  '/api/guarantee/remove-guarantee': {
    id: { kind: 'column', table: 'guarantee', column: 'id', required: true, clearable: false },
  },
  '/api/guarantee/add-guarantee-test': {
    id: { kind: 'column', table: 'guarantee_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'guarantee_test', column: 'title', required: true, clearable: false },
    guarantee_id: { kind: 'column', table: 'guarantee_test', column: 'guarantee_id', required: true, clearable: false },
    level: { kind: 'column', table: 'guarantee_test', column: 'level', required: true, clearable: false },
    state: { kind: 'column', table: 'guarantee_test', column: 'state', required: true, clearable: false },
    file: { kind: 'column', table: 'guarantee_test', column: 'file', required: false, clearable: false },
    manual_reason: { kind: 'column', table: 'guarantee_test', column: 'manual_reason', required: false, clearable: false },
    size: { kind: 'column', table: 'guarantee_test', column: 'size', required: false, clearable: false },
    smoke: { kind: 'column', table: 'guarantee_test', column: 'smoke', required: false, clearable: false },
    external: { kind: 'column', table: 'guarantee_test', column: 'external', required: false, clearable: false },
    when: { kind: 'column', table: 'guarantee_test', column: 'when', required: true, clearable: false },
    then: { kind: 'column', table: 'guarantee_test', column: 'then', required: true, clearable: false },
    notes: { kind: 'column', table: 'guarantee_test', column: 'notes', required: false, clearable: false },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/guarantee/change-guarantee-test': {
    id: { kind: 'column', table: 'guarantee_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'guarantee_test', column: 'title', required: false, clearable: false },
    level: { kind: 'column', table: 'guarantee_test', column: 'level', required: false, clearable: false },
    state: { kind: 'column', table: 'guarantee_test', column: 'state', required: false, clearable: false },
    file: { kind: 'column', table: 'guarantee_test', column: 'file', required: false, clearable: true },
    manual_reason: { kind: 'column', table: 'guarantee_test', column: 'manual_reason', required: false, clearable: true },
    size: { kind: 'column', table: 'guarantee_test', column: 'size', required: false, clearable: true },
    smoke: { kind: 'column', table: 'guarantee_test', column: 'smoke', required: false, clearable: true },
    external: { kind: 'column', table: 'guarantee_test', column: 'external', required: false, clearable: true },
    when: { kind: 'column', table: 'guarantee_test', column: 'when', required: false, clearable: false },
    then: { kind: 'column', table: 'guarantee_test', column: 'then', required: false, clearable: false },
    notes: { kind: 'column', table: 'guarantee_test', column: 'notes', required: false, clearable: true },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/guarantee/remove-guarantee-test': {
    id: { kind: 'column', table: 'guarantee_test', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
