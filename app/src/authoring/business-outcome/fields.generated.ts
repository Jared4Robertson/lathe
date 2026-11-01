// Generated from data/ by `npm run generate`. Do not edit.
// The business-outcome commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const BUSINESS_OUTCOME_FIELDS = {
  '/api/business-outcome/add-business-outcome': {
    id: { kind: 'column', table: 'business_outcome', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'business_outcome', column: 'title', required: true, clearable: false },
    product_id: { kind: 'column', table: 'business_outcome', column: 'product_id', required: true, clearable: false },
    statement: { kind: 'column', table: 'business_outcome', column: 'statement', required: true, clearable: false },
    measure: { kind: 'column', table: 'business_outcome', column: 'measure', required: true, clearable: false },
    target: { kind: 'column', table: 'business_outcome', column: 'target', required: true, clearable: false },
    measured_outside: { kind: 'column', table: 'business_outcome', column: 'measured_outside', required: false, clearable: false },
    notes: { kind: 'column', table: 'business_outcome', column: 'notes', required: false, clearable: false },
    measured_by: { kind: 'ids', description: 'The tests, or records of the product\'s own kinds, that measure it.', required: false, clearable: false },
  },
  '/api/business-outcome/change-business-outcome': {
    id: { kind: 'column', table: 'business_outcome', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'business_outcome', column: 'title', required: false, clearable: false },
    statement: { kind: 'column', table: 'business_outcome', column: 'statement', required: false, clearable: false },
    measure: { kind: 'column', table: 'business_outcome', column: 'measure', required: false, clearable: false },
    target: { kind: 'column', table: 'business_outcome', column: 'target', required: false, clearable: false },
    measured_outside: { kind: 'column', table: 'business_outcome', column: 'measured_outside', required: false, clearable: true },
    notes: { kind: 'column', table: 'business_outcome', column: 'notes', required: false, clearable: true },
    measured_by: { kind: 'ids', description: 'The tests, or records of the product\'s own kinds, that measure it.', required: false, clearable: false },
  },
  '/api/business-outcome/remove-business-outcome': {
    id: { kind: 'column', table: 'business_outcome', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
