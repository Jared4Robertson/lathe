import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ViewRepository } from '../repository.ts';
import { REMOVE_VIEW_REQUIREMENT_IDENTITY } from './identities.generated.ts';

/** The view requirement to remove. */
export type RemoveViewRequirement = { id: string };

export const REMOVE_VIEW_REQUIREMENT: CommandDefinition<RemoveViewRequirement> = {
  ...REMOVE_VIEW_REQUIREMENT_IDENTITY,
  input: {
    id: column('view_requirement', 'id', 'required'),
  },
  handler: removeViewRequirement,
};

/** Removes the view requirement from its view. */
export function removeViewRequirement(tx: Transaction, input: RemoveViewRequirement): void {
  const views = new ViewRepository(tx);
  const view = views.loadHolding('view_requirement', input.id) ?? tx.refuse('missing', `there is no view requirement ${input.id}`);
  view.requirements = view.requirements.filter((x) => x.id !== input.id);
  view.tests = view.tests.filter((t) => t.row.view_requirement_id !== input.id);
  views.save(view);
}
