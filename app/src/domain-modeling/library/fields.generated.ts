// Generated from data/ by `npm run generate`. Do not edit.
// The library commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const LIBRARY_FIELDS = {
  '/api/library/add-library': {
    id: { kind: 'column', table: 'library', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'library', column: 'title', required: true, clearable: false },
    domain_id: { kind: 'column', table: 'library', column: 'domain_id', required: true, clearable: false },
    description: { kind: 'column', table: 'library', column: 'description', required: true, clearable: false },
    serves: { kind: 'ids', description: 'The business outcomes of its product it serves: what its consumers rely on it for.', required: false, clearable: false },
  },
  '/api/library/change-library': {
    id: { kind: 'column', table: 'library', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'library', column: 'title', required: false, clearable: false },
    description: { kind: 'column', table: 'library', column: 'description', required: false, clearable: false },
    serves: { kind: 'ids', description: 'The business outcomes of its product it serves.', required: false, clearable: false },
  },
  '/api/library/remove-library': {
    id: { kind: 'column', table: 'library', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
