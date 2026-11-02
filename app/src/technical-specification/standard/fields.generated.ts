// Generated from data/ by `npm run generate`. Do not edit.
// The standard commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const STANDARD_FIELDS = {
  '/api/standard/add-standard': {
    id: { kind: 'column', table: 'standard', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'standard', column: 'title', required: true, clearable: false },
    product_id: { kind: 'column', table: 'standard', column: 'product_id', required: true, clearable: false },
    type: { kind: 'column', table: 'standard', column: 'type', required: true, clearable: false },
    description: { kind: 'column', table: 'standard', column: 'description', required: true, clearable: false },
  },
  '/api/standard/change-standard': {
    id: { kind: 'column', table: 'standard', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'standard', column: 'title', required: false, clearable: false },
    type: { kind: 'column', table: 'standard', column: 'type', required: false, clearable: false },
    description: { kind: 'column', table: 'standard', column: 'description', required: false, clearable: false },
  },
  '/api/standard/remove-standard': {
    id: { kind: 'column', table: 'standard', column: 'id', required: true, clearable: false },
  },
  '/api/standard/add-standard-rule': {
    id: { kind: 'column', table: 'standard_rule', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'standard_rule', column: 'title', required: true, clearable: false },
    standard_id: { kind: 'column', table: 'standard_rule', column: 'standard_id', required: true, clearable: false },
    statement: { kind: 'column', table: 'standard_rule', column: 'statement', required: true, clearable: false },
    group_name: { kind: 'column', table: 'standard_rule', column: 'group_name', required: false, clearable: false },
  },
  '/api/standard/change-standard-rule': {
    id: { kind: 'column', table: 'standard_rule', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'standard_rule', column: 'title', required: false, clearable: false },
    statement: { kind: 'column', table: 'standard_rule', column: 'statement', required: false, clearable: false },
    group_name: { kind: 'column', table: 'standard_rule', column: 'group_name', required: false, clearable: true },
  },
  '/api/standard/remove-standard-rule': {
    id: { kind: 'column', table: 'standard_rule', column: 'id', required: true, clearable: false },
  },
  '/api/standard/add-standard-rule-test': {
    id: { kind: 'column', table: 'standard_rule_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'standard_rule_test', column: 'title', required: true, clearable: false },
    standard_rule_id: { kind: 'column', table: 'standard_rule_test', column: 'standard_rule_id', required: true, clearable: false },
    level: { kind: 'column', table: 'standard_rule_test', column: 'level', required: true, clearable: false },
    state: { kind: 'column', table: 'standard_rule_test', column: 'state', required: true, clearable: false },
    file: { kind: 'column', table: 'standard_rule_test', column: 'file', required: false, clearable: false },
    manual_reason: { kind: 'column', table: 'standard_rule_test', column: 'manual_reason', required: false, clearable: false },
    size: { kind: 'column', table: 'standard_rule_test', column: 'size', required: false, clearable: false },
    smoke: { kind: 'column', table: 'standard_rule_test', column: 'smoke', required: false, clearable: false },
    external: { kind: 'column', table: 'standard_rule_test', column: 'external', required: false, clearable: false },
    when: { kind: 'column', table: 'standard_rule_test', column: 'when', required: true, clearable: false },
    then: { kind: 'column', table: 'standard_rule_test', column: 'then', required: true, clearable: false },
    notes: { kind: 'column', table: 'standard_rule_test', column: 'notes', required: false, clearable: false },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/standard/change-standard-rule-test': {
    id: { kind: 'column', table: 'standard_rule_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'standard_rule_test', column: 'title', required: false, clearable: false },
    level: { kind: 'column', table: 'standard_rule_test', column: 'level', required: false, clearable: false },
    state: { kind: 'column', table: 'standard_rule_test', column: 'state', required: false, clearable: false },
    file: { kind: 'column', table: 'standard_rule_test', column: 'file', required: false, clearable: true },
    manual_reason: { kind: 'column', table: 'standard_rule_test', column: 'manual_reason', required: false, clearable: true },
    size: { kind: 'column', table: 'standard_rule_test', column: 'size', required: false, clearable: true },
    smoke: { kind: 'column', table: 'standard_rule_test', column: 'smoke', required: false, clearable: true },
    external: { kind: 'column', table: 'standard_rule_test', column: 'external', required: false, clearable: true },
    when: { kind: 'column', table: 'standard_rule_test', column: 'when', required: false, clearable: false },
    then: { kind: 'column', table: 'standard_rule_test', column: 'then', required: false, clearable: false },
    notes: { kind: 'column', table: 'standard_rule_test', column: 'notes', required: false, clearable: true },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/standard/remove-standard-rule-test': {
    id: { kind: 'column', table: 'standard_rule_test', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
