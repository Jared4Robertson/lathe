import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ViewRow } from '../../../platform/data/tables.ts';
import { CHANGE_VIEW_IDENTITY } from './identities.generated.ts';
import { changeView } from './handlers.generated.ts';

/** The view's changes: a column given is set, null clears an optional one. */
export type ChangeView = Pick<ViewRow, 'id'> & { title?: ViewRow['title']; description?: ViewRow['description']; route?: ViewRow['route'] | null; notes?: ViewRow['notes'] | null };

export const CHANGE_VIEW = {
  ...CHANGE_VIEW_IDENTITY,
  input: {
    id: column('view', 'id', 'required'),
    title: column('view', 'title', 'optional'),
    description: column('view', 'description', 'optional'),
    route: column('view', 'route', 'clearable'),
    notes: column('view', 'notes', 'clearable'),
  },
  handler: changeView,
} satisfies CommandDefinition<ChangeView>;
