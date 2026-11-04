// Generated from data/ by `npm run generate`. Do not edit.
// The specification commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const SPECIFICATION_FIELDS = {
  '/api/specification/add-specification': {
    id: { kind: 'column', table: 'specification', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'specification', column: 'title', required: true, clearable: false },
    statement: { kind: 'column', table: 'specification', column: 'statement', required: true, clearable: false },
    reads: { kind: 'ids', description: 'The aggregates it reads, of its own domain.', required: false, clearable: false },
  },
  '/api/specification/change-specification': {
    id: { kind: 'column', table: 'specification', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'specification', column: 'title', required: false, clearable: false },
    statement: { kind: 'column', table: 'specification', column: 'statement', required: false, clearable: false },
    reads: { kind: 'ids', description: 'The aggregates it reads, of its own domain.', required: false, clearable: false },
  },
  '/api/specification/remove-specification': {
    id: { kind: 'column', table: 'specification', column: 'id', required: true, clearable: false },
  },
  '/api/specification/add-predicate': {
    id: { kind: 'column', table: 'predicate', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'predicate', column: 'title', required: true, clearable: false },
    specification_id: { kind: 'column', table: 'predicate', column: 'specification_id', required: true, clearable: false },
    file: { kind: 'column', table: 'predicate', column: 'file', required: false, clearable: false },
    meets: { kind: 'ids', description: 'The standard rules it meets.', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses, by their names in the product\'s package.json files.', required: false, clearable: false },
    helpers: { kind: 'texts', description: 'The helper files its code is split across beside its file, such as helpers and build-tag variants, each from the product root; no other record names one.', required: false, clearable: false },
  },
  '/api/specification/change-predicate': {
    id: { kind: 'column', table: 'predicate', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'predicate', column: 'title', required: false, clearable: false },
    file: { kind: 'column', table: 'predicate', column: 'file', required: false, clearable: true },
    meets: { kind: 'ids', description: 'The standard rules it meets.', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses, by their names in the product\'s package.json files.', required: false, clearable: false },
    helpers: { kind: 'texts', description: 'The helper files its code is split across beside its file, each from the product root.', required: false, clearable: false },
  },
  '/api/specification/remove-predicate': {
    id: { kind: 'column', table: 'predicate', column: 'id', required: true, clearable: false },
  },
  '/api/specification/add-specification-test': {
    id: { kind: 'column', table: 'specification_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'specification_test', column: 'title', required: true, clearable: false },
    specification_id: { kind: 'column', table: 'specification_test', column: 'specification_id', required: true, clearable: false },
    level: { kind: 'column', table: 'specification_test', column: 'level', required: true, clearable: false },
    state: { kind: 'column', table: 'specification_test', column: 'state', required: true, clearable: false },
    file: { kind: 'column', table: 'specification_test', column: 'file', required: false, clearable: false },
    manual_reason: { kind: 'column', table: 'specification_test', column: 'manual_reason', required: false, clearable: false },
    size: { kind: 'column', table: 'specification_test', column: 'size', required: false, clearable: false },
    smoke: { kind: 'column', table: 'specification_test', column: 'smoke', required: false, clearable: false },
    external: { kind: 'column', table: 'specification_test', column: 'external', required: false, clearable: false },
    when: { kind: 'column', table: 'specification_test', column: 'when', required: true, clearable: false },
    then: { kind: 'column', table: 'specification_test', column: 'then', required: true, clearable: false },
    notes: { kind: 'column', table: 'specification_test', column: 'notes', required: false, clearable: false },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/specification/change-specification-test': {
    id: { kind: 'column', table: 'specification_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'specification_test', column: 'title', required: false, clearable: false },
    level: { kind: 'column', table: 'specification_test', column: 'level', required: false, clearable: false },
    state: { kind: 'column', table: 'specification_test', column: 'state', required: false, clearable: false },
    file: { kind: 'column', table: 'specification_test', column: 'file', required: false, clearable: true },
    manual_reason: { kind: 'column', table: 'specification_test', column: 'manual_reason', required: false, clearable: true },
    size: { kind: 'column', table: 'specification_test', column: 'size', required: false, clearable: true },
    smoke: { kind: 'column', table: 'specification_test', column: 'smoke', required: false, clearable: true },
    external: { kind: 'column', table: 'specification_test', column: 'external', required: false, clearable: true },
    when: { kind: 'column', table: 'specification_test', column: 'when', required: false, clearable: false },
    then: { kind: 'column', table: 'specification_test', column: 'then', required: false, clearable: false },
    notes: { kind: 'column', table: 'specification_test', column: 'notes', required: false, clearable: true },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/specification/remove-specification-test': {
    id: { kind: 'column', table: 'specification_test', column: 'id', required: true, clearable: false },
  },
  '/api/specification/move-specification': {
    id: { kind: 'column', table: 'specification', column: 'id', required: true, clearable: false },
    domain_id: { kind: 'id', description: 'The domain of its product the specification moves to.', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
