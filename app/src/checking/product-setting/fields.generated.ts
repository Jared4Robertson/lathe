// Generated from data/ by `npm run generate`. Do not edit.
// The product-setting commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const PRODUCT_SETTING_FIELDS = {
  '/api/product-setting/set-limits': {
    product_id: { kind: 'column', table: 'product_setting', column: 'product_id', required: true, clearable: false },
    max_children: { kind: 'column', table: 'product_setting', column: 'max_children', required: true, clearable: false },
    max_entities_per_aggregate: { kind: 'column', table: 'product_setting', column: 'max_entities_per_aggregate', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
