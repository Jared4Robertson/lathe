// Generated from data/ by `npm run generate`. Do not edit.
// The integration commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const INTEGRATION_FIELDS = {
  '/api/integration/add-integration': {
    id: { kind: 'column', table: 'integration', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'integration', column: 'title', required: true, clearable: false },
    description: { kind: 'column', table: 'integration', column: 'description', required: true, clearable: false },
    system: { kind: 'column', table: 'integration', column: 'system', required: false, clearable: false },
  },
  '/api/integration/change-integration': {
    id: { kind: 'column', table: 'integration', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'integration', column: 'title', required: false, clearable: false },
    description: { kind: 'column', table: 'integration', column: 'description', required: false, clearable: false },
    system: { kind: 'column', table: 'integration', column: 'system', required: false, clearable: true },
  },
  '/api/integration/remove-integration': {
    id: { kind: 'column', table: 'integration', column: 'id', required: true, clearable: false },
  },
  '/api/integration/add-adapter': {
    id: { kind: 'column', table: 'adapter', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'adapter', column: 'title', required: true, clearable: false },
    integration_id: { kind: 'column', table: 'adapter', column: 'integration_id', required: true, clearable: false },
    description: { kind: 'column', table: 'adapter', column: 'description', required: true, clearable: false },
    file: { kind: 'column', table: 'adapter', column: 'file', required: false, clearable: false },
    meets: { kind: 'ids', description: 'The standard rules it follows.', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses, each listed in one of the product\'s package.json files.', required: false, clearable: false },
  },
  '/api/integration/change-adapter': {
    id: { kind: 'column', table: 'adapter', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'adapter', column: 'title', required: false, clearable: false },
    description: { kind: 'column', table: 'adapter', column: 'description', required: false, clearable: false },
    file: { kind: 'column', table: 'adapter', column: 'file', required: false, clearable: true },
    meets: { kind: 'ids', description: 'The standard rules it follows. Replaces the list.', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses. Replaces the list.', required: false, clearable: false },
  },
  '/api/integration/remove-adapter': {
    id: { kind: 'column', table: 'adapter', column: 'id', required: true, clearable: false },
  },
  '/api/integration/add-integration-test': {
    id: { kind: 'column', table: 'integration_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'integration_test', column: 'title', required: true, clearable: false },
    integration_id: { kind: 'column', table: 'integration_test', column: 'integration_id', required: true, clearable: false },
    level: { kind: 'column', table: 'integration_test', column: 'level', required: true, clearable: false },
    state: { kind: 'column', table: 'integration_test', column: 'state', required: true, clearable: false },
    when: { kind: 'column', table: 'integration_test', column: 'when', required: true, clearable: false },
    then: { kind: 'column', table: 'integration_test', column: 'then', required: true, clearable: false },
    file: { kind: 'column', table: 'integration_test', column: 'file', required: false, clearable: false },
    manual_reason: { kind: 'column', table: 'integration_test', column: 'manual_reason', required: false, clearable: false },
    size: { kind: 'column', table: 'integration_test', column: 'size', required: false, clearable: false },
    smoke: { kind: 'column', table: 'integration_test', column: 'smoke', required: false, clearable: false },
    external: { kind: 'column', table: 'integration_test', column: 'external', required: false, clearable: false },
    notes: { kind: 'column', table: 'integration_test', column: 'notes', required: false, clearable: false },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/integration/change-integration-test': {
    id: { kind: 'column', table: 'integration_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'integration_test', column: 'title', required: false, clearable: false },
    level: { kind: 'column', table: 'integration_test', column: 'level', required: false, clearable: false },
    state: { kind: 'column', table: 'integration_test', column: 'state', required: false, clearable: false },
    when: { kind: 'column', table: 'integration_test', column: 'when', required: false, clearable: false },
    then: { kind: 'column', table: 'integration_test', column: 'then', required: false, clearable: false },
    file: { kind: 'column', table: 'integration_test', column: 'file', required: false, clearable: true },
    manual_reason: { kind: 'column', table: 'integration_test', column: 'manual_reason', required: false, clearable: true },
    size: { kind: 'column', table: 'integration_test', column: 'size', required: false, clearable: true },
    smoke: { kind: 'column', table: 'integration_test', column: 'smoke', required: false, clearable: true },
    external: { kind: 'column', table: 'integration_test', column: 'external', required: false, clearable: true },
    notes: { kind: 'column', table: 'integration_test', column: 'notes', required: false, clearable: true },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from. Replaces the list.', required: false, clearable: false },
  },
  '/api/integration/remove-integration-test': {
    id: { kind: 'column', table: 'integration_test', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
