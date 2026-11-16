// Generated from data/ by `npm run generate`. Do not edit.
// The generated-component commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const GENERATED_COMPONENT_FIELDS = {
  '/api/generated-component/add-generated-component': {
    id: { kind: 'column', table: 'generated_component', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'generated_component', column: 'title', required: true, clearable: false },
    domain_id: { kind: 'column', table: 'generated_component', column: 'domain_id', required: true, clearable: false },
    description: { kind: 'column', table: 'generated_component', column: 'description', required: true, clearable: false },
    serves: { kind: 'ids', description: 'The business outcomes of its product it serves: what its consumers rely on it for.', required: false, clearable: false },
  },
  '/api/generated-component/change-generated-component': {
    id: { kind: 'column', table: 'generated_component', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'generated_component', column: 'title', required: false, clearable: false },
    description: { kind: 'column', table: 'generated_component', column: 'description', required: false, clearable: false },
    serves: { kind: 'ids', description: 'The business outcomes of its product it serves.', required: false, clearable: false },
  },
  '/api/generated-component/remove-generated-component': {
    id: { kind: 'column', table: 'generated_component', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
