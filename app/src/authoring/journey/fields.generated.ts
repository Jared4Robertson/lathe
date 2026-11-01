// Generated from data/ by `npm run generate`. Do not edit.
// The journey commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const JOURNEY_FIELDS = {
  '/api/journey/add-journey': {
    id: { kind: 'column', table: 'journey', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'journey', column: 'title', required: true, clearable: false },
    product_id: { kind: 'column', table: 'journey', column: 'product_id', required: true, clearable: false },
    trigger: { kind: 'column', table: 'journey', column: 'trigger', required: true, clearable: false },
    result: { kind: 'column', table: 'journey', column: 'result', required: true, clearable: false },
    notes: { kind: 'column', table: 'journey', column: 'notes', required: false, clearable: false },
    serves: { kind: 'ids', description: 'The business outcomes of its product it serves.', required: false, clearable: false },
  },
  '/api/journey/change-journey': {
    id: { kind: 'column', table: 'journey', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'journey', column: 'title', required: false, clearable: false },
    trigger: { kind: 'column', table: 'journey', column: 'trigger', required: false, clearable: false },
    result: { kind: 'column', table: 'journey', column: 'result', required: false, clearable: false },
    notes: { kind: 'column', table: 'journey', column: 'notes', required: false, clearable: true },
    serves: { kind: 'ids', description: 'The business outcomes of its product it serves.', required: false, clearable: false },
  },
  '/api/journey/remove-journey': {
    id: { kind: 'column', table: 'journey', column: 'id', required: true, clearable: false },
  },
  '/api/journey/add-journey-step': {
    id: { kind: 'column', table: 'journey_step', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'journey_step', column: 'title', required: true, clearable: false },
    journey_id: { kind: 'column', table: 'journey_step', column: 'journey_id', required: true, clearable: false },
    path: { kind: 'column', table: 'journey_step', column: 'path', required: true, clearable: false },
    position: { kind: 'column', table: 'journey_step', column: 'position', required: true, clearable: false },
    carries_out: { kind: 'id', description: 'The use case or policy of its product it carries out; none yet is a use case still to write.', required: false, clearable: false },
  },
  '/api/journey/change-journey-step': {
    id: { kind: 'column', table: 'journey_step', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'journey_step', column: 'title', required: false, clearable: false },
    carries_out: { kind: 'id', description: 'The use case or policy of its product it carries out.', required: false, clearable: true },
  },
  '/api/journey/move-journey-step': {
    id: { kind: 'column', table: 'journey_step', column: 'id', required: true, clearable: false },
    path: { kind: 'column', table: 'journey_step', column: 'path', required: false, clearable: false },
    position: { kind: 'column', table: 'journey_step', column: 'position', required: true, clearable: false },
  },
  '/api/journey/remove-journey-step': {
    id: { kind: 'column', table: 'journey_step', column: 'id', required: true, clearable: false },
  },
  '/api/journey/add-journey-test': {
    id: { kind: 'column', table: 'journey_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'journey_test', column: 'title', required: true, clearable: false },
    journey_id: { kind: 'column', table: 'journey_test', column: 'journey_id', required: true, clearable: false },
    level: { kind: 'column', table: 'journey_test', column: 'level', required: true, clearable: false },
    state: { kind: 'column', table: 'journey_test', column: 'state', required: true, clearable: false },
    file: { kind: 'column', table: 'journey_test', column: 'file', required: false, clearable: false },
    manual_reason: { kind: 'column', table: 'journey_test', column: 'manual_reason', required: false, clearable: false },
    size: { kind: 'column', table: 'journey_test', column: 'size', required: false, clearable: false },
    smoke: { kind: 'column', table: 'journey_test', column: 'smoke', required: false, clearable: false },
    external: { kind: 'column', table: 'journey_test', column: 'external', required: false, clearable: false },
    steps: { kind: 'column', table: 'journey_test', column: 'steps', required: true, clearable: false },
    expected_result: { kind: 'column', table: 'journey_test', column: 'expected_result', required: true, clearable: false },
    notes: { kind: 'column', table: 'journey_test', column: 'notes', required: false, clearable: false },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/journey/change-journey-test': {
    id: { kind: 'column', table: 'journey_test', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'journey_test', column: 'title', required: false, clearable: false },
    level: { kind: 'column', table: 'journey_test', column: 'level', required: false, clearable: false },
    state: { kind: 'column', table: 'journey_test', column: 'state', required: false, clearable: false },
    file: { kind: 'column', table: 'journey_test', column: 'file', required: false, clearable: true },
    manual_reason: { kind: 'column', table: 'journey_test', column: 'manual_reason', required: false, clearable: true },
    size: { kind: 'column', table: 'journey_test', column: 'size', required: false, clearable: true },
    smoke: { kind: 'column', table: 'journey_test', column: 'smoke', required: false, clearable: true },
    external: { kind: 'column', table: 'journey_test', column: 'external', required: false, clearable: true },
    steps: { kind: 'column', table: 'journey_test', column: 'steps', required: false, clearable: false },
    expected_result: { kind: 'column', table: 'journey_test', column: 'expected_result', required: false, clearable: false },
    notes: { kind: 'column', table: 'journey_test', column: 'notes', required: false, clearable: true },
    starts_from: { kind: 'ids', description: 'The test data sets it starts from.', required: false, clearable: false },
  },
  '/api/journey/remove-journey-test': {
    id: { kind: 'column', table: 'journey_test', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
