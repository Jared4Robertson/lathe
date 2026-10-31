import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { VIEW_SLICE } from '../model.ts';
import { ViewRepository } from '../repository.ts';

/** The view test to remove. */
export type RemoveViewTest = { id: string };

export const REMOVE_VIEW_TEST: CommandDefinition<RemoveViewTest> = {
  id: 'LA-AUT-CMD318',
  slice: VIEW_SLICE,
  name: 'remove-view-test',
  description: 'Removes a view test with the links it starts. Refused while anything else references them.',
  method: 'POST',
  route: '/api/view/remove-view-test',
  input: {
    id: column('view_test', 'id', 'required'),
  },
  handler: removeViewTest,
};

/** Removes the view test from its view. */
export function removeViewTest(tx: Transaction, input: RemoveViewTest): void {
  const views = new ViewRepository(tx);
  const view = views.loadHolding('view_test', input.id) ?? tx.refuse('missing', `there is no view test ${input.id}`);
  view.tests = view.tests.filter((x) => x.row.id !== input.id);
  views.save(view);
}
