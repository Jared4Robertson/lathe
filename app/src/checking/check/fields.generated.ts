// Generated from data/ by `npm run generate`. Do not edit.
// The check commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const CHECK_FIELDS = {
  '/api/check/add-check': {
    name: { kind: 'column', table: 'check', column: 'name', required: true, clearable: false },
    product_id: { kind: 'column', table: 'check', column: 'product_id', required: false, clearable: false },
    domain_id: { kind: 'column', table: 'check', column: 'domain_id', required: true, clearable: false },
    position: { kind: 'column', table: 'check', column: 'position', required: true, clearable: false },
    severity: { kind: 'column', table: 'check', column: 'severity', required: true, clearable: false },
    summary: { kind: 'column', table: 'check', column: 'summary', required: true, clearable: false },
    explanation: { kind: 'column', table: 'check', column: 'explanation', required: true, clearable: false },
    query: { kind: 'column', table: 'check', column: 'query', required: true, clearable: false },
    kinds: { kind: 'column', table: 'check', column: 'kinds', required: false, clearable: false },
  },
  '/api/check/change-check': {
    name: { kind: 'column', table: 'check', column: 'name', required: true, clearable: false },
    domain_id: { kind: 'column', table: 'check', column: 'domain_id', required: false, clearable: false },
    position: { kind: 'column', table: 'check', column: 'position', required: false, clearable: false },
    severity: { kind: 'column', table: 'check', column: 'severity', required: false, clearable: false },
    summary: { kind: 'column', table: 'check', column: 'summary', required: false, clearable: false },
    explanation: { kind: 'column', table: 'check', column: 'explanation', required: false, clearable: false },
    query: { kind: 'column', table: 'check', column: 'query', required: false, clearable: false },
    kinds: { kind: 'column', table: 'check', column: 'kinds', required: false, clearable: true },
  },
  '/api/check/remove-check': {
    name: { kind: 'column', table: 'check', column: 'name', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
