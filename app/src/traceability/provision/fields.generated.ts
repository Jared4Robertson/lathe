// Generated from data/ by `npm run generate`. Do not edit.
// The provision commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const PROVISION_FIELDS = {
  '/api/provision/name-provider': {
    record_id: { kind: 'id', description: 'The data store, technical record or obligation provided from outside the product.', required: true, clearable: false },
    provider_id: { kind: 'id', description: 'What provides it: an integration, or a record of a product kind the product lets provide it.', required: true, clearable: false },
  },
  '/api/provision/remove-provider': {
    record_id: { kind: 'id', description: 'The record no longer provided from outside the product.', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
