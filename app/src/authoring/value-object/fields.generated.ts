// Generated from data/ by `npm run generate`. Do not edit.
// The value-object commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const VALUE_OBJECT_FIELDS = {
  '/api/value-object/add-value-object': {
    id: { kind: 'column', table: 'value_object', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'value_object', column: 'title', required: true, clearable: false },
    description: { kind: 'column', table: 'value_object', column: 'description', required: true, clearable: false },
    fields: { kind: 'parts', table: 'value_object_field', columns: ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'], description: 'Its fields in order, each a name, what it means, exactly one type (a basic type, another value object or an aggregate), whether it is required, and its column\'s name and an example when they help.', required: false, clearable: false },
  },
  '/api/value-object/change-value-object': {
    id: { kind: 'column', table: 'value_object', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'value_object', column: 'title', required: false, clearable: false },
    description: { kind: 'column', table: 'value_object', column: 'description', required: false, clearable: false },
    fields: { kind: 'parts', table: 'value_object_field', columns: ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'], description: 'Its fields in order, each a name, what it means, exactly one type (a basic type, another value object or an aggregate), whether it is required, and its column\'s name and an example when they help.', required: false, clearable: false },
  },
  '/api/value-object/remove-value-object': {
    id: { kind: 'column', table: 'value_object', column: 'id', required: true, clearable: false },
  },
  '/api/value-object/add-constraint': {
    id: { kind: 'column', table: 'constraint', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'constraint', column: 'title', required: true, clearable: false },
    value_object_id: { kind: 'column', table: 'constraint', column: 'value_object_id', required: true, clearable: false },
    statement: { kind: 'column', table: 'constraint', column: 'statement', required: true, clearable: false },
  },
  '/api/value-object/change-constraint': {
    id: { kind: 'column', table: 'constraint', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'constraint', column: 'title', required: false, clearable: false },
    statement: { kind: 'column', table: 'constraint', column: 'statement', required: false, clearable: false },
  },
  '/api/value-object/remove-constraint': {
    id: { kind: 'column', table: 'constraint', column: 'id', required: true, clearable: false },
  },
  '/api/value-object/add-value-type': {
    id: { kind: 'column', table: 'value_type', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'value_type', column: 'title', required: true, clearable: false },
    value_object_id: { kind: 'column', table: 'value_type', column: 'value_object_id', required: true, clearable: false },
    file: { kind: 'column', table: 'value_type', column: 'file', required: false, clearable: false },
    meets: { kind: 'ids', description: 'The standard rules it meets.', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses, by their names in the product\'s package.json files.', required: false, clearable: false },
  },
  '/api/value-object/change-value-type': {
    id: { kind: 'column', table: 'value_type', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'value_type', column: 'title', required: false, clearable: false },
    file: { kind: 'column', table: 'value_type', column: 'file', required: false, clearable: true },
    meets: { kind: 'ids', description: 'The standard rules it meets.', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses, by their names in the product\'s package.json files.', required: false, clearable: false },
  },
  '/api/value-object/remove-value-type': {
    id: { kind: 'column', table: 'value_type', column: 'id', required: true, clearable: false },
  },
  '/api/value-object/add-constraint-test': {
    id: { kind: 'column', table: 'constraint_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'constraint_test', column: 'title', required: true, clearable: false },
    constraint_id: { kind: 'column', table: 'constraint_test', column: 'constraint_id', required: true, clearable: false },
    level: { kind: 'column', table: 'constraint_test', column: 'level', required: true, clearable: false },
    state: { kind: 'column', table: 'constraint_test', column: 'state', required: true, clearable: false },
    file: { kind: 'column', table: 'constraint_test', column: 'file', required: false, clearable: false },
    manual_reason: { kind: 'column', table: 'constraint_test', column: 'manual_reason', required: false, clearable: false },
    size: { kind: 'column', table: 'constraint_test', column: 'size', required: false, clearable: false },
    smoke: { kind: 'column', table: 'constraint_test', column: 'smoke', required: false, clearable: false },
    external: { kind: 'column', table: 'constraint_test', column: 'external', required: false, clearable: false },
    accepts: { kind: 'column', table: 'constraint_test', column: 'accepts', required: true, clearable: false },
    refuses: { kind: 'column', table: 'constraint_test', column: 'refuses', required: true, clearable: false },
    notes: { kind: 'column', table: 'constraint_test', column: 'notes', required: false, clearable: false },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/value-object/change-constraint-test': {
    id: { kind: 'column', table: 'constraint_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'constraint_test', column: 'title', required: false, clearable: false },
    level: { kind: 'column', table: 'constraint_test', column: 'level', required: false, clearable: false },
    state: { kind: 'column', table: 'constraint_test', column: 'state', required: false, clearable: false },
    file: { kind: 'column', table: 'constraint_test', column: 'file', required: false, clearable: true },
    manual_reason: { kind: 'column', table: 'constraint_test', column: 'manual_reason', required: false, clearable: true },
    size: { kind: 'column', table: 'constraint_test', column: 'size', required: false, clearable: true },
    smoke: { kind: 'column', table: 'constraint_test', column: 'smoke', required: false, clearable: true },
    external: { kind: 'column', table: 'constraint_test', column: 'external', required: false, clearable: true },
    accepts: { kind: 'column', table: 'constraint_test', column: 'accepts', required: false, clearable: false },
    refuses: { kind: 'column', table: 'constraint_test', column: 'refuses', required: false, clearable: false },
    notes: { kind: 'column', table: 'constraint_test', column: 'notes', required: false, clearable: true },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/value-object/remove-constraint-test': {
    id: { kind: 'column', table: 'constraint_test', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
