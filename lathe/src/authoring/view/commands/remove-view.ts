import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { VIEW_SLICE } from '../model.ts';
import { ViewRepository } from '../repository.ts';

/** The view to remove. */
export type RemoveView = { id: string };

export const REMOVE_VIEW: CommandDefinition<RemoveView> = {
  id: 'LA-AUT-CMD312',
  slice: VIEW_SLICE,
  name: 'remove-view',
  description: 'Removes a view whole: its view requirements and their view tests and the links they start. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/view/remove-view',
  input: {
    id: column('view', 'id', 'required'),
  },
  handler: removeView,
};

/** Removes the view whole. */
export function removeView(tx: Transaction, input: RemoveView): void {
  const views = new ViewRepository(tx);
  const view = views.load(input.id) ?? tx.refuse('missing', `there is no view ${input.id}`);
  views.remove(view);
}
