import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ViewRow } from '../../../platform/data/tables.ts';
import { newView } from '../model.ts';
import { ViewRepository } from '../repository.ts';
import { ADD_VIEW_IDENTITY } from './identities.generated.ts';

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

/** Adds the view, new and whole. */
export function addView(tx: Transaction, input: AddView): void {
  const views = new ViewRepository(tx);
  const view = views.create(newView(input));
  views.save(view);
}
