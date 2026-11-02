// Generated from data/ by `npm run generate`. Do not edit.
// The interface commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const INTERFACE_FIELDS = {
  '/api/interface/add-interface': {
    id: { kind: 'column', table: 'interface', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'interface', column: 'title', required: true, clearable: false },
    product_id: { kind: 'column', table: 'interface', column: 'product_id', required: true, clearable: false },
    kind: { kind: 'column', table: 'interface', column: 'kind', required: true, clearable: false },
    description: { kind: 'column', table: 'interface', column: 'description', required: true, clearable: false },
    public: { kind: 'column', table: 'interface', column: 'public', required: true, clearable: false },
    actors: { kind: 'texts', description: 'The roles of the product that use it, in order.', required: false, clearable: false },
    offers: { kind: 'ids', description: 'The use cases of the product it offers.', required: false, clearable: false },
  },
  '/api/interface/change-interface': {
    id: { kind: 'column', table: 'interface', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'interface', column: 'title', required: false, clearable: false },
    kind: { kind: 'column', table: 'interface', column: 'kind', required: false, clearable: false },
    description: { kind: 'column', table: 'interface', column: 'description', required: false, clearable: false },
    public: { kind: 'column', table: 'interface', column: 'public', required: false, clearable: false },
    actors: { kind: 'texts', description: 'The roles of the product that use it, in order.', required: false, clearable: false },
    offers: { kind: 'ids', description: 'The use cases of the product it offers.', required: false, clearable: false },
  },
  '/api/interface/remove-interface': {
    id: { kind: 'column', table: 'interface', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
