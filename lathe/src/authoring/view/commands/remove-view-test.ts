import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ViewRepository } from '../repository.ts';
import { REMOVE_VIEW_TEST_IDENTITY } from './identities.generated.ts';

/** The view test to remove. */
export type RemoveViewTest = { id: string };

export const REMOVE_VIEW_TEST = {
  ...REMOVE_VIEW_TEST_IDENTITY,
  input: {
    id: column('view_test', 'id', 'required'),
  },
  handler: removeViewTest,
} satisfies CommandDefinition<RemoveViewTest>;

/** Removes the view test from its view. */
export function removeViewTest(tx: Transaction, input: RemoveViewTest): void {
  const views = new ViewRepository(tx);
  const view = views.loadHolding('view_test', input.id) ?? tx.refuse('missing', `there is no view test ${input.id}`);
  view.tests = view.tests.filter((x) => x.row.id !== input.id);
  views.save(view);
}
