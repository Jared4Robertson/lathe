// Generated from data/ by `npm run generate`. Do not edit.
// The storage-requirement commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const STORAGE_REQUIREMENT_FIELDS = {
  '/api/storage-requirement/add-storage-requirement': {
    id: { kind: 'column', table: 'storage_requirement', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'storage_requirement', column: 'title', required: true, clearable: false },
    aggregate_id: { kind: 'column', table: 'storage_requirement', column: 'aggregate_id', required: false, clearable: false },
    read_model_id: { kind: 'column', table: 'storage_requirement', column: 'read_model_id', required: false, clearable: false },
    statement: { kind: 'column', table: 'storage_requirement', column: 'statement', required: true, clearable: false },
  },
  '/api/storage-requirement/change-storage-requirement': {
    id: { kind: 'column', table: 'storage_requirement', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'storage_requirement', column: 'title', required: false, clearable: false },
    statement: { kind: 'column', table: 'storage_requirement', column: 'statement', required: false, clearable: false },
  },
  '/api/storage-requirement/remove-storage-requirement': {
    id: { kind: 'column', table: 'storage_requirement', column: 'id', required: true, clearable: false },
  },
  '/api/storage-requirement/add-storage-requirement-test': {
    id: { kind: 'column', table: 'storage_requirement_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'storage_requirement_test', column: 'title', required: true, clearable: false },
    storage_requirement_id: { kind: 'column', table: 'storage_requirement_test', column: 'storage_requirement_id', required: true, clearable: false },
    level: { kind: 'column', table: 'storage_requirement_test', column: 'level', required: true, clearable: false },
    state: { kind: 'column', table: 'storage_requirement_test', column: 'state', required: true, clearable: false },
    when: { kind: 'column', table: 'storage_requirement_test', column: 'when', required: true, clearable: false },
    then: { kind: 'column', table: 'storage_requirement_test', column: 'then', required: true, clearable: false },
    file: { kind: 'column', table: 'storage_requirement_test', column: 'file', required: false, clearable: false },
    manual_reason: { kind: 'column', table: 'storage_requirement_test', column: 'manual_reason', required: false, clearable: false },
    size: { kind: 'column', table: 'storage_requirement_test', column: 'size', required: false, clearable: false },
    smoke: { kind: 'column', table: 'storage_requirement_test', column: 'smoke', required: false, clearable: false },
    external: { kind: 'column', table: 'storage_requirement_test', column: 'external', required: false, clearable: false },
    notes: { kind: 'column', table: 'storage_requirement_test', column: 'notes', required: false, clearable: false },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/storage-requirement/change-storage-requirement-test': {
    id: { kind: 'column', table: 'storage_requirement_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'storage_requirement_test', column: 'title', required: false, clearable: false },
    level: { kind: 'column', table: 'storage_requirement_test', column: 'level', required: false, clearable: false },
    state: { kind: 'column', table: 'storage_requirement_test', column: 'state', required: false, clearable: false },
    file: { kind: 'column', table: 'storage_requirement_test', column: 'file', required: false, clearable: true },
    manual_reason: { kind: 'column', table: 'storage_requirement_test', column: 'manual_reason', required: false, clearable: true },
    size: { kind: 'column', table: 'storage_requirement_test', column: 'size', required: false, clearable: true },
    smoke: { kind: 'column', table: 'storage_requirement_test', column: 'smoke', required: false, clearable: true },
    external: { kind: 'column', table: 'storage_requirement_test', column: 'external', required: false, clearable: true },
    when: { kind: 'column', table: 'storage_requirement_test', column: 'when', required: false, clearable: false },
    then: { kind: 'column', table: 'storage_requirement_test', column: 'then', required: false, clearable: false },
    notes: { kind: 'column', table: 'storage_requirement_test', column: 'notes', required: false, clearable: true },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/storage-requirement/remove-storage-requirement-test': {
    id: { kind: 'column', table: 'storage_requirement_test', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
