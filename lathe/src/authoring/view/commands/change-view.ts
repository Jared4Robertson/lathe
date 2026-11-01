import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ViewRow } from '../../../platform/data/tables.ts';
import { CHANGE_VIEW_IDENTITY } from './identities.generated.ts';
import { changeView } from './handlers.generated.ts';

/** The view's changes: a column given is set, null clears an optional one; presents, when given, replaces the list. */
export type ChangeView = Pick<ViewRow, 'id'> & { title?: ViewRow['title']; description?: ViewRow['description']; route?: ViewRow['route'] | null; interface_id?: ViewRow['interface_id'] | null; notes?: ViewRow['notes'] | null; presents?: string[] };

export const CHANGE_VIEW = {
  ...CHANGE_VIEW_IDENTITY,
  input: {
    id: column('view', 'id', 'required'),
    title: column('view', 'title', 'optional'),
    description: column('view', 'description', 'optional'),
    route: column('view', 'route', 'clearable'),
    interface_id: column('view', 'interface_id', 'clearable'),
    notes: column('view', 'notes', 'clearable'),
    presents: ids('The commands and queries a person sends or asks in it. Replaces the list.', 'optional'),
  },
  handler: changeView,
} satisfies CommandDefinition<ChangeView>;
