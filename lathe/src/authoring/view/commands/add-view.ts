import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ViewRow } from '../../../platform/data/tables.ts';
import { newView, VIEW_SLICE } from '../model.ts';
import { ViewRepository } from '../repository.ts';

/** A new view. */
export type AddView = Pick<ViewRow, 'id' | 'title' | 'description' | 'route' | 'notes'>;

export const ADD_VIEW: CommandDefinition<AddView> = {
  id: 'LA-AUT-CMD310',
  slice: VIEW_SLICE,
  name: 'add-view',
  description: 'Adds a view: a screen or page a person uses, with its route. It has no owner; its product follows from its ID.',
  method: 'POST',
  route: '/api/view/add-view',
  input: {
    id: column('view', 'id', 'required'),
    title: column('view', 'title', 'required'),
    description: column('view', 'description', 'required'),
    route: column('view', 'route', 'optional'),
    notes: column('view', 'notes', 'optional'),
  },
  handler: addView,
};

/** Adds the view, new and whole. */
export function addView(tx: Transaction, input: AddView): void {
  const views = new ViewRepository(tx);
  const view = views.create(newView(input));
  views.save(view);
}
