// Generated from data/ by `npm run generate`. Do not edit.
// The extension-record commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const EXTENSION_RECORD_FIELDS = {
  '/api/extension-record/add-extension-record': {
    kind: { kind: 'id', description: 'The product kind it is a record of, by name, such as report.', required: true, clearable: false },
    id: { kind: 'id', description: 'The record\'s ID, as its kind\'s ID pattern says.', required: true, clearable: false },
    parent_id: { kind: 'id', description: 'The record it sits under, of its kind\'s parent kind.', required: true, clearable: false },
    values: { kind: 'values', description: 'Its title and its declared fields, by column name: each required field is required, and so is title unless a field of its kind titles it.', required: true, clearable: false },
    links: { kind: 'links', description: 'The records it links to, by relation: only relations its kind may start.', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses, as package.json lists them; only a technical record uses one.', required: false, clearable: false },
  },
  '/api/extension-record/change-extension-record': {
    id: { kind: 'id', description: 'The record.', required: true, clearable: false },
    values: { kind: 'values', description: 'Its title or declared fields to change, by column name. A title a field of its kind gives follows that field.', required: false, clearable: false },
    links: { kind: 'links', description: 'The records it links to, by relation.', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses.', required: false, clearable: false },
  },
  '/api/extension-record/remove-extension-record': {
    id: { kind: 'id', description: 'The record.', required: true, clearable: false },
  },
  '/api/extension-record/move-extension-record': {
    id: { kind: 'id', description: 'The record of a product\'s own kind, under a domain, to move.', required: true, clearable: false },
    domain_id: { kind: 'id', description: 'The domain of its product it moves to.', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
