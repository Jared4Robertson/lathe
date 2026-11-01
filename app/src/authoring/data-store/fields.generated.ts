// Generated from data/ by `npm run generate`. Do not edit.
// The data-store commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const DATA_STORE_FIELDS = {
  '/api/data-store/add-data-store': {
    id: { kind: 'column', table: 'data_store', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'data_store', column: 'title', required: true, clearable: false },
    product_id: { kind: 'column', table: 'data_store', column: 'product_id', required: false, clearable: false },
    domain_id: { kind: 'column', table: 'data_store', column: 'domain_id', required: false, clearable: false },
    kind: { kind: 'column', table: 'data_store', column: 'kind', required: true, clearable: false },
    description: { kind: 'column', table: 'data_store', column: 'description', required: true, clearable: false },
  },
  '/api/data-store/change-data-store': {
    id: { kind: 'column', table: 'data_store', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'data_store', column: 'title', required: false, clearable: false },
    kind: { kind: 'column', table: 'data_store', column: 'kind', required: false, clearable: false },
    description: { kind: 'column', table: 'data_store', column: 'description', required: false, clearable: false },
  },
  '/api/data-store/remove-data-store': {
    id: { kind: 'column', table: 'data_store', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
