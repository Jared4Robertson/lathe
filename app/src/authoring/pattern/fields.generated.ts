// Generated from data/ by `npm run generate`. Do not edit.
// The pattern commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const PATTERN_FIELDS = {
  '/api/pattern/add-pattern': {
    id: { kind: 'column', table: 'pattern', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'pattern', column: 'title', required: true, clearable: false },
    product_id: { kind: 'column', table: 'pattern', column: 'product_id', required: true, clearable: false },
    description: { kind: 'column', table: 'pattern', column: 'description', required: true, clearable: false },
    notes: { kind: 'column', table: 'pattern', column: 'notes', required: false, clearable: false },
    settings: { kind: 'parts', table: 'pattern_setting', columns: ['name', 'meaning'], description: 'Its settings in order, each a name (lower case with underscores) and what a follower decides in it.', required: false, clearable: false },
  },
  '/api/pattern/change-pattern': {
    id: { kind: 'column', table: 'pattern', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'pattern', column: 'title', required: false, clearable: false },
    description: { kind: 'column', table: 'pattern', column: 'description', required: false, clearable: false },
    notes: { kind: 'column', table: 'pattern', column: 'notes', required: false, clearable: true },
    settings: { kind: 'parts', table: 'pattern_setting', columns: ['name', 'meaning'], description: 'Its settings in order, each a name (lower case with underscores) and what a follower decides in it.', required: false, clearable: false },
  },
  '/api/pattern/remove-pattern': {
    id: { kind: 'column', table: 'pattern', column: 'id', required: true, clearable: false },
  },
  '/api/pattern/add-pattern-rule': {
    id: { kind: 'column', table: 'pattern_rule', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'pattern_rule', column: 'title', required: true, clearable: false },
    pattern_id: { kind: 'column', table: 'pattern_rule', column: 'pattern_id', required: true, clearable: false },
    statement: { kind: 'column', table: 'pattern_rule', column: 'statement', required: true, clearable: false },
    group_name: { kind: 'column', table: 'pattern_rule', column: 'group_name', required: false, clearable: false },
    notes: { kind: 'column', table: 'pattern_rule', column: 'notes', required: false, clearable: false },
  },
  '/api/pattern/change-pattern-rule': {
    id: { kind: 'column', table: 'pattern_rule', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'pattern_rule', column: 'title', required: false, clearable: false },
    statement: { kind: 'column', table: 'pattern_rule', column: 'statement', required: false, clearable: false },
    group_name: { kind: 'column', table: 'pattern_rule', column: 'group_name', required: false, clearable: true },
    notes: { kind: 'column', table: 'pattern_rule', column: 'notes', required: false, clearable: true },
  },
  '/api/pattern/remove-pattern-rule': {
    id: { kind: 'column', table: 'pattern_rule', column: 'id', required: true, clearable: false },
  },
  '/api/pattern/add-pattern-rule-test': {
    id: { kind: 'column', table: 'pattern_rule_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'pattern_rule_test', column: 'title', required: true, clearable: false },
    pattern_rule_id: { kind: 'column', table: 'pattern_rule_test', column: 'pattern_rule_id', required: true, clearable: false },
    domain_id: { kind: 'column', table: 'pattern_rule_test', column: 'domain_id', required: true, clearable: false },
    level: { kind: 'column', table: 'pattern_rule_test', column: 'level', required: true, clearable: false },
    state: { kind: 'column', table: 'pattern_rule_test', column: 'state', required: true, clearable: false },
    file: { kind: 'column', table: 'pattern_rule_test', column: 'file', required: false, clearable: false },
    manual_reason: { kind: 'column', table: 'pattern_rule_test', column: 'manual_reason', required: false, clearable: false },
    size: { kind: 'column', table: 'pattern_rule_test', column: 'size', required: false, clearable: false },
    smoke: { kind: 'column', table: 'pattern_rule_test', column: 'smoke', required: false, clearable: false },
    external: { kind: 'column', table: 'pattern_rule_test', column: 'external', required: false, clearable: false },
    when: { kind: 'column', table: 'pattern_rule_test', column: 'when', required: true, clearable: false },
    then: { kind: 'column', table: 'pattern_rule_test', column: 'then', required: true, clearable: false },
    notes: { kind: 'column', table: 'pattern_rule_test', column: 'notes', required: false, clearable: false },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/pattern/change-pattern-rule-test': {
    id: { kind: 'column', table: 'pattern_rule_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'pattern_rule_test', column: 'title', required: false, clearable: false },
    domain_id: { kind: 'column', table: 'pattern_rule_test', column: 'domain_id', required: false, clearable: false },
    level: { kind: 'column', table: 'pattern_rule_test', column: 'level', required: false, clearable: false },
    state: { kind: 'column', table: 'pattern_rule_test', column: 'state', required: false, clearable: false },
    file: { kind: 'column', table: 'pattern_rule_test', column: 'file', required: false, clearable: true },
    manual_reason: { kind: 'column', table: 'pattern_rule_test', column: 'manual_reason', required: false, clearable: true },
    size: { kind: 'column', table: 'pattern_rule_test', column: 'size', required: false, clearable: true },
    smoke: { kind: 'column', table: 'pattern_rule_test', column: 'smoke', required: false, clearable: true },
    external: { kind: 'column', table: 'pattern_rule_test', column: 'external', required: false, clearable: true },
    when: { kind: 'column', table: 'pattern_rule_test', column: 'when', required: false, clearable: false },
    then: { kind: 'column', table: 'pattern_rule_test', column: 'then', required: false, clearable: false },
    notes: { kind: 'column', table: 'pattern_rule_test', column: 'notes', required: false, clearable: true },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/pattern/remove-pattern-rule-test': {
    id: { kind: 'column', table: 'pattern_rule_test', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
