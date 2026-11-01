// Generated from data/ by `npm run generate`. Do not edit.
// The view commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const VIEW_FIELDS = {
  '/api/view/add-view': {
    id: { kind: 'column', table: 'view', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'view', column: 'title', required: true, clearable: false },
    description: { kind: 'column', table: 'view', column: 'description', required: true, clearable: false },
    route: { kind: 'column', table: 'view', column: 'route', required: false, clearable: false },
    interface_id: { kind: 'column', table: 'view', column: 'interface_id', required: false, clearable: false },
    notes: { kind: 'column', table: 'view', column: 'notes', required: false, clearable: false },
    presents: { kind: 'ids', description: 'The commands and queries a person sends or asks in it.', required: false, clearable: false },
  },
  '/api/view/change-view': {
    id: { kind: 'column', table: 'view', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'view', column: 'title', required: false, clearable: false },
    description: { kind: 'column', table: 'view', column: 'description', required: false, clearable: false },
    route: { kind: 'column', table: 'view', column: 'route', required: false, clearable: true },
    interface_id: { kind: 'column', table: 'view', column: 'interface_id', required: false, clearable: true },
    notes: { kind: 'column', table: 'view', column: 'notes', required: false, clearable: true },
    presents: { kind: 'ids', description: 'The commands and queries a person sends or asks in it.', required: false, clearable: false },
  },
  '/api/view/remove-view': {
    id: { kind: 'column', table: 'view', column: 'id', required: true, clearable: false },
  },
  '/api/view/add-view-requirement': {
    id: { kind: 'column', table: 'view_requirement', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'view_requirement', column: 'title', required: true, clearable: false },
    view_id: { kind: 'column', table: 'view_requirement', column: 'view_id', required: true, clearable: false },
    statement: { kind: 'column', table: 'view_requirement', column: 'statement', required: true, clearable: false },
    group_name: { kind: 'column', table: 'view_requirement', column: 'group_name', required: false, clearable: false },
  },
  '/api/view/change-view-requirement': {
    id: { kind: 'column', table: 'view_requirement', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'view_requirement', column: 'title', required: false, clearable: false },
    statement: { kind: 'column', table: 'view_requirement', column: 'statement', required: false, clearable: false },
    group_name: { kind: 'column', table: 'view_requirement', column: 'group_name', required: false, clearable: true },
  },
  '/api/view/remove-view-requirement': {
    id: { kind: 'column', table: 'view_requirement', column: 'id', required: true, clearable: false },
  },
  '/api/view/add-view-test': {
    id: { kind: 'column', table: 'view_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'view_test', column: 'title', required: true, clearable: false },
    view_requirement_id: { kind: 'column', table: 'view_test', column: 'view_requirement_id', required: true, clearable: false },
    level: { kind: 'column', table: 'view_test', column: 'level', required: true, clearable: false },
    state: { kind: 'column', table: 'view_test', column: 'state', required: true, clearable: false },
    when: { kind: 'column', table: 'view_test', column: 'when', required: true, clearable: false },
    then: { kind: 'column', table: 'view_test', column: 'then', required: true, clearable: false },
    file: { kind: 'column', table: 'view_test', column: 'file', required: false, clearable: false },
    manual_reason: { kind: 'column', table: 'view_test', column: 'manual_reason', required: false, clearable: false },
    size: { kind: 'column', table: 'view_test', column: 'size', required: false, clearable: false },
    smoke: { kind: 'column', table: 'view_test', column: 'smoke', required: false, clearable: false },
    external: { kind: 'column', table: 'view_test', column: 'external', required: false, clearable: false },
    notes: { kind: 'column', table: 'view_test', column: 'notes', required: false, clearable: false },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/view/change-view-test': {
    id: { kind: 'column', table: 'view_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'view_test', column: 'title', required: false, clearable: false },
    level: { kind: 'column', table: 'view_test', column: 'level', required: false, clearable: false },
    state: { kind: 'column', table: 'view_test', column: 'state', required: false, clearable: false },
    when: { kind: 'column', table: 'view_test', column: 'when', required: false, clearable: false },
    then: { kind: 'column', table: 'view_test', column: 'then', required: false, clearable: false },
    file: { kind: 'column', table: 'view_test', column: 'file', required: false, clearable: true },
    manual_reason: { kind: 'column', table: 'view_test', column: 'manual_reason', required: false, clearable: true },
    size: { kind: 'column', table: 'view_test', column: 'size', required: false, clearable: true },
    smoke: { kind: 'column', table: 'view_test', column: 'smoke', required: false, clearable: true },
    external: { kind: 'column', table: 'view_test', column: 'external', required: false, clearable: true },
    notes: { kind: 'column', table: 'view_test', column: 'notes', required: false, clearable: true },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/view/remove-view-test': {
    id: { kind: 'column', table: 'view_test', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
