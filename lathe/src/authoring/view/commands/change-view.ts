import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ViewRow } from '../../../platform/data/tables.ts';
import { changed, VIEW_SLICE } from '../model.ts';
import { ViewRepository } from '../repository.ts';

/** The view's changes: a column given is set, null clears an optional one. */
export type ChangeView = Pick<ViewRow, 'id'> & { title?: ViewRow['title']; description?: ViewRow['description']; route?: ViewRow['route'] | null; notes?: ViewRow['notes'] | null };

export const CHANGE_VIEW: CommandDefinition<ChangeView> = {
  id: 'LA-AUT-CMD311',
  slice: VIEW_SLICE,
  name: 'change-view',
  description: "Changes a view's title, route, description or notes.",
  method: 'POST',
  route: '/api/view/change-view',
  input: {
    id: column('view', 'id', 'required'),
    title: column('view', 'title', 'optional'),
    description: column('view', 'description', 'optional'),
    route: column('view', 'route', 'clearable'),
    notes: column('view', 'notes', 'clearable'),
  },
  handler: changeView,
};

/** Changes the view's columns. */
export function changeView(tx: Transaction, input: ChangeView): void {
  const views = new ViewRepository(tx);
  const view = views.load(input.id) ?? tx.refuse('missing', `there is no view ${input.id}`);
  view.view = changed(view.view, input, ['title', 'description', 'route', 'notes']);
  views.save(view);
}
