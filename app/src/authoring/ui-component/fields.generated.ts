// Generated from data/ by `npm run generate`. Do not edit.
// The ui-component commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const UI_COMPONENT_FIELDS = {
  '/api/ui-component/add-ui-component': {
    id: { kind: 'column', table: 'ui_component', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'ui_component', column: 'title', required: true, clearable: false },
    description: { kind: 'column', table: 'ui_component', column: 'description', required: true, clearable: false },
    file: { kind: 'column', table: 'ui_component', column: 'file', required: false, clearable: false },
    renders: { kind: 'ids', description: 'The views it renders, or part of.', required: false, clearable: false },
    builds: { kind: 'ids', description: 'The view requirements its code builds: does what each says.', required: false, clearable: false },
    meets: { kind: 'ids', description: 'The standard rules it follows.', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses, each listed in one of the product\'s package.json files.', required: false, clearable: false },
  },
  '/api/ui-component/change-ui-component': {
    id: { kind: 'column', table: 'ui_component', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'ui_component', column: 'title', required: false, clearable: false },
    description: { kind: 'column', table: 'ui_component', column: 'description', required: false, clearable: false },
    file: { kind: 'column', table: 'ui_component', column: 'file', required: false, clearable: true },
    renders: { kind: 'ids', description: 'The views it renders, or part of.', required: false, clearable: false },
    builds: { kind: 'ids', description: 'The view requirements its code builds.', required: false, clearable: false },
    meets: { kind: 'ids', description: 'The standard rules it follows.', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses.', required: false, clearable: false },
  },
  '/api/ui-component/remove-ui-component': {
    id: { kind: 'column', table: 'ui_component', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
