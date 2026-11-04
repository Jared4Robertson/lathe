// Generated from data/ by `npm run generate`. Do not edit.
// The entry-point commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const ENTRY_POINT_FIELDS = {
  '/api/entry-point/add-entry-point': {
    id: { kind: 'column', table: 'entry_point', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'entry_point', column: 'title', required: true, clearable: false },
    domain_id: { kind: 'column', table: 'entry_point', column: 'domain_id', required: true, clearable: false },
    file: { kind: 'column', table: 'entry_point', column: 'file', required: false, clearable: false },
    description: { kind: 'column', table: 'entry_point', column: 'description', required: true, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses, as the product\'s package.json files list them.', required: false, clearable: false },
    helpers: { kind: 'texts', description: 'The helper files its code is split across beside its file, such as helpers and build-tag variants, each from the product root; no other record names one.', required: false, clearable: false },
    meets: { kind: 'ids', description: 'The standard rules it meets.', required: false, clearable: false },
  },
  '/api/entry-point/change-entry-point': {
    id: { kind: 'column', table: 'entry_point', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'entry_point', column: 'title', required: false, clearable: false },
    file: { kind: 'column', table: 'entry_point', column: 'file', required: false, clearable: true },
    description: { kind: 'column', table: 'entry_point', column: 'description', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses.', required: false, clearable: false },
    helpers: { kind: 'texts', description: 'The helper files its code is split across beside its file, each from the product root.', required: false, clearable: false },
    meets: { kind: 'ids', description: 'The standard rules it meets.', required: false, clearable: false },
  },
  '/api/entry-point/remove-entry-point': {
    id: { kind: 'column', table: 'entry_point', column: 'id', required: true, clearable: false },
  },
  '/api/entry-point/move-entry-point': {
    id: { kind: 'column', table: 'entry_point', column: 'id', required: true, clearable: false },
    domain_id: { kind: 'column', table: 'entry_point', column: 'domain_id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
