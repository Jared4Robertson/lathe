import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ViewRepository } from '../repository.ts';
import { REMOVE_VIEW_IDENTITY } from './identities.generated.ts';

/** The view to remove. */
export type RemoveView = { id: string };

export const REMOVE_VIEW = {
  ...REMOVE_VIEW_IDENTITY,
  input: {
    id: column('view', 'id', 'required'),
  },
  handler: removeView,
} satisfies CommandDefinition<RemoveView>;

/** Removes the view whole. */
export function removeView(tx: Transaction, input: RemoveView): void {
  const views = new ViewRepository(tx);
  const view = views.load(input.id) ?? tx.refuse('missing', `there is no view ${input.id}`);
  views.remove(view);
}
