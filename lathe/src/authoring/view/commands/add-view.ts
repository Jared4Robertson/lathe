import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ViewRow } from '../../../platform/data/tables.ts';
import { ADD_VIEW_IDENTITY } from './identities.generated.ts';
import { addView } from './handlers.generated.ts';

/** A new view. */
export type AddView = Pick<ViewRow, 'id' | 'title' | 'description' | 'route' | 'notes'>;

export const ADD_VIEW = {
  ...ADD_VIEW_IDENTITY,
  input: {
    id: column('view', 'id', 'required'),
    title: column('view', 'title', 'required'),
    description: column('view', 'description', 'required'),
    route: column('view', 'route', 'optional'),
    notes: column('view', 'notes', 'optional'),
  },
  handler: addView,
} satisfies CommandDefinition<AddView>;
