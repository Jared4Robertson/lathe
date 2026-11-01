// Generated from data/ by `npm run generate`. Do not edit.
// The tooling commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const TOOLING_FIELDS = {
  '/api/tooling/add-tooling': {
    id: { kind: 'column', table: 'tooling', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'tooling', column: 'title', required: true, clearable: false },
    domain_id: { kind: 'column', table: 'tooling', column: 'domain_id', required: true, clearable: false },
    file: { kind: 'column', table: 'tooling', column: 'file', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses, as the product\'s package.json files list them.', required: false, clearable: false },
    meets: { kind: 'ids', description: 'The standard rules it meets.', required: false, clearable: false },
  },
  '/api/tooling/change-tooling': {
    id: { kind: 'column', table: 'tooling', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'tooling', column: 'title', required: false, clearable: false },
    file: { kind: 'column', table: 'tooling', column: 'file', required: false, clearable: true },
    packages: { kind: 'texts', description: 'The packages it uses. Replaces the list.', required: false, clearable: false },
    meets: { kind: 'ids', description: 'The standard rules it meets. Replaces the list.', required: false, clearable: false },
  },
  '/api/tooling/remove-tooling': {
    id: { kind: 'column', table: 'tooling', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
